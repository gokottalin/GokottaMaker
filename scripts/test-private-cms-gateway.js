const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "PrivateCmsTester";
const PASSWORD = "private-cms-test-password";
const PATH_A = "CmsA_" + crypto.randomBytes(36).toString("base64url");
const PATH_B = "CmsB_" + crypto.randomBytes(36).toString("base64url");

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startServer(dataDir, privatePath, port) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_USERNAME: USERNAME,
      ADMIN_PASSWORD: PASSWORD,
      PRIVATE_CMS_PATH: privatePath,
      ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  return { child, output: () => output };
}

async function waitForServer(port, processHandle) {
  for (let index = 0; index < 80; index += 1) {
    if (processHandle.child.exitCode !== null) throw new Error(processHandle.output());
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${processHandle.output()}`);
}

function stopServer(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) return Promise.resolve();
  processHandle.child.kill();
  return new Promise((resolve) => {
    processHandle.child.once("exit", resolve);
    setTimeout(resolve, 2000).unref();
  });
}

async function request(base, pathname, options = {}, session = {}) {
  const headers = { ...(options.headers || {}) };
  if (session.cookie) headers.Cookie = session.cookie;
  const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) session.cookie = setCookie.split(";")[0];
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return { response, text, payload };
}

async function run() {
  const missingProductionPath = spawnSync(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production", PRIVATE_CMS_PATH: "" },
    encoding: "utf8",
    timeout: 10_000
  });
  assert.notEqual(missingProductionPath.status, 0, "production must reject a missing gateway value");
  assert.match(missingProductionPath.stderr, /PRIVATE_CMS_PATH is required/);

  const weakProductionPath = spawnSync(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production", PRIVATE_CMS_PATH: "too-short" },
    encoding: "utf8",
    timeout: 10_000
  });
  assert.notEqual(weakProductionPath.status, 0, "production must reject a weak gateway value");
  assert.match(weakProductionPath.stderr, /48-128 character high-entropy/);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-private-cms-"));
  let processHandle;
  let port;
  try {
    port = await availablePort();
    processHandle = startServer(dataDir, PATH_A, port);
    await waitForServer(port, processHandle);
    let base = `http://127.0.0.1:${port}`;
    const unknown = await request(base, "/definitely-unknown-private-cms-test");

    for (const legacyPath of ["/admin/", "/admin/index.html", "/api/login", "/api/session", "/api/admin/content"]) {
      const result = await request(base, legacyPath, legacyPath === "/api/login" ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD })
      } : {});
      assert.equal(result.response.status, 404, `${legacyPath} must be hidden`);
      assert.equal(result.text, unknown.text, `${legacyPath} must share the unknown 404 template`);
    }

    const wrong = await request(base, `/${PATH_B}/admin/index.html`);
    assert.equal(wrong.response.status, 404);
    assert.equal(wrong.text, unknown.text);

    const insecureDeniedPort = await availablePort();
    const insecureDenied = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
      cwd: ROOT,
      env: {
        ...process.env, NODE_ENV: "test", DATA_DIR: dataDir, HOST: "127.0.0.1",
        PORT: String(insecureDeniedPort), ADMIN_USERNAME: USERNAME, ADMIN_PASSWORD: PASSWORD,
        PRIVATE_CMS_PATH: PATH_A, ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "false"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const deniedHandle = { child: insecureDenied, output: () => "" };
    await waitForServer(insecureDeniedPort, deniedHandle);
    const denied = await request(`http://127.0.0.1:${insecureDeniedPort}`, `/${PATH_A}/admin/index.html`);
    assert.equal(denied.response.status, 404, "plain HTTP is denied without the explicit loopback override");
    const proxiedHttps = await request(`http://127.0.0.1:${insecureDeniedPort}`, `/${PATH_A}/admin/index.html`, {
      headers: { "X-Forwarded-Proto": "https" }
    });
    assert.equal(proxiedHttps.response.status, 200, "trusted loopback reverse-proxy HTTPS must be accepted");
    await stopServer(deniedHandle);

    const entry = await request(base, `/${PATH_A}/admin/index.html`);
    assert.equal(entry.response.status, 200);
    assert.match(entry.text, /LarkixMaker 管理端/);
    assert.equal(entry.response.headers.get("referrer-policy"), "no-referrer");
    assert.match(entry.response.headers.get("cache-control") || "", /no-store/);
    const bareEntry = await request(base, `/${PATH_A}/`);
    assert.equal(bareEntry.response.status, 404, "the gateway value alone must not redirect to the CMS");
    assert.equal(bareEntry.text, unknown.text);

    const anonymousAdmin = await request(base, `/${PATH_A}/api/admin/content`);
    assert.equal(anonymousAdmin.response.status, 404);
    assert.equal(anonymousAdmin.text, unknown.text);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await request(base, `/${PATH_A}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: USERNAME, password: "wrong-password" })
      });
      assert.equal(failed.response.status, 401);
    }
    const blocked = await request(base, `/${PATH_A}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    assert.equal(blocked.response.status, 429, "login failures must remain rate limited");

    await stopServer(processHandle);
    processHandle = null;
    port = await availablePort();
    processHandle = startServer(dataDir, PATH_A, port);
    await waitForServer(port, processHandle);
    base = `http://127.0.0.1:${port}`;

    const session = {};
    const login = await request(base, `/${PATH_A}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    }, session);
    assert.equal(login.response.status, 200);
    assert.ok(login.payload.csrfToken);
    assert.match(login.response.headers.get("set-cookie") || "", /SameSite=Strict/);
    assert.match(login.response.headers.get("set-cookie") || "", new RegExp(`Path=/${PATH_A}(?:;|$)`));
    const cookieName = (login.response.headers.get("set-cookie") || "").split("=", 1)[0];
    assert.ok(!cookieName.includes(PATH_A.slice(0, 12)), "cookie name must not reveal the gateway value");

    const admin = await request(base, `/${PATH_A}/api/admin/content`, {}, session);
    assert.equal(admin.response.status, 200);
    const countsBefore = { posts: admin.payload.posts.length, projects: admin.payload.projects.length };

    const noCsrf = await request(base, `/${PATH_A}/api/logout`, { method: "POST", body: "{}" }, session);
    assert.equal(noCsrf.response.status, 403);
    const legacyAfterLogin = await request(base, "/api/admin/content", {}, session);
    assert.equal(legacyAfterLogin.response.status, 404);
    assert.equal(legacyAfterLogin.text, unknown.text);
    const source = await request(base, `/${PATH_A}/admin/admin.js`);
    assert.equal(source.response.status, 200);
    assert.ok(!source.text.includes(PATH_A));
    assert.ok(!processHandle.output().includes(PATH_A));

    const sqlite = require("node:sqlite");
    const auditDb = new sqlite.DatabaseSync(path.join(dataDir, "database", "gokottamaker.sqlite"));
    const failures = auditDb.prepare("SELECT metadata_json FROM audit_logs WHERE action = 'login_failed'").all();
    assert.ok(failures.length >= 5, "failed logins must be audited");
    assert.ok(failures.every((row) => !String(row.metadata_json || "").includes(PATH_A)), "audit metadata must not contain the gateway value");
    auditDb.close();

    const oldCookie = session.cookie;
    await stopServer(processHandle);
    processHandle = null;
    port = await availablePort();
    processHandle = startServer(dataDir, PATH_B, port);
    await waitForServer(port, processHandle);
    base = `http://127.0.0.1:${port}`;

    const oldPath = await request(base, `/${PATH_A}/admin/index.html`);
    assert.equal(oldPath.response.status, 404);
    const rotatedSession = { cookie: oldCookie };
    const oldSessionAtNewPath = await request(base, `/${PATH_B}/api/admin/content`, {}, rotatedSession);
    assert.equal(oldSessionAtNewPath.response.status, 404, "rotation must invalidate the old gateway cookie namespace");

    const newSession = {};
    const rotatedLogin = await request(base, `/${PATH_B}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    }, newSession);
    assert.equal(rotatedLogin.response.status, 200);
    const rotatedAdmin = await request(base, `/${PATH_B}/api/admin/content`, {}, newSession);
    assert.equal(rotatedAdmin.response.status, 200);
    assert.deepEqual(
      { posts: rotatedAdmin.payload.posts.length, projects: rotatedAdmin.payload.projects.length },
      countsBefore,
      "rotation must preserve CMS content"
    );
    assert.ok(!processHandle.output().includes(PATH_B));
    console.log("Private CMS gateway checks passed: 404 parity, auth, CSRF, HTTPS gate, rotation, data preservation, and secret absence.");
  } finally {
    await stopServer(processHandle);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
