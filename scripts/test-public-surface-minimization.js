"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function safeRemove(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-public-surface-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function waitForServer(baseUrl, runtime) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (runtime.child.exitCode !== null) throw new Error(`server exited early\n${runtime.output()}`);
    try {
      if ((await fetch(`${baseUrl}/healthz`)).ok) return;
    } catch {
      // The isolated service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become healthy\n${runtime.output()}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function startServer(port, dataDir) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USERNAME: "PublicSurfaceTester",
      ADMIN_PASSWORD: "public-surface-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

function assertStaticSources() {
  const sourceFiles = [
    "index.html",
    "maker.html",
    "category.html",
    "projects.html",
    "miniapps.html",
    "tools/md2doc.html",
    "data/miniapps.js",
    "main.js",
    "site-layout.js",
    "data/content-store.js",
    "lib/seo.js"
  ];
  const publicSource = sourceFiles.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  assert.doesNotMatch(publicSource, /\.\/admin\/index\.html|\/admin\/|管理端/);
  assert.doesNotMatch(publicSource, /larkix-elec|LarkixElec|gokotta-elec/i);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "data/content-store.js"), "utf8"), /localStorage|LARKIX_POSTS|LARKIX_PROJECTS/);
  assert.equal((fs.readFileSync(path.join(ROOT, "data/miniapps.js"), "utf8").match(/id:\s*"md2file"/g) || []).length, 2);
  assert.equal(fs.existsSync(path.join(ROOT, "tools/larkix-elec.html")), true, "private tool code is retained");
}

async function run() {
  assertStaticSources();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-public-surface-"));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtime = startServer(port, tempRoot);

  async function request(route, options = {}) {
    const response = await fetch(`${baseUrl}${route}`, options);
    const body = await response.text();
    return { response, body };
  }

  try {
    await waitForServer(baseUrl, runtime);

    const payloadResponse = await request("/api/content");
    assert.equal(payloadResponse.response.status, 200);
    const payload = JSON.parse(payloadResponse.body);
    assert.deepEqual(Object.keys(payload.publicFocusMode), ["enabled"]);
    assert.equal(payload.publicFocusMode.enabled, true);
    const serialized = JSON.stringify(payload);
    for (const field of ["publishStatus", "visibilityStatus", "deletedAt", "ownerConfigured", "reasonCode"]) {
      assert.equal(serialized.includes(field), false, `public payload excludes ${field}`);
    }

    const sources = await Promise.all([
      "/",
      "/maker.html",
      "/miniapps.html",
      "/tools/md2doc.html",
      "/data/miniapps.js",
      "/styles.css",
      "/robots.txt",
      "/sitemap.xml",
      "/rss.xml"
    ].map((route) => request(route)));
    for (const result of sources) assert.equal(result.response.status, 200);
    const surface = sources.map((result) => result.body).join("\n");
    assert.doesNotMatch(surface, /\/admin\/|管理端|larkix-elec|LarkixElec|gokotta-elec/i);

    const randomPath = await request("/not-a-real-private-resource-8d5b4a");
    const forbiddenRoutes = [
      "/admin/",
      "/admin/index.html",
      "/tools/larkix-elec.html",
      "/tools/larkix-elec.js",
      "/tools/assets/larkix-elec-icon.png",
      "/data/posts.js",
      "/data/seed.js",
      "/data/course-meta.js",
      "/styles/larkix-elec.css",
      "/assets/design/course-layout-options/index.html",
      "/api/admin/content",
      "/api/posts",
      "/api/uploads",
      "/api/elec/samples",
      "/api/md2doc/convert"
    ];
    assert.equal(randomPath.response.status, 404);
    for (const route of forbiddenRoutes) {
      const blocked = await request(route);
      assert.equal(blocked.response.status, 404, `${route} must be anonymous 404`);
      assert.equal(blocked.response.headers.get("content-type"), randomPath.response.headers.get("content-type"));
      assert.equal(blocked.body, randomPath.body, `${route} must share the unknown-path template`);
    }

    for (const route of ["/miniapps.html", "/tools/md2doc.html", "/tools/md2doc.js", "/api/md2file/convert"]) {
      const method = route.startsWith("/api/") ? "POST" : "GET";
      const options = method === "POST"
        ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown: "# MD2File" }) }
        : {};
      assert.equal((await request(route, options)).response.status, 200, `${route} remains public`);
    }

    console.log("Public surface minimization checks passed.");
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${runtime.output()}`;
    throw error;
  } finally {
    await stopServer(runtime.child);
    safeRemove(tempRoot);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
