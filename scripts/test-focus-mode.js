"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-focus-mode-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function startServer({ port, dataDir }) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USERNAME: "FocusModeTester",
      ADMIN_PASSWORD: "focus-mode-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  return { child, output: () => output };
}

async function waitForServer(baseUrl, child, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early\n${output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`server did not start\n${output()}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function postFixture(id, category, publishStatus) {
  return {
    id,
    slug: id,
    type: "post",
    title: `Focus fixture ${id}`,
    category,
    excerpt: `Fixture ${id}`,
    cover: "./assets/covers/analog-cover.png",
    markdown: `# ${id}\n\nPlain fixture without derivation markup.`,
    readTime: "3 分钟阅读",
    date: "2026-07-27",
    publishStatus,
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 10,
    tags: `fixture:${id}`
  };
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-focus-mode-"));
  const dataDir = path.join(tempRoot, "data");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let runtime = null;
  let cookie = "";
  let csrfToken = "";

  async function request(route, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("json") ? await response.json() : await response.text();
    return { response, payload };
  }

  async function login() {
    cookie = "";
    csrfToken = "";
    const result = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "FocusModeTester", password: "focus-mode-test-password" })
    });
    assert.equal(result.response.status, 200);
    csrfToken = result.payload.csrfToken;
  }

  async function restart() {
    await stopServer(runtime?.child);
    runtime = startServer({ port, dataDir });
    await waitForServer(baseUrl, runtime.child, runtime.output);
    cookie = "";
    csrfToken = "";
  }

  try {
    await restart();

    const fresh = await request("/api/content");
    assert.equal(fresh.response.status, 200);
    assert.equal(fresh.payload.publicFocusMode.enabled, true);
    assert.equal(fresh.payload.publicFocusMode.ownerConfigured, false);
    assert.deepEqual(fresh.payload.publicFocusMode.visibleScopes, ["electronics-basics", "derivations", "projects"]);
    assert.equal(fresh.payload.publicFocusMode.scopeAliases["power-electronics"], "electronics-basics");

    await login();
    const focusedAdmin = await request("/api/admin/content");
    assert.equal(focusedAdmin.payload.publicFocusMode.enabled, true);
    assert.ok(focusedAdmin.payload.projects.length >= 1);
    assert.equal(focusedAdmin.payload.posts.some((post) => post.categoryKey === "stm32"), false);

    const allowed = postFixture("focus-allowed-published", "电子基础", "published");
    const allowedSaved = await request("/api/posts", { method: "POST", body: JSON.stringify(allowed) });
    assert.equal(allowedSaved.response.status, 200);
    assert.ok(allowedSaved.payload.posts.some((post) => post.id === allowed.id));

    const rejected = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(postFixture("focus-rejected-new", "模拟电子", "published"))
    });
    assert.equal(rejected.response.status, 409);
    assert.equal(rejected.payload.reasonCode, "FOCUS_SCOPE_OUTSIDE");

    const disabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.payload.publicFocusMode.enabled, false);
    assert.equal(disabled.payload.publicFocusMode.ownerConfigured, true);
    assert.equal(disabled.payload.reasonCode, "FOCUS_MODE_DISABLED_BY_OWNER");

    const hiddenPublished = postFixture("focus-hidden-published", "模拟电子", "published");
    const hiddenDraft = postFixture("focus-hidden-draft", "STM32", "draft");
    assert.equal(
      (await request("/api/posts", { method: "POST", body: JSON.stringify(hiddenPublished) })).response.status,
      200
    );
    assert.equal((await request("/api/posts", { method: "POST", body: JSON.stringify(hiddenDraft) })).response.status, 200);

    const unfocusedPublic = await request("/api/content");
    assert.equal(unfocusedPublic.payload.publicFocusMode.enabled, false);
    assert.ok(unfocusedPublic.payload.posts.some((post) => post.id === hiddenPublished.id));
    assert.equal(unfocusedPublic.payload.posts.some((post) => post.id === hiddenDraft.id), false);
    const unfocusedAdmin = await request("/api/admin/content");
    assert.ok(unfocusedAdmin.payload.posts.some((post) => post.id === hiddenPublished.id));
    assert.ok(unfocusedAdmin.payload.posts.some((post) => post.id === hiddenDraft.id));

    await restart();
    const persistedDisabled = await request("/api/content");
    assert.equal(persistedDisabled.payload.publicFocusMode.enabled, false);
    assert.equal(persistedDisabled.payload.publicFocusMode.ownerConfigured, true);

    await login();
    const enabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: true })
    });
    assert.equal(enabled.response.status, 200);
    assert.equal(enabled.payload.publicFocusMode.enabled, true);
    assert.equal(enabled.payload.reasonCode, "FOCUS_MODE_ENABLED_BY_OWNER");

    const refocusedPublic = await request("/api/content");
    assert.ok(refocusedPublic.payload.posts.some((post) => post.id === allowed.id));
    assert.equal(refocusedPublic.payload.posts.some((post) => post.id === hiddenPublished.id), false);
    assert.equal(refocusedPublic.payload.posts.some((post) => post.id === hiddenDraft.id), false);
    assert.ok(refocusedPublic.payload.projects.length >= 1);

    const refocusedAdmin = await request("/api/admin/content");
    assert.ok(refocusedAdmin.payload.posts.some((post) => post.id === allowed.id));
    assert.equal(refocusedAdmin.payload.posts.some((post) => post.id === hiddenPublished.id), false);
    assert.equal(refocusedAdmin.payload.posts.some((post) => post.id === hiddenDraft.id), false);
    assert.ok(refocusedAdmin.payload.focusScopeCounts.posts.stored > refocusedAdmin.payload.focusScopeCounts.posts.visible);

    const hiddenApi = await request(`/api/public/posts/${hiddenPublished.id}`);
    assert.equal(hiddenApi.response.status, 404);
    assert.equal(hiddenApi.payload.reasonCode, "FOCUS_HIDDEN_OR_NOT_PUBLIC");
    assert.equal((await request(`/post.html?id=${hiddenPublished.id}`)).response.status, 404);
    assert.equal((await request("/category.html?category=analog")).response.status, 404);
    assert.equal((await request("/miniapps.html")).response.status, 404);
    assert.equal((await request("/category.html?category=power-electronics")).response.status, 200);
    assert.equal((await request("/category.html?category=electronics-basics")).response.status, 200);

    const hiddenUpdate = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({ ...hiddenPublished, title: "Should remain hidden" })
    });
    assert.equal(hiddenUpdate.response.status, 404);

    const sitemap = await request("/sitemap.xml");
    assert.equal(sitemap.response.status, 200);
    assert.match(sitemap.payload, /category\.html\?category=electronics-basics/);
    assert.match(sitemap.payload, /derive\.html/);
    assert.match(sitemap.payload, /projects\.html/);
    assert.doesNotMatch(sitemap.payload, /category\.html\?category=(?:analog|stm32|esp32|all)/);
    assert.doesNotMatch(sitemap.payload, /miniapps\.html|focus-hidden-published/);
    const rss = await request("/rss.xml");
    assert.equal(rss.response.status, 200);
    assert.doesNotMatch(rss.payload, /focus-hidden-published/);

    await restart();
    const persistedEnabled = await request("/api/content");
    assert.equal(persistedEnabled.payload.publicFocusMode.enabled, true);
    assert.equal(persistedEnabled.payload.publicFocusMode.ownerConfigured, true);

    await stopServer(runtime.child);
    runtime = null;
    const dbPath = path.join(dataDir, "database", "gokottamaker.sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db
        .prepare("SELECT id, publish_status AS publishStatus, deleted_at AS deletedAt FROM posts WHERE id IN (?, ?, ?)")
        .all(allowed.id, hiddenPublished.id, hiddenDraft.id);
      assert.equal(rows.length, 3);
      assert.equal(rows.find((row) => row.id === hiddenPublished.id).publishStatus, "published");
      assert.equal(rows.find((row) => row.id === hiddenDraft.id).publishStatus, "draft");
      assert.equal(rows.some((row) => row.deletedAt), false);
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE id = '018_focus_mode_scope_gate'").get().count,
        1
      );
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally {
      db.close();
    }

    const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
    const adminCss = fs.readFileSync(path.join(ROOT, "admin", "admin.css"), "utf8");
    const mainJs = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
    assert.equal((adminHtml.match(/id="focusModeToggle"/g) || []).length, 1);
    assert.match(adminHtml, /role="switch"/);
    assert.match(adminHtml, /所有原本已发布的非聚焦内容会立即重新公开/);
    assert.match(adminJs, /\/api\/admin\/focus-mode/);
    assert.match(adminJs, /FOCUS|聚焦模式/);
    assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*\.focus-mode-gate/);
    const focusHeroFallbackStart = mainJs.indexOf("const focusHeroFallback");
    const electronicsIndex = mainJs.indexOf(
      '"electronics-basics"',
      focusHeroFallbackStart
    );
    const derivationsIndex = mainJs.indexOf(
      '"derivations"',
      focusHeroFallbackStart
    );
    const projectsIndex = mainJs.indexOf(
      '"projects"',
      focusHeroFallbackStart
    );
    assert.ok(
      focusHeroFallbackStart >= 0 &&
        electronicsIndex > focusHeroFallbackStart &&
        derivationsIndex > electronicsIndex &&
        projectsIndex > derivationsIndex
    );
    assert.match(
      mainJs,
      /featuredItems = focusModeEnabled\(\)[\s\S]*?\[focusHeroFallback\[0\], \.\.\.eligibleFeaturedItems\]/
    );
    assert.match(
      mainJs,
      /\.hero-actions a\[href="\.\/admin\/index\.html"\][\s\S]*?link\.style\.display = "none"/
    );

    console.log(
      "focus mode checks passed: default enabled, single switch, scoped public/CMS data, write rejection, direct 404, disable restore, re-enable preservation, restart persistence and SEO"
    );
  } catch (error) {
    if (runtime) error.message = `${error.message}\nserver output:\n${runtime.output()}`;
    throw error;
  } finally {
    await stopServer(runtime?.child);
    safeRemoveTemp(tempRoot);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
