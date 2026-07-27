"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { createContentStore, formulaBindingShortcode } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const { validateFormulaCardPayload, validatePostPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-formula-version-")) {
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

function cardPayload(overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: "formula.version.shared",
    slug: "version-shared",
    displayName: "共享版本公式",
    moduleKey: "power-electronics",
    categoryPath: "版本测试/共享",
    purpose: "验证逐篇版本处理",
    tags: ["module:power-electronics", "unit:V"],
    latex: "V=1",
    revisionReason: "version-test",
    ...overrides
  });
}

function postPayload(id, markdown) {
  return validatePostPayload({
    id,
    slug: id,
    title: `版本文章 ${id}`,
    category: "模拟电子",
    excerpt: "隔离版本测试",
    markdown,
    cover: "./assets/covers/analog-cover.png",
    publishStatus: "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 100,
    tags: "版本测试"
  });
}

function loadRenderer() {
  const source = fs.readFileSync(path.join(ROOT, "data/markdown-renderer.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LarkixMarkdown;
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
    if (child.exitCode !== null) throw new Error(`formula version server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("formula version server did not become healthy");
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function apiChecks(tempRoot) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: path.join(tempRoot, "api-data"),
      FORMULA_BACKUP_DIR: path.join(tempRoot, "api-backups"),
      ADMIN_USERNAME: "FormulaVersionTester",
      ADMIN_PASSWORD: "formula-version-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });

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
      body: JSON.stringify({ username: "FormulaVersionTester", password: "formula-version-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const created = await request("/api/admin/formulas", {
      method: "POST",
      body: JSON.stringify(cardPayload({ formulaId: "formula.api.version", slug: "api-version" }))
    });
    assert.equal(created.response.status, 200);
    const oldRevisionId = created.payload.card.currentRevisionId;
    for (const suffix of ["one", "two"]) {
      const binding = formulaBindingShortcode({
        bindingId: `bind.api-${suffix}`,
        formulaId: created.payload.card.formulaId,
        revisionId: oldRevisionId,
        displayMode: "inline"
      });
      const saved = await request("/api/posts", {
        method: "POST",
        body: JSON.stringify(postPayload(`api-version-${suffix}`, `固定引用 ${binding}`))
      });
      assert.equal(saved.response.status, 200);
    }

    const revised = await request("/api/admin/formulas", {
      method: "POST",
      body: JSON.stringify(
        cardPayload({
          formulaId: "formula.api.version",
          slug: "api-version",
          latex: "V=2",
          revisionReason: "api-update"
        })
      )
    });
    assert.equal(revised.response.status, 200);
    assert.equal(revised.payload.decisionCount, 2);
    const newRevisionId = revised.payload.card.currentRevisionId;

    const pending = await request("/api/admin/formula-decisions");
    assert.equal(pending.response.status, 200);
    assert.equal(pending.payload.decisions.length, 2);
    assert.ok(pending.payload.decisions.every((item) => item.boundRevisionId === oldRevisionId));

    const publicContent = await request("/api/content");
    assert.equal(publicContent.response.status, 200);
    assert.equal(Object.hasOwn(publicContent.payload, "formulaReferenceDecisions"), false);
    const publicBound = publicContent.payload.posts.find((post) => post.id === "api-version-one");
    assert.equal(publicBound.formulaBindings[0].revisionId, oldRevisionId);

    const kept = await request(
      `/api/admin/formula-decisions/${encodeURIComponent(pending.payload.decisions[0].decisionId)}/resolve`,
      { method: "POST", body: JSON.stringify({ action: "keep" }) }
    );
    assert.equal(kept.response.status, 200);
    assert.equal(kept.payload.decision.status, "kept");
    assert.equal(kept.payload.decisions.length, 1);

    const adopted = await request(
      `/api/admin/formula-decisions/${encodeURIComponent(pending.payload.decisions[1].decisionId)}/resolve`,
      { method: "POST", body: JSON.stringify({ action: "adopt" }) }
    );
    assert.equal(adopted.response.status, 200);
    assert.equal(adopted.payload.decision.status, "adopted");
    assert.equal(adopted.payload.binding.revisionId, newRevisionId);
    assert.equal(adopted.payload.decisions.length, 0);
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${serverOutput}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-version-"));
  try {
    const { db, store } = openStore(path.join(tempRoot, "direct-data"));
    try {
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
      assert.ok(db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = '016_formula_reference_decisions'").get()?.ok);

      let savedCard = store.saveFormulaCard(cardPayload());
      const originalRevisionId = savedCard.card.currentRevisionId;
      const bindings = [];
      for (const suffix of ["keep", "adopt", "clone"]) {
        const binding = {
          bindingId: `bind.direct-${suffix}`,
          formulaId: savedCard.card.formulaId,
          revisionId: originalRevisionId,
          displayMode: suffix === "adopt" ? "display" : "inline"
        };
        bindings.push(binding);
        const shortcode = formulaBindingShortcode(binding);
        store.savePost(postPayload(`direct-${suffix}`, binding.displayMode === "display" ? `${shortcode}\n` : `固定引用 ${shortcode}`));
      }

      const metadataSteps = [
        { displayName: "共享版本公式（改名）" },
        { moduleKey: "electronics-basics" },
        { categoryPath: "版本测试/新分类" },
        { purpose: "更新后的用途说明" },
        { tags: ["module:electronics-basics", "unit:V"] }
      ];
      let metadataCard = cardPayload();
      for (const step of metadataSteps) {
        metadataCard = cardPayload({ ...metadataCard, ...step });
        const metadataSaved = store.saveFormulaCard(metadataCard);
        assert.equal(metadataSaved.decisionCount, 0);
        assert.equal(store.listFormulaReferenceDecisions().length, 0);
      }

      savedCard = store.saveFormulaCard(cardPayload({ ...metadataCard, latex: "V=2", revisionReason: "body-update-1" }));
      const secondRevisionId = savedCard.card.currentRevisionId;
      assert.notEqual(secondRevisionId, originalRevisionId);
      assert.equal(savedCard.decisionCount, 3);
      assert.equal(store.listFormulaReferenceDecisions().length, 3);
      assert.ok(store.listFormulaReferenceDecisions().every((item) => item.boundRevisionId === originalRevisionId));
      for (const postId of ["direct-keep", "direct-adopt", "direct-clone"]) {
        assert.equal(store.postById(postId).formulaBindings[0].revisionId, originalRevisionId);
      }

      savedCard = store.saveFormulaCard(cardPayload({ ...metadataCard, latex: "V=3", revisionReason: "body-update-2" }));
      const newestRevisionId = savedCard.card.currentRevisionId;
      assert.equal(savedCard.decisionCount, 3);
      assert.equal(store.listFormulaReferenceDecisions().length, 3);
      const historyAfterSecondUpdate = store.listFormulaReferenceDecisions({ status: "all" });
      assert.equal(historyAfterSecondUpdate.length, 6);
      assert.equal(historyAfterSecondUpdate.filter((item) => item.status === "superseded").length, 3);
      assert.ok(store.listFormulaReferenceDecisions().every((item) => item.targetRevisionId === newestRevisionId));

      const keepDecision = store.listFormulaReferenceDecisions({ postId: "direct-keep" })[0];
      const kept = store.resolveFormulaReferenceDecision(keepDecision.decisionId, { action: "keep" });
      assert.equal(kept.decision.status, "kept");
      assert.equal(kept.binding.revisionId, originalRevisionId);

      const adoptDecision = store.listFormulaReferenceDecisions({ postId: "direct-adopt" })[0];
      const adopted = store.resolveFormulaReferenceDecision(adoptDecision.decisionId, { action: "adopt" });
      assert.equal(adopted.decision.status, "adopted");
      assert.equal(adopted.binding.bindingId, bindings[1].bindingId);
      assert.equal(adopted.binding.revisionId, newestRevisionId);
      assert.match(adopted.post.markdown, new RegExp(newestRevisionId.replaceAll(".", "\\.")));

      const cloneDecision = store.listFormulaReferenceDecisions({ postId: "direct-clone" })[0];
      const cloned = store.resolveFormulaReferenceDecision(cloneDecision.decisionId, {
        action: "clone",
        formula: cardPayload({
          formulaId: "formula.version.cloned",
          slug: "version-cloned",
          displayName: "逐篇另建公式",
          moduleKey: "electronics-basics",
          categoryPath: "版本测试/另建",
          purpose: "只供 clone 文章使用",
          tags: ["module:electronics-basics"],
          latex: "V_{clone}=3"
        })
      });
      assert.equal(cloned.decision.status, "cloned");
      assert.equal(cloned.binding.bindingId, bindings[2].bindingId);
      assert.equal(cloned.binding.formulaId, "formula.version.cloned");
      assert.equal(store.listFormulaReferenceDecisions().length, 0);

      assert.throws(
        () =>
          db
            .prepare("UPDATE formula_reference_decisions SET target_revision_id = ? WHERE decision_id = ?")
            .run(secondRevisionId, keepDecision.decisionId),
        /identity is immutable/
      );

      const archived = store.archiveFormulaCard(savedCard.card.formulaId);
      assert.equal(archived.archiveState, "archived");
      assert.equal(archived.decisionCount, 2);
      assert.equal(store.listFormulaReferenceDecisions().length, 2);
      assert.equal(store.archiveFormulaCard(savedCard.card.formulaId).decisionCount, 0);
      assert.equal(store.postById("direct-keep").formulaBindings[0].revisionId, originalRevisionId);
      assert.equal(store.postById("direct-adopt").formulaBindings[0].revisionId, newestRevisionId);
      assert.ok(store.postById("direct-keep").formulaBindings[0].archivedAt);

      const renderer = loadRenderer();
      const keepPost = store.postById("direct-keep");
      const rendered = renderer.render(keepPost.markdown, { formulaBindings: keepPost.formulaBindings });
      assert.match(rendered.html, new RegExp(`data-formula-revision-id="${originalRevisionId.replaceAll(".", "\\.")}"`));
      assert.doesNotMatch(rendered.html, /待决|decision/i);

      const metadataAfterArchive = store.saveFormulaCard(
        cardPayload({ ...metadataCard, latex: "V=3", displayName: "归档后元数据同步" })
      );
      assert.equal(metadataAfterArchive.decisionCount, 0);
      assert.equal(store.listFormulaReferenceDecisions().length, 2);
    } finally {
      db.close();
    }

    await apiChecks(tempRoot);

    const adminHtml = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    const adminCss = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
    assert.match(adminHtml, /id="formulaDecisionPanel"/);
    assert.match(adminJs, /formulaReferenceDecisions/);
    assert.match(adminJs, /formula-decisions/);
    assert.match(adminJs, /data-formula-decision-action="keep"/);
    assert.match(adminJs, /data-formula-decision-action="adopt"/);
    assert.match(adminJs, /data-formula-decision-action="clone"/);
    assert.match(adminCss, /formula-decision-panel/);
    assert.match(adminCss, /#fff3c4|rgba\(245,\s*190,\s*35/i);

    console.log(
      "formula reference versioning checks passed: metadata sync, per-article decisions, old rendering, keep/adopt/clone, archive, API and CMS contract"
    );
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
