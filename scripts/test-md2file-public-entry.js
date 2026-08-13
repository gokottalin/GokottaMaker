"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CANONICAL_HREF = "./tools/md2doc.html";

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-md2file-entry-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function startServer(port, dataDir) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USERNAME: "Md2fileEntryTester",
      ADMIN_PASSWORD: "md2file-entry-test-password",
      ALLOW_LEGACY_CMS_LOOPBACK: "true"
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

async function waitForServer(baseUrl, runtime) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (runtime.child.exitCode !== null) throw new Error(`server exited early\n${runtime.output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Wait for the isolated server to become ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`server did not start\n${runtime.output()}`);
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

function assertStaticContract() {
  const registrySource = source("data/miniapps.js");
  const context = { window: {} };
  vm.runInNewContext(registrySource, context, { filename: "data/miniapps.js" });
  const stored = context.window.LARKIX_MINIAPPS;
  const projected = context.window.LARKIX_PUBLIC_MINIAPPS;

  assert.equal(stored.length, 1, "browser registry contains only the public miniapp");
  assert.doesNotMatch(registrySource, /larkix-elec|LarkixElec/, "private miniapp identity is not serialized");
  assert.equal(projected.length, 1, "public projection has exactly one miniapp");
  assert.equal(projected[0].id, "md2file");
  assert.equal(projected[0].name, "MD2File");
  assert.equal(projected[0].version, "V0.4", "public projection matches the MD2File protocol version");
  assert.equal(projected[0].href, CANONICAL_HREF);
  assert.equal(context.window.LarkixMiniapps.publicList([...stored, stored[0]]).length, 1, "duplicates are collapsed");

  const indexHtml = source("index.html");
  const makerHtml = source("maker.html");
  const miniappsHtml = source("miniapps.html");
  const mainJs = source("main.js");
  const siteLayoutJs = source("site-layout.js");
  const serverJs = source("server.js");

  assert.equal((indexHtml.match(/data-public-miniapp-card="md2file"/g) || []).length, 1);
  assert.equal((indexHtml.match(/href="\.\/tools\/md2doc\.html"/g) || []).length, 1);
  assert.doesNotMatch(indexHtml, /href="\.\/tools\/larkix-elec\.html"/);
  assert.match(makerHtml, /data-layout-section="miniapps"/);
  assert.match(mainJs, /LARKIX_PUBLIC_MINIAPPS/);
  assert.match(mainJs, /renderMiniappUpdates\(miniapps\)/);
  assert.doesNotMatch(mainJs, /renderMiniappUpdates\(focusModeEnabled\(\) \? \[\] : miniapps\)/);
  assert.match(miniappsHtml, /LARKIX_PUBLIC_MINIAPPS/);
  assert.match(miniappsHtml, /data-public-miniapp-card=/);
  assert.match(siteLayoutJs, /requiredPublicEntry \? false/);
  assert.match(serverJs, /requiredPublicLayoutSections/);
  assert.match(serverJs, /focusModePublicRouteExceptions/);
}

async function run() {
  assertStaticContract();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-md2file-entry-"));
  const dataDir = path.join(tempRoot, "data");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtime = startServer(port, dataDir);
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
    const payload = options.binary
      ? Buffer.from(await response.arrayBuffer())
      : contentType.includes("json")
        ? await response.json()
        : await response.text();
    return { response, payload };
  }

  try {
    await waitForServer(baseUrl, runtime);

    const focusedContent = await request("/api/content");
    assert.equal(focusedContent.payload.publicFocusMode.enabled, true);
    for (const route of ["/", "/index.html", "/maker.html", "/miniapps.html", "/tools/md2doc.html", "/tools/md2doc.js"]) {
      assert.equal((await request(route)).response.status, 200, `${route} is available in focus mode`);
    }
    for (const route of ["/tools/larkix-elec.html", "/tools/larkix-elec.js", "/tools/assets/larkix-elec-icon.png"]) {
      assert.equal((await request(route)).response.status, 404, `${route} remains blocked in focus mode`);
    }
    assert.equal(
      (await request("/api/md2doc/convert", { method: "POST", body: JSON.stringify({ markdown: "# legacy" }) })).response.status,
      404,
      "legacy conversion alias is not a focus-mode exception"
    );
    const conversion = await request("/api/md2file/convert", {
      method: "POST",
      body: JSON.stringify({ markdown: "# MD2File\n\nFocus route.", title: "MD2File", filename: "md2file-focus" }),
      binary: true
    });
    assert.equal(conversion.response.status, 200);
    assert.match(conversion.response.headers.get("content-type") || "", /application\/vnd\.openxmlformats/);
    assert.ok(conversion.payload.length > 100, "conversion returns a non-empty DOCX");

    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "Md2fileEntryTester", password: "md2file-entry-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const layout = await request("/api/admin/site-layout", {
      method: "POST",
      body: JSON.stringify({
        home: [{ key: "miniapps", visible: false }],
        miniappsPage: [
          { key: "miniappsHeader", visible: false },
          { key: "miniappRegistry", visible: false }
        ]
      })
    });
    assert.equal(layout.response.status, 200);
    assert.equal(layout.payload.siteLayout.home.find((item) => item.key === "miniapps").visible, true);
    assert.equal(layout.payload.siteLayout.miniappsPage.find((item) => item.key === "miniappsHeader").visible, true);
    assert.equal(layout.payload.siteLayout.miniappsPage.find((item) => item.key === "miniappRegistry").visible, true);

    const disabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.payload.publicFocusMode.enabled, false);
    assert.equal((await request("/tools/larkix-elec.html")).response.status, 200, "stored tools remain available outside focus mode");
    assert.equal(
      (await request("/api/md2doc/convert", { method: "POST", body: JSON.stringify({ markdown: "# legacy" }), binary: true })).response.status,
      200,
      "legacy alias remains compatible outside focus mode"
    );
    for (const route of ["/index.html", "/maker.html", "/miniapps.html", "/tools/md2doc.html"]) {
      assert.equal((await request(route)).response.status, 200, `${route} remains available outside focus mode`);
    }

    console.log(
      "MD2File public entry checks passed: retained registry, single V0.4 projection, canonical URL, forced layout visibility, focus exception and precise denials."
    );
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${runtime.output()}`;
    throw error;
  } finally {
    await stopServer(runtime.child);
    safeRemoveTemp(tempRoot);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
