"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-public-freshness-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`freshness server exited with ${child.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/healthz`)).ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("freshness server did not become healthy");
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

function postPayload(id, title, category, tags) {
  return {
    id,
    slug: id,
    title,
    category,
    excerpt: "公开投影缓存隔离验证",
    markdown: "## 验证\n\n我采用隔离数据验证公开投影。",
    cover: "./assets/covers/analog-cover.png",
    publishStatus: "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 50,
    tags
  };
}

async function runApiTest(dataDir) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_USERNAME: "FreshnessTester",
      ADMIN_PASSWORD: "public-freshness-test-password",
      ALLOW_LEGACY_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  let cookie = "";
  let csrfToken = "";

  async function request(route, options = {}) {
    const method = options.method || "GET";
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (!["GET", "HEAD"].includes(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  }

  try {
    await waitForServer(baseUrl, child);
    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "FreshnessTester", password: "public-freshness-test-password" })
    });
    assert.equal(login.status, 200);
    csrfToken = (await login.json()).csrfToken;

    const allowed = postPayload(
      "public-freshness-allowed",
      "反激变换器 Vor 与伏秒平衡推导",
      "电力电子",
      "module:power-electronics"
    );
    const blocked = postPayload(
      "public-freshness-blocked",
      "聚焦外公开测试",
      "模拟电子",
      "outside:focus"
    );
    assert.equal((await request("/api/posts", { method: "POST", body: JSON.stringify(allowed) })).status, 200);
    assert.equal((await request("/api/posts", { method: "POST", body: JSON.stringify(blocked) })).status, 409);

    const jsonResponse = await request("/api/content");
    const scriptResponse = await request("/api/content.js?v=stale-client-key");
    for (const response of [jsonResponse, scriptResponse]) {
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      assert.match(response.headers.get("cache-control") || "", /max-age=0/);
      assert.equal(response.headers.get("pragma"), "no-cache");
      assert.equal(response.headers.get("expires"), "0");
    }
    const publicPayload = await jsonResponse.json();
    assert.equal(publicPayload.posts.filter((post) => post.id === allowed.id).length, 1);
    assert.equal(publicPayload.posts.some((post) => post.id === blocked.id), false);
    const scriptText = await scriptResponse.text();
    assert.match(scriptText, new RegExp(allowed.id));
    assert.doesNotMatch(scriptText, new RegExp(blocked.id));

    const detail = await request(`/api/public/posts/${allowed.id}`);
    assert.equal(detail.status, 200);
    const detailPayload = await detail.json();
    assert.equal(detailPayload.post.id, allowed.id);
    assert.equal(Object.hasOwn(detailPayload.post, "publishStatus"), false);

    const staticScript = await request("/main.js?v=static-cache-check");
    assert.equal(staticScript.status, 200);
    assert.doesNotMatch(staticScript.headers.get("cache-control") || "", /no-store/);
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${output}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

function runClientContractTest() {
  const source = fs.readFileSync(path.join(ROOT, "data/content-store.js"), "utf8");
  const listeners = new Map();
  const documentListeners = new Map();
  const intervals = [];
  const events = [];
  let fetchCalls = 0;
  const payloads = [
    { posts: [{ id: "newer" }], projects: [], publicFocusMode: { enabled: true } },
    new Error("network failed")
  ];
  class CustomEventStub {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  const sandbox = {
    window: {
      LARKIX_SERVER_CONTENT: { posts: [{ id: "old" }], projects: [], publicFocusMode: { enabled: true } },
      LARKIX_POSTS: [],
      LARKIX_PROJECTS: [],
      fetch: async () => {
        const value = payloads[fetchCalls++];
        if (value instanceof Error) throw value;
        return { ok: true, json: async () => value };
      },
      addEventListener: (type, handler) => listeners.set(type, handler),
      dispatchEvent: (event) => events.push(event),
      setInterval: (handler, delay) => intervals.push({ handler, delay })
    },
    document: {
      readyState: "complete",
      visibilityState: "visible",
      body: { classList: { add() {} } },
      querySelectorAll: () => [],
      addEventListener: (type, handler) => documentListeners.set(type, handler)
    },
    localStorage: { getItem: () => null, setItem() {} },
    location: { href: "http://example.test/category.html", pathname: "/category.html", search: "" },
    URL,
    CustomEvent: CustomEventStub,
    Date,
    JSON,
    Map,
    Set,
    Promise,
    RegExp,
    String
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return Promise.resolve()
    .then(() => new Promise((resolve) => setImmediate(resolve)))
    .then(async () => {
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].delay, 5000);
      assert.equal(sandbox.window.LARKIX_SERVER_CONTENT.posts[0].id, "newer");
      assert.equal(events.filter((event) => event.type === "larkix:public-content-updated").length, 1);
      await listeners.get("focus")();
      assert.equal(sandbox.window.LARKIX_SERVER_CONTENT.posts[0].id, "newer");
      assert.equal(events.filter((event) => event.type === "larkix:public-content-updated").length, 1);
    });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-public-freshness-"));
  try {
    const nginx = fs.readFileSync(path.join(ROOT, "deploy/nginx-gokottamaker.conf"), "utf8");
    const apiLocation = nginx.indexOf("location ^~ /api/");
    const staticCache = nginx.indexOf("proxy_cache_valid 200 7d;");
    const staticLocation = nginx.lastIndexOf("location ~*", staticCache);
    assert.ok(apiLocation >= 0 && staticLocation > apiLocation && staticCache > staticLocation);
    assert.match(nginx.slice(apiLocation, staticLocation), /proxy_cache off/);
    assert.match(nginx.slice(apiLocation, staticLocation), /no-store, no-cache, must-revalidate, max-age=0/);
    assert.match(nginx.slice(staticLocation), /expires 7d/);
    assert.match(nginx.slice(staticLocation), /Cache-Control "public"/);

    const mainSource = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
    const categorySource = fs.readFileSync(path.join(ROOT, "category-page.js"), "utf8");
    const postSource = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
    const adminSource = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    for (const source of [mainSource, categorySource, postSource]) {
      assert.match(source, /larkix:public-content-updated/);
    }
    assert.match(adminSource, /confirmPublicPostProjection/);
    assert.match(adminSource, /api\/public\/posts/);

    for (const file of ["maker.html", "category.html", "post.html"]) {
      const html = fs.readFileSync(path.join(ROOT, file), "utf8");
      assert.match(html, /20260812-s44/);
    }

    await runClientContractTest();
    await runApiTest(tempRoot);
    console.log("Public content freshness tests passed.");
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
