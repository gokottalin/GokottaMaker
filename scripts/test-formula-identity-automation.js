"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  sourceTextHash,
  validateFormulaBusinessPayload,
  validateFormulaCardPayload,
  validateFormulaClassificationPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-formula-identity-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function openStore(dataDir) {
  const dbDir = path.join(dataDir, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir,
    dbDir,
    dbPath: path.join(dbDir, "gokottamaker.sqlite"),
    uploadDir: path.join(dataDir, "uploads")
  });
  return { db, store: createContentStore(db) };
}

function classification(kind, displayName, parentSlug = "") {
  return validateFormulaClassificationPayload({
    kind,
    displayName,
    parentSlug,
    confirmCreate: true
  });
}

function businessPayload(overrides = {}) {
  return validateFormulaBusinessPayload({
    displayName: "BOOST 输出电压",
    moduleKey: "identity-test",
    categoryPath: "自动标识/冲突",
    purpose: "验证服务端技术标识分配",
    tags: [],
    latex: "V_{out}=V_{in}/(1-D)",
    markdownDerivation: "## 推导\n\n我采用伏秒平衡。",
    revisionReason: "identity-test",
    ...overrides
  });
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
    if (child.exitCode !== null) throw new Error(`identity test server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("identity test server did not become healthy");
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
      ADMIN_USERNAME: "FormulaIdentityTester",
      ADMIN_PASSWORD: "formula-identity-test-password",
      ALLOW_LEGACY_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

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
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    await waitForServer(baseUrl, child);
    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "FormulaIdentityTester", password: "formula-identity-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const editedLegacy = await request("/api/admin/formulas/formula.legacy.keep", {
      method: "PUT",
      body: JSON.stringify(businessPayload({ displayName: "旧公式新名称", latex: "V=2" }))
    });
    assert.equal(editedLegacy.response.status, 200);
    assert.equal(editedLegacy.payload.card.formulaId, "formula.legacy.keep");
    assert.equal(editedLegacy.payload.card.slug, "legacy-keep");

    const first = await request("/api/admin/formulas", {
      method: "POST",
      body: JSON.stringify(businessPayload())
    });
    assert.equal(first.response.status, 200);
    const baseSlug = first.payload.card.slug;
    assert.match(first.payload.card.formulaId, /^formula\.user\./);

    const concurrent = await Promise.all(
      Array.from({ length: 3 }, () => request("/api/admin/formulas", {
        method: "POST",
        body: JSON.stringify(businessPayload())
      }))
    );
    assert.ok(concurrent.every((result) => result.response.status === 200));
    const concurrentSlugs = new Set(concurrent.map((result) => result.payload.card.slug));
    assert.deepEqual(concurrentSlugs, new Set([`${baseSlug}-2`, `${baseSlug}-3`, `${baseSlug}-4`]));

    const selectedText = "$$\nV_{out}=V_{in}/(1-D)\n$$";
    const selectionPost = {
      id: "identity-selection-post",
      slug: "identity-selection-post",
      title: "身份分配选区测试",
      category: "模拟电子",
      excerpt: "隔离验证",
      markdown: `前文。\n\n${selectedText}\n\n后文。`,
      cover: "./assets/covers/analog-cover.png",
      publishStatus: "draft",
      featured: false,
      featuredOrder: 0,
      recommendationPriority: 100,
      tags: "公式测试"
    };
    const selectionStart = selectionPost.markdown.indexOf(selectedText);
    const fromSelection = await request("/api/admin/formulas/from-selection", {
      method: "POST",
      body: JSON.stringify({
        post: selectionPost,
        sourceHash: sourceTextHash(selectionPost.markdown),
        baseSourceHash: "",
        selectionStart,
        selectionEnd: selectionStart + selectedText.length,
        formula: {
          displayName: "BOOST 输出电压",
          moduleKey: "identity-test",
          categoryPath: "自动标识/冲突",
          purpose: "验证服务端技术标识分配",
          tags: []
        }
      })
    });
    assert.equal(fromSelection.response.status, 200);
    assert.equal(fromSelection.payload.card.slug, `${baseSlug}-5`);

    for (const injected of [
      { formulaId: "formula.attacker.override" },
      { formula_id: "formula.attacker.override" },
      { slug: "attacker-override" }
    ]) {
      const rejected = await request("/api/admin/formulas", {
        method: "POST",
        body: JSON.stringify({ ...businessPayload({ displayName: "注入测试" }), ...injected })
      });
      assert.equal(rejected.response.status, 400);
      assert.equal(rejected.payload.reasonCode, "FORMULA_IDENTITY_SERVER_OWNED");
    }

    const updateInjection = await request(`/api/admin/formulas/${encodeURIComponent(first.payload.card.formulaId)}`, {
      method: "PUT",
      body: JSON.stringify({ ...businessPayload(), slug: "changed-by-author" })
    });
    assert.equal(updateInjection.response.status, 400);
    assert.equal(updateInjection.payload.reasonCode, "FORMULA_IDENTITY_SERVER_OWNED");
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${serverOutput}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-identity-"));
  try {
    const { db, store } = openStore(tempRoot);
    store.saveFormulaClassification(classification("module", "Identity Test"), { allowLikelyDuplicate: true });
    store.saveFormulaClassification(classification("category", "自动标识/冲突", "identity-test"), { allowLikelyDuplicate: true });
    store.saveFormulaCard(validateFormulaCardPayload({
      ...businessPayload(),
      formulaId: "formula.legacy.keep",
      slug: "legacy-keep"
    }));
    db.close();

    await runApiTest(tempRoot);

    const html = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
    const form = html.match(/<form class="formula-card-editor"[\s\S]*?<\/form>/)?.[0] || "";
    assert.ok(form);
    assert.doesNotMatch(form, /name="formulaId"|name="formula_id"|name="slug"/);
    assert.match(form, /id="formulaTechnicalInfo"[^>]*hidden/);
    assert.equal((form.match(/data-formula-copy=/g) || []).length, 2);
    assert.match(form, /id="formulaTechnicalId" tabindex="0"/);
    assert.match(form, /id="formulaTechnicalSlug" tabindex="0"/);

    const adminScript = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    assert.match(adminScript, /method: editingId \? "PUT" : "POST"/);
    assert.match(adminScript, /FORMULA_IDENTITY_SERVER_OWNED|data-formula-copy|copyFormulaTechnicalValue/);
    console.log("Formula identity automation tests passed.");
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
