"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "FormulaCmsConsolidatedTester";
const PASSWORD = "formula-cms-consolidated-password";
const PRIVATE_PATH = `FormulaCms_${crypto.randomBytes(36).toString("base64url")}`;

function formula(id, overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: `formula.cms.${id}`,
    slug: `cms-${id}`,
    displayName: `CMS 公式 ${id}`,
    moduleKey: "power-electronics",
    categoryPath: "CMS验收/依赖",
    purpose: "隔离公式 CMS 合并验收",
    tags: ["scope:cms-test"],
    latex: `V_{${id}}=1`,
    markdownDerivation: "",
    revisionReason: "cms-consolidated-test",
    ...overrides
  });
}

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  assert.ok(resolved.startsWith(`${tempRoot}${path.sep}`));
  assert.ok(path.basename(resolved).startsWith("larkix-formula-cms-consolidated-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startServer(dataDir, port) {
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
      PRIVATE_CMS_PATH: PRIVATE_PATH,
      ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  return { child, output: () => output };
}

async function waitForServer(port, handle) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (handle.child.exitCode !== null) throw new Error(handle.output());
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${handle.output()}`);
}

function stopServer(handle) {
  if (!handle || handle.child.exitCode !== null) return Promise.resolve();
  handle.child.kill();
  return new Promise((resolve) => {
    handle.child.once("exit", resolve);
    setTimeout(resolve, 2000).unref();
  });
}

async function api(base, pathname, options = {}, session = {}) {
  const headers = { ...(options.headers || {}) };
  if (session.cookie) headers.Cookie = session.cookie;
  if (session.csrf && !["GET", "HEAD", "OPTIONS"].includes(String(options.method || "GET").toUpperCase())) {
    headers["X-CSRF-Token"] = session.csrf;
  }
  const response = await fetch(`${base}/${PRIVATE_PATH}${pathname}`, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) session.cookie = setCookie.split(";")[0];
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  return { response, payload, text };
}

function apiFormulaPayload(card, markdownDerivation) {
  return {
    displayName: card.displayName,
    moduleKey: card.moduleKey,
    categoryPath: card.categoryPath,
    purpose: card.purpose,
    tags: card.tags,
    latex: card.latex,
    markdownDerivation,
    revisionReason: "api-boundary-test"
  };
}

function staticUiChecks() {
  const html = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
  const darkCss = fs.readFileSync(path.join(ROOT, "admin/admin-dark.css"), "utf8");
  assert.match(html, /formula-latex-workbench[\s\S]*formulaEditorPreview[\s\S]*name="latex"/);
  assert.match(html, /formula-markdown-workbench[\s\S]*formulaMarkdownPreview[\s\S]*name="markdownDerivation"/);
  assert.match(html, /id="formulaDependencyModule"[\s\S]*id="formulaDependencyCategory"[\s\S]*id="formulaNextTarget"[\s\S]*id="formulaDependencyResults"/);
  assert.match(html, /id="formulaSaveButton" type="submit">保存公式卡/);
  assert.match(css, /\.formula-authoring-split\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.formula-authoring-split,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.formula-save-button\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(darkCss, /\.formula-workbench-preview,[\s\S]*\.formula-dependency-candidate/);
  assert.match(js, /formulaMarkdownPreview\.scrollTop = progress \* previewRange/);
  assert.doesNotMatch(js, /formulaMarkdownPreview\?\.addEventListener\("scroll"/);
  assert.match(js, /field\.value = `\$\{before\}\$\{marker\}\$\{after\}`/);
  assert.match(js, /formulaSavePending = true[\s\S]*\.finally\(\(\) => \{[\s\S]*formulaSavePending = false/);
  const cardRenderer = js.slice(js.indexOf("function renderFormulaCards()"), js.indexOf("function formulaRelationIssueLabel"));
  assert.doesNotMatch(cardRenderer, /<code>\$\{escapeHtml\(card\.formulaId\)\}<\/code>/);
  assert.match(cardRenderer, /data-formula-copy-id=/);
  const copyHandler = js.slice(js.indexOf("async function copyFormulaCatalogId"), js.indexOf("function formulaRelationIssueLabel"));
  assert.match(copyHandler, /navigator\.clipboard\?\.writeText/);
  assert.doesNotMatch(copyHandler, /request\(|mutateFormulaCard|saveFormulaEditor/);
  assert.match(js, /复制失败：\$\{error\.message\}/);
}

async function main() {
  staticUiChecks();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-cms-consolidated-"));
  const dbDir = path.join(tempRoot, "database");
  let handle;
  try {
    const db = createDatabase({
      root: ROOT,
      dataDir: tempRoot,
      dbDir,
      dbPath: path.join(dbDir, "gokottamaker.sqlite"),
      uploadDir: path.join(tempRoot, "uploads")
    });
    const store = createContentStore(db);
    const c = store.saveFormulaCard(formula("c"));
    store.publishFormulaCard(c.card.formulaId);
    const b = store.saveFormulaCard(formula("b", { markdownDerivation: `{{formula-ref:${c.card.formulaId}}}` }));
    store.publishFormulaCard(b.card.formulaId);
    const a = store.saveFormulaCard(formula("a", { markdownDerivation: `{{formula-ref:${b.card.formulaId}}}` }));
    store.publishFormulaCard(a.card.formulaId);
    const draft = store.saveFormulaCard(formula("draft", { displayName: "绝密草稿公式" }));
    const archived = store.saveFormulaCard(formula("archived", { displayName: "绝密归档公式" }));
    store.publishFormulaCard(archived.card.formulaId);
    store.archiveFormulaCard(archived.card.formulaId);
    const pending = store.saveFormulaCard(formula("pending", { displayName: "绝密待修订公式" }));
    store.publishFormulaCard(pending.card.formulaId);
    store.saveFormulaCard(formula("pending", { displayName: "绝密待修订公式", latex: "V_{pending}=2" }));
    db.close();

    const port = await availablePort();
    handle = startServer(tempRoot, port);
    await waitForServer(port, handle);
    const base = `http://127.0.0.1:${port}`;
    const session = {};
    const login = await api(base, "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    }, session);
    assert.equal(login.response.status, 200);
    session.csrf = login.payload.csrfToken;

    const anonymous = await api(base, "/api/admin/formula-dependency-candidates");
    assert.equal(anonymous.response.status, 404);
    const candidates = await api(
      base,
      `/api/admin/formula-dependency-candidates?sourceFormulaId=${encodeURIComponent(c.card.formulaId)}&pageSize=50`,
      {},
      session
    );
    assert.equal(candidates.response.status, 200);
    assert.ok(candidates.payload.items.every((item) => Object.keys(item).sort().join(",") === "categoryPath,disabled,disabledReason,displayName,formulaId,latex,moduleKey"));
    const byId = new Map(candidates.payload.items.map((item) => [item.formulaId, item]));
    assert.equal(byId.get(c.card.formulaId).disabledReason, "当前公式不能依赖自身");
    assert.equal(byId.get(a.card.formulaId).disabledReason, "选择后会形成间接循环依赖");
    for (const hidden of [draft.card.formulaId, archived.card.formulaId, pending.card.formulaId, "绝密草稿公式", "绝密归档公式", "绝密待修订公式"]) {
      assert.ok(!candidates.text.includes(hidden), `candidate response leaked ${hidden}`);
    }

    for (const term of ["CMS 公式 a", a.card.formulaId.slice(8, 19), "CMS验收/依赖"]) {
      const searched = await api(base, `/api/admin/formula-dependency-candidates?q=${encodeURIComponent(term)}&pageSize=50`, {}, session);
      assert.equal(searched.response.status, 200);
      assert.ok(searched.payload.items.some((item) => item.formulaId === a.card.formulaId), `OR search missed ${term}`);
      assert.ok(!searched.text.includes(draft.card.formulaId));
    }
    const categoryBrowse = await api(
      base,
      `/api/admin/formula-dependency-candidates?module=power-electronics&category=${encodeURIComponent("CMS验收/依赖")}&pageSize=50`,
      {},
      session
    );
    assert.equal(categoryBrowse.response.status, 200);
    assert.ok(categoryBrowse.payload.items.every((item) => item.categoryPath === "CMS验收/依赖"));
    for (const hiddenName of ["绝密草稿公式", "绝密归档公式", "绝密待修订公式"]) {
      const hiddenSearch = await api(
        base,
        `/api/admin/formula-dependency-candidates?q=${encodeURIComponent(hiddenName)}&pageSize=50`,
        {},
        session
      );
      assert.equal(hiddenSearch.response.status, 200);
      assert.equal(hiddenSearch.payload.pagination.total, 0);
      assert.equal(hiddenSearch.payload.items.length, 0);
    }

    const before = await api(base, `/api/admin/formulas/${encodeURIComponent(c.card.formulaId)}`, {}, session);
    const beforeSnapshot = {
      revisionIds: before.payload.card.revisions.map((item) => item.revisionId),
      markdown: before.payload.card.markdownDerivation,
      dependencies: before.payload.card.derivation.dependencies.map((item) => item.formulaId)
    };
    const illegalTargets = [
      c.card.formulaId,
      a.card.formulaId,
      draft.card.formulaId,
      archived.card.formulaId,
      pending.card.formulaId,
      "formula.cms.missing"
    ];
    for (const target of illegalTargets) {
      const rejected = await api(base, `/api/admin/formulas/${encodeURIComponent(c.card.formulaId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiFormulaPayload(before.payload.card, `{{formula-ref:${target}}}`))
      }, session);
      assert.ok([400, 409].includes(rejected.response.status), `${target} was not rejected`);
      const after = await api(base, `/api/admin/formulas/${encodeURIComponent(c.card.formulaId)}`, {}, session);
      assert.deepEqual(
        {
          revisionIds: after.payload.card.revisions.map((item) => item.revisionId),
          markdown: after.payload.card.markdownDerivation,
          dependencies: after.payload.card.derivation.dependencies.map((item) => item.formulaId)
        },
        beforeSnapshot,
        `illegal dependency ${target} changed formula state`
      );
    }

    const manual = await api(base, "/api/admin/formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "合法手工引用",
        moduleKey: "power-electronics",
        categoryPath: "CMS验收/依赖",
        purpose: "验证合法手工 formula-ref",
        tags: ["scope:cms-test"],
        latex: "V_{manual}=1",
        markdownDerivation: `前文 {{formula-ref:${c.card.formulaId}}} 后文`,
        revisionReason: "manual-reference"
      })
    }, session);
    assert.equal(manual.response.status, 200);
    assert.equal(manual.payload.card.markdownDerivation, `前文 {{formula-ref:${c.card.formulaId}}} 后文`);
    assert.equal(manual.payload.card.derivation.dependencies[0].formulaId, c.card.formulaId);
    console.log("formula CMS consolidated checks passed: UI contract, published-only picker, OR search, cycle/status atomic gates, and manual compatibility");
  } finally {
    await stopServer(handle);
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
