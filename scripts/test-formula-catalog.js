"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const { validateFormulaCardPayload, validateFormulaCatalogPackage } = require("../lib/validators");
const { catalogPackageFromBooks, writeSnapshotFile } = require("../tools/calculation-book/formula-catalog");

const ROOT = path.resolve(__dirname, "..");
const BOOKS = [
  path.join(ROOT, "content/calculation-books/ccm-flyback-reference/calculation-book.json"),
  path.join(ROOT, "content/calculation-books/four-switch-buck-boost-reva/calculation-book.json")
];

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-formula-catalog-")) {
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
    if (child.exitCode !== null) throw new Error(`formula catalog server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("formula catalog server did not become healthy");
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

function acceptedEquationCount() {
  return BOOKS.reduce((total, filename) => {
    const book = JSON.parse(fs.readFileSync(filename, "utf8"));
    return total + book.equations.length;
  }, 0);
}

async function apiChecks(tempRoot, catalog) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = path.join(tempRoot, "api-data");
  const backupDir = path.join(tempRoot, "api-backups");
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      FORMULA_BACKUP_DIR: backupDir,
      ADMIN_USERNAME: "FormulaTester",
      ADMIN_PASSWORD: "formula-test-password"
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
      body: JSON.stringify({ username: "FormulaTester", password: "formula-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;
    assert.ok(cookie);
    assert.ok(csrfToken);

    const empty = await request("/api/admin/formulas");
    assert.equal(empty.response.status, 200);
    assert.equal(empty.payload.requiresCategory, true);
    assert.deepEqual(empty.payload.items, []);

    const imported = await request("/api/admin/formulas/import", {
      method: "POST",
      body: JSON.stringify({ catalog, snapshotName: "api-before-import.json" })
    });
    assert.equal(imported.response.status, 200);
    assert.equal(imported.payload.importedCards, 60);
    assert.equal(imported.payload.totalCards, 60);
    assert.ok(fs.existsSync(path.join(backupDir, "api-before-import.json")));

    const first = catalog.cards[0];
    const selected = await request(
      `/api/admin/formulas?module=${encodeURIComponent(first.moduleKey)}&category=${encodeURIComponent(first.categoryPath)}&page=1&pageSize=2`
    );
    assert.equal(selected.response.status, 200);
    assert.equal(selected.payload.requiresCategory, false);
    assert.equal(selected.payload.pagination.pageSize, 2);
    assert.equal(selected.payload.items.length, 2);

    const publicCard = await request(`/api/formulas/${encodeURIComponent(first.slug)}`);
    assert.equal(publicCard.response.status, 200);
    assert.equal(publicCard.payload.card.slug, first.slug);
    assert.equal(publicCard.payload.card.formulaId, undefined);
    assert.equal(publicCard.payload.card.currentRevisionId, undefined);
    assert.equal(publicCard.payload.card.publishedRevisionId, undefined);
    assert.equal(publicCard.payload.card.revisions, undefined);

    const archived = await request(`/api/admin/formulas/${encodeURIComponent(first.formulaId)}/archive`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(archived.response.status, 200);
    assert.equal(archived.payload.card.archiveState, "archived");
    assert.equal((await request(`/api/formulas/${encodeURIComponent(first.slug)}`)).response.status, 404);
    assert.equal(
      (
        await request(`/api/admin/formulas/${encodeURIComponent(first.formulaId)}/restore`, {
          method: "POST",
          body: "{}"
        })
      ).response.status,
      200
    );

    const exported = await request("/api/admin/formulas/export");
    assert.equal(exported.response.status, 200);
    assert.equal(exported.payload.cards.length, 60);

    const duplicateSnapshot = await request("/api/admin/formulas/import", {
      method: "POST",
      body: JSON.stringify({ catalog, snapshotName: "api-before-import.json" })
    });
    assert.equal(duplicateSnapshot.response.status, 409);
    assert.equal((await request("/api/admin/formulas/export")).payload.cards.length, 60);

    const derivePage = await fetch(`${baseUrl}/derive.html?formula=${encodeURIComponent(first.slug)}`);
    assert.equal(derivePage.status, 200);
    assert.match(await derivePage.text(), /renderKnowledgeNodePage/);
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${serverOutput}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-catalog-"));
  try {
    const catalog = validateFormulaCatalogPackage(catalogPackageFromBooks());
    assert.equal(catalog.cards.length, 60);
    assert.equal(catalog.cards.length, acceptedEquationCount());
    assert.equal(new Set(catalog.cards.map((card) => card.formulaId)).size, 60);
    assert.equal(new Set(catalog.cards.map((card) => card.slug)).size, 60);
    assert.equal(new Set(catalog.cards.flatMap((card) => card.revisions.map((revision) => revision.revisionId))).size, 60);
    assert.equal(new Set(catalog.cards.map((card) => `${card.moduleKey}/${card.categoryPath}`)).size, 9);
    assert.ok(catalog.cards.every((card) => card.revisions.length === 1));
    assert.ok(catalog.cards.every((card) => card.formulaId.includes(card.revisions[0].sourceFormulaId)));
    assert.ok(catalog.cards.every((card) => /\\(?:frac|mathrm|Delta|eta|mu|left|right|sqrt|cdot)/.test(card.revisions[0].latex)));

    const opened = openStore(path.join(tempRoot, "direct-data"));
    const { db, store } = opened;
    try {
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
      assert.ok(db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = '014_formula_catalog'").get()?.ok);
      assert.ok(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'formula_cards'").get()?.ok);

      const imported = store.importFormulaCatalog(catalog, { actor: { username: "formula-test" } });
      assert.deepEqual(imported, {
        importedCards: 60,
        revisionsCreated: 60,
        publicationsCreated: 60,
        totalCards: 60
      });
      const unselected = store.listFormulaCards({});
      assert.equal(unselected.requiresCategory, true);
      assert.deepEqual(unselected.items, []);
      assert.equal(unselected.facets.modules.length, 1);
      assert.equal(unselected.facets.modules.flatMap((module) => module.categories).length, 9);

      const firstCategory = unselected.facets.modules[0].categories[0];
      const selected = store.listFormulaCards({
        moduleKey: "power-electronics",
        categoryPath: firstCategory.categoryPath,
        page: 1,
        pageSize: 2
      });
      assert.equal(selected.pagination.pageSize, 2);
      assert.equal(selected.items.length, 2);
      assert.ok(selected.pagination.pageCount > 1);
      const normalizedPaging = store.listFormulaCards({
        moduleKey: "power-electronics",
        categoryPath: firstCategory.categoryPath,
        page: "not-a-page",
        pageSize: "not-a-size"
      });
      assert.equal(normalizedPaging.pagination.page, 1);
      assert.equal(normalizedPaging.pagination.pageSize, 12);
      const clampedPaging = store.listFormulaCards({
        moduleKey: "power-electronics",
        categoryPath: firstCategory.categoryPath,
        page: 999,
        pageSize: 2
      });
      assert.equal(clampedPaging.pagination.page, clampedPaging.pagination.pageCount);
      assert.ok(clampedPaging.items.length > 0);
      const tagged = store.listFormulaCards({
        moduleKey: "power-electronics",
        categoryPath: firstCategory.categoryPath,
        tag: "book:ccm-flyback-reference"
      });
      assert.ok(tagged.items.length > 0);
      const searched = store.listFormulaCards({
        moduleKey: "power-electronics",
        categoryPath: firstCategory.categoryPath,
        query: tagged.items[0].formulaId
      });
      assert.equal(searched.pagination.total, 1);

      const manual = validateFormulaCardPayload({
        formulaId: "formula.test.output-voltage",
        slug: "test-output-voltage",
        displayName: "测试输出电压",
        moduleKey: "power-electronics",
        categoryPath: "tests/manual",
        purpose: "验证元数据保存与修订生成",
        tags: ["module:power-electronics", "unit:V"],
        latex: "V_{out}=12\\,\\mathrm{V}",
        revisionReason: "test-create"
      });
      const created = store.saveFormulaCard({ ...manual, actor: { username: "formula-test" } });
      assert.equal(created.revisionCreated, true);
      assert.equal(created.card.revisions.length, 1);
      const metadataOnly = store.saveFormulaCard({
        ...manual,
        displayName: "测试输出电压（更新）",
        actor: { username: "formula-test" }
      });
      assert.equal(metadataOnly.revisionCreated, true);
      assert.equal(metadataOnly.card.revisions.length, 2);
      const revised = store.saveFormulaCard({
        ...manual,
        latex: "V_{out}=13\\,\\mathrm{V}",
        revisionReason: "test-revise",
        actor: { username: "formula-test" }
      });
      assert.equal(revised.revisionCreated, true);
      assert.equal(revised.card.revisions.length, 3);
      assert.throws(
        () => db.prepare("UPDATE formula_revisions SET latex = 'changed' WHERE revision_id = ?").run(revised.card.currentRevisionId),
        /immutable/i
      );
      assert.throws(
        () => db.prepare("UPDATE formula_cards SET formula_id = 'formula.test.changed' WHERE formula_id = ?").run(manual.formulaId),
        /immutable/i
      );
      assert.equal(store.archiveFormulaCard(manual.formulaId).archiveState, "archived");
      assert.equal(store.publicFormulaCardBySlug(manual.slug), null);
      assert.equal(store.restoreFormulaCard(manual.formulaId).archiveState, "active");

      const exportA = store.exportFormulaCatalog();
      assert.deepEqual(exportA, store.exportFormulaCatalog());
      const snapshot = path.join(tempRoot, "snapshots", "formula-catalog.json");
      assert.equal(writeSnapshotFile(exportA, snapshot), snapshot);
      assert.throws(() => writeSnapshotFile(exportA, snapshot), /exist|存在|overwrite|覆盖/i);

      const restored = openStore(path.join(tempRoot, "restore-data"));
      try {
        const restoreResult = restored.store.importFormulaCatalog(JSON.parse(fs.readFileSync(snapshot, "utf8")), {
          actor: { username: "formula-restore-test" }
        });
        assert.equal(restoreResult.totalCards, 61);
        assert.deepEqual(restored.store.exportFormulaCatalog(), exportA);
      } finally {
        restored.db.close();
      }
    } finally {
      db.close();
    }

    await apiChecks(tempRoot, catalog);
    const adminHtml = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    const visitorJs = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
    assert.match(adminHtml, /id="formulaCategoryTree"/);
    assert.match(adminHtml, /id="formulaCardEditor"/);
    assert.match(adminJs, /loadFormulaCatalog/);
    assert.match(visitorJs, /api\/formulas/);
    console.log("formula catalog checks passed: 60 cards, 9 categories, CRUD/revisions, archive/restore, paging, snapshots, API and visitor preview");
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
