"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const { validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-linear-graph-")) {
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

function cardPayload(id, name = id) {
  const suffix = id.replace(/^formula\./, "").replaceAll(".", "-");
  return validateFormulaCardPayload({
    formulaId: id,
    slug: suffix,
    displayName: name,
    moduleKey: "electronics-basics",
    categoryPath: "推导关系/隔离测试",
    purpose: "验证可汇入且不分叉的手工推导链",
    tags: ["module:electronics-basics", "relation:derivation"],
    latex: `${suffix.replaceAll("-", "_")}=1`,
    revisionReason: "linear-graph-test"
  });
}

function createCards(store, prefix = "formula.graph") {
  const specs = [
    ["source-a", "拓扑来源 A"],
    ["source-b", "拓扑来源 B"],
    ["shared", "共享二阶公式"],
    ["third", "第三阶公式"],
    ["alternate", "备用目标公式"]
  ];
  return Object.fromEntries(
    specs.map(([key, name]) => {
      const card = store.saveFormulaCard(cardPayload(`${prefix}.${key}`, name)).card;
      return [key, card];
    })
  );
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
    if (child.exitCode !== null) throw new Error(`linear graph server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("linear graph server did not become healthy");
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
      ADMIN_USERNAME: "LinearGraphTester",
      ADMIN_PASSWORD: "linear-graph-test-password"
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

  async function mutate(sourceId, body) {
    return request(`/api/admin/formulas/${encodeURIComponent(sourceId)}/derivation`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  try {
    await waitForServer(baseUrl, child);
    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "LinearGraphTester", password: "linear-graph-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const cards = {};
    for (const key of ["source-a", "source-b", "shared", "third", "alternate"]) {
      const formulaId = `formula.api-graph.${key}`;
      const created = await request("/api/admin/formulas", {
        method: "POST",
        body: JSON.stringify(cardPayload(formulaId, `API ${key}`))
      });
      assert.equal(created.response.status, 200);
      cards[key] = created.payload.card;
    }

    assert.equal((await mutate(cards["source-a"].formulaId, { action: "set", targetFormulaId: cards.shared.formulaId })).response.status, 200);
    assert.equal((await mutate(cards["source-b"].formulaId, { action: "set", targetFormulaId: cards.shared.formulaId })).response.status, 200);
    assert.equal((await mutate(cards.shared.formulaId, { action: "set", targetFormulaId: cards.third.formulaId })).response.status, 200);
    assert.equal((await mutate(cards.third.formulaId, { action: "set", targetFormulaId: cards.alternate.formulaId })).response.status, 200);

    const sharedAdmin = await request(`/api/admin/formulas/${encodeURIComponent(cards.shared.formulaId)}`);
    assert.equal(sharedAdmin.payload.card.derivation.incoming.length, 2);
    assert.equal(sharedAdmin.payload.card.derivation.next.formulaId, cards.third.formulaId);
    assert.equal(sharedAdmin.payload.card.derivation.affectedSources.length, 3);

    const sharedPublic = await request(`/api/formulas/${encodeURIComponent(cards.shared.slug)}`);
    assert.equal(sharedPublic.response.status, 200);
    assert.equal(sharedPublic.payload.card.derivation.incoming.length, 2);
    assert.equal(sharedPublic.payload.card.derivation.next.formulaId, cards.third.formulaId);
    assert.equal(Object.hasOwn(sharedPublic.payload.card.derivation.next, "actorUsername"), false);

    const secondNext = await mutate(cards["source-a"].formulaId, {
      action: "set",
      targetFormulaId: cards.alternate.formulaId
    });
    assert.equal(secondNext.response.status, 409);
    assert.match(secondNext.payload.error, /明确|替换|分叉/);
    const replaced = await mutate(cards["source-a"].formulaId, {
      action: "set",
      targetFormulaId: cards.alternate.formulaId,
      replace: true
    });
    assert.equal(replaced.response.status, 200);
    assert.equal(replaced.payload.relation.replaced, true);
    assert.equal(replaced.payload.card.derivation.next.formulaId, cards.alternate.formulaId);
    assert.equal(
      (
        await mutate(cards["source-a"].formulaId, {
          action: "set",
          targetFormulaId: cards.shared.formulaId,
          replace: true
        })
      ).response.status,
      200
    );

    const selfLink = await mutate(cards.shared.formulaId, {
      action: "set",
      targetFormulaId: cards.shared.formulaId,
      replace: true
    });
    assert.equal(selfLink.response.status, 400);

    const missing = await mutate(cards.shared.formulaId, {
      action: "set",
      targetFormulaId: "formula.api-graph.missing",
      replace: true
    });
    assert.equal(missing.response.status, 400);

    const cycle = await mutate(cards.third.formulaId, {
      action: "set",
      targetFormulaId: cards["source-a"].formulaId,
      replace: true
    });
    assert.equal(cycle.response.status, 409);
    const thirdAfterCycle = await request(`/api/admin/formulas/${encodeURIComponent(cards.third.formulaId)}`);
    assert.equal(thirdAfterCycle.payload.card.derivation.next.formulaId, cards.alternate.formulaId);

    const archived = await request(`/api/admin/formulas/${encodeURIComponent(cards.shared.formulaId)}/archive`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(archived.response.status, 200);
    assert.equal(archived.payload.card.derivation.incoming.length, 2);
    assert.equal(archived.payload.card.derivation.next.formulaId, cards.third.formulaId);
    assert.equal(archived.payload.card.derivation.currentArchived, true);
    assert.ok(archived.payload.card.derivation.brokenCount >= 1);
    assert.equal((await request(`/api/formulas/${encodeURIComponent(cards.shared.slug)}`)).response.status, 404);

    const sourcePublic = await request(`/api/formulas/${encodeURIComponent(cards["source-a"].slug)}`);
    assert.equal(sourcePublic.payload.card.derivation.next.formulaId, cards.shared.formulaId);
    assert.equal(sourcePublic.payload.card.derivation.next.available, false);
    const thirdPublic = await request(`/api/formulas/${encodeURIComponent(cards.third.slug)}`);
    const archivedIncoming = thirdPublic.payload.card.derivation.incoming.find(
      (item) => item.formulaId === cards.shared.formulaId
    );
    assert.equal(archivedIncoming.available, false);

    const page = await fetch(`${baseUrl}/derive.html?formula=${encodeURIComponent(cards["source-a"].slug)}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /renderKnowledgeNodePage/);

    const restored = await request(`/api/admin/formulas/${encodeURIComponent(cards.shared.formulaId)}/restore`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(restored.response.status, 200);
    const restoredPublic = await request(`/api/formulas/${encodeURIComponent(cards["source-a"].slug)}`);
    assert.equal(restoredPublic.payload.card.derivation.next.available, true);
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${serverOutput}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-linear-graph-"));
  try {
    const { db, store } = openStore(path.join(tempRoot, "direct-data"));
    try {
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
      assert.ok(db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = '017_linear_derivation_graph'").get()?.ok);
      const cards = createCards(store);
      assert.equal(new Set(Object.values(cards).map((card) => card.formulaId)).size, 5);
      assert.equal(new Set(Object.values(cards).map((card) => card.slug)).size, 5);

      store.saveFormulaDerivation(cards["source-a"].formulaId, {
        action: "set",
        targetFormulaId: cards.shared.formulaId,
        replace: false
      });
      store.saveFormulaDerivation(cards["source-b"].formulaId, {
        action: "set",
        targetFormulaId: cards.shared.formulaId,
        replace: false
      });
      store.saveFormulaDerivation(cards.shared.formulaId, {
        action: "set",
        targetFormulaId: cards.third.formulaId,
        replace: false
      });
      store.saveFormulaDerivation(cards.third.formulaId, {
        action: "set",
        targetFormulaId: cards.alternate.formulaId,
        replace: false
      });
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM formula_derivation_edges").get().count, 4);

      let shared = store.adminFormulaCard(cards.shared.formulaId);
      assert.deepEqual(
        shared.derivation.incoming.map((item) => item.formulaId).sort(),
        [cards["source-a"].formulaId, cards["source-b"].formulaId].sort()
      );
      assert.equal(shared.derivation.next.formulaId, cards.third.formulaId);
      assert.equal(shared.derivation.affectedSources.length, 3);
      assert.equal(store.publicFormulaCardBySlug(cards["source-a"].slug).derivation.next.formulaId, cards.shared.formulaId);
      assert.equal(store.publicFormulaCardBySlug(cards.shared.slug).derivation.next.formulaId, cards.third.formulaId);

      assert.throws(
        () =>
          store.saveFormulaDerivation(cards["source-a"].formulaId, {
            action: "set",
            targetFormulaId: cards.alternate.formulaId,
            replace: false
          }),
        /明确|替换|分叉/
      );
      let sourceA = store.adminFormulaCard(cards["source-a"].formulaId);
      assert.equal(sourceA.derivation.next.formulaId, cards.shared.formulaId);
      const replaced = store.saveFormulaDerivation(cards["source-a"].formulaId, {
        action: "set",
        targetFormulaId: cards.alternate.formulaId,
        replace: true
      });
      assert.equal(replaced.replaced, true);
      assert.equal(replaced.previousTargetId, cards.shared.formulaId);
      assert.equal(replaced.source.derivation.next.formulaId, cards.alternate.formulaId);
      store.saveFormulaDerivation(cards["source-a"].formulaId, {
        action: "set",
        targetFormulaId: cards.shared.formulaId,
        replace: true
      });

      assert.throws(
        () =>
          store.saveFormulaDerivation(cards.shared.formulaId, {
            action: "set",
            targetFormulaId: cards.shared.formulaId,
            replace: true
          }),
        /自身|self/i
      );
      assert.throws(
        () =>
          store.saveFormulaDerivation(cards.shared.formulaId, {
            action: "set",
            targetFormulaId: "formula.graph.missing",
            replace: true
          }),
        /不存在|missing/
      );
      assert.throws(
        () =>
          store.saveFormulaDerivation(cards.third.formulaId, {
            action: "set",
            targetFormulaId: cards["source-a"].formulaId,
            replace: true
          }),
        /循环|cycle/
      );
      assert.equal(store.adminFormulaCard(cards.third.formulaId).derivation.next.formulaId, cards.alternate.formulaId);
      assert.throws(
        () =>
          db
            .prepare(
              `UPDATE formula_derivation_edges
               SET target_formula_id = ?
               WHERE source_formula_id = ?`
            )
            .run(cards.alternate.formulaId, cards.shared.formulaId),
        /explicit|明确|replacement/i
      );

      const archived = store.archiveFormulaCard(cards.shared.formulaId);
      assert.equal(archived.archiveState, "archived");
      assert.equal(archived.derivation.incoming.length, 2);
      assert.equal(archived.derivation.next.formulaId, cards.third.formulaId);
      assert.equal(archived.derivation.currentArchived, true);
      assert.ok(archived.derivation.brokenCount >= 1);
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM formula_derivation_edges").get().count, 4);
      assert.equal(store.publicFormulaCardBySlug(cards.shared.slug), null);
      sourceA = store.publicFormulaCardBySlug(cards["source-a"].slug);
      assert.equal(sourceA.derivation.next.formulaId, cards.shared.formulaId);
      assert.equal(sourceA.derivation.next.available, false);
      const third = store.publicFormulaCardBySlug(cards.third.slug);
      assert.equal(
        third.derivation.incoming.find((item) => item.formulaId === cards.shared.formulaId).available,
        false
      );
      store.restoreFormulaCard(cards.shared.formulaId);
      assert.equal(store.publicFormulaCardBySlug(cards["source-a"].slug).derivation.next.available, true);
    } finally {
      db.close();
    }

    await apiChecks(tempRoot);

    const adminHtml = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    const adminCss = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
    const postJs = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
    const deriveHtml = fs.readFileSync(path.join(ROOT, "derive.html"), "utf8");
    assert.match(adminHtml, /id="formulaDerivationPanel"/);
    assert.match(adminHtml, /id="formulaIncomingSource"/);
    assert.match(adminHtml, /id="formulaNextTarget"/);
    assert.match(adminJs, /formula-derivation/);
    assert.match(adminJs, /明确替换/);
    assert.match(adminJs, /归档后关系历史保留/);
    assert.match(adminCss, /formula-derivation-grid/);
    assert.match(postJs, /推导关系/);
    assert.match(postJs, /formula-derivation-link/);
    assert.match(postJs, /已归档 · 链路中断/);
    assert.match(deriveHtml, /formula-derivation-public-grid/);

    console.log(
      "linear derivation graph checks passed: independent cards, convergence, unique next, explicit replacement, cycle rejection, archive state, API and UI contract"
    );
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
