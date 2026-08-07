"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  applyDisposableRelationMigration,
  dryRunRelationMigration,
  relationInventory
} = require("../lib/legacy-formula-relation-migration");
const {
  DISPOSABLE_PREFIX,
  assertDisposableFixture,
  createDisposableFixture,
  sha256,
  stableStringify
} = require("../lib/legacy-formula-migration");

const ROOT = path.resolve(__dirname, "..");

function openFixture() {
  const { fixtureDir } = createDisposableFixture();
  const dbDir = path.join(fixtureDir, "database");
  const dbPath = path.join(dbDir, "formula-relation-fixture.sqlite");
  const db = createDatabase({
    root: ROOT,
    dataDir: fixtureDir,
    dbDir,
    dbPath,
    uploadDir: path.join(fixtureDir, "uploads")
  });
  return { fixtureDir, dbDir, dbPath, db };
}

function removeFixture(fixtureDir) {
  assertDisposableFixture(fixtureDir);
  const resolved = path.resolve(fixtureDir);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert.ok(path.basename(resolved).startsWith(DISPOSABLE_PREFIX));
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

function seedNode(db, id, slug = id) {
  db.prepare(
    `INSERT INTO knowledge_nodes
      (id, slug, node_type, symbol, title, summary, markdown, cover, accent_color,
       tags, publish_status, visibility_status)
     VALUES (?, ?, 'derivation', ?, ?, 'fixture', '# Legacy fixture', '', 'blue',
             '', 'published', 'public')`
  ).run(id, slug, id, id);
}

function seedLink(db, sourceId, targetSlug, ordinal = 0, linkKind = "derive") {
  db.prepare(
    `INSERT INTO knowledge_links
      (source_type, source_id, source_slug, target_slug, label, color_token, link_kind, ordinal)
     VALUES ('knowledge_node', ?, ?, ?, 'fixture', 'blue', ?, ?)`
  ).run(sourceId, sourceId, targetSlug, linkKind, ordinal);
  return Number(db.prepare("SELECT last_insert_rowid() AS id").get().id);
}

function seedMapping(db, sourceNodeId, formulaId) {
  db.prepare(
    `INSERT INTO legacy_formula_mappings
      (source_table, source_key, source_digest, disposition, target_kind,
       target_ids_json, reason, report_digest)
     VALUES ('knowledge_nodes', ?, ?, 'mapped', 'formula_card', ?, 'fixture', ?)`
  ).run(
    sourceNodeId,
    sha256(`source:${sourceNodeId}`),
    stableStringify([formulaId]),
    sha256(`report:${sourceNodeId}`)
  );
}

function seedFormula(db, options) {
  const formulaId = options.formulaId;
  const slug = options.slug || formulaId.replace(/^formula\./, "").replaceAll(".", "-");
  const revisionId = options.revisionId || `rev.${formulaId}.fixture`;
  const status = options.status || "draft";
  db.prepare(
    `INSERT INTO formula_cards
      (formula_id, slug, display_name, module_key, category_path, purpose,
       publish_status, current_revision_id, published_revision_id)
     VALUES (?, ?, ?, 'electronics-basics', '关系恢复/隔离测试', '', 'draft', NULL, NULL)`
  ).run(formulaId, slug, options.displayName || formulaId);
  db.prepare(
    `INSERT INTO formula_revisions
      (revision_id, formula_id, sequence_no, latex, markdown_derivation,
       display_name, module_key, category_path, purpose, tags_json,
       revision_reason, source_formula_id, actor_username)
     VALUES (?, ?, 1, ?, ?, ?, 'electronics-basics', '关系恢复/隔离测试', '', '[]',
             'relation-fixture', ?, 'RelationFixture')`
  ).run(
    revisionId,
    formulaId,
    options.latex || `${slug.replaceAll("-", "_")}=1`,
    options.markdown || `## ${formulaId}`,
    options.displayName || formulaId,
    options.sourceFormulaId || ""
  );
  if (status === "published") {
    db.prepare(
      `INSERT INTO formula_revision_publications
        (revision_id, formula_id, actor_username)
       VALUES (?, ?, 'RelationFixture')`
    ).run(revisionId, formulaId);
  }
  db.prepare(
    `UPDATE formula_cards
     SET current_revision_id = ?, published_revision_id = ?, publish_status = ?,
         archived_at = CASE WHEN ? = 'archived' THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE formula_id = ?`
  ).run(revisionId, status === "published" ? revisionId : null, status, status, formulaId);
  return { formulaId, slug, revisionId };
}

function seedBinding(db, card) {
  db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, excerpt, cover, markdown,
       read_time, date, publish_status, featured, featured_order, tags)
     VALUES ('post-relation-fixture', 'post-relation-fixture', 'Relation fixture',
             '电子基础', 'electronics-basics', '', '', '', '1 分钟', '2026-08-01',
             'draft', 0, 0, '')`
  ).run();
  db.prepare(
    `INSERT INTO article_formula_bindings
      (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
     VALUES ('binding.relation.fixture', 'post-relation-fixture', ?, ?, 'display', 0)`
  ).run(card.formulaId, card.revisionId);
}

function seedEvidence(db) {
  const leaf = seedFormula(db, { formulaId: "formula.path.leaf" });
  const stableTarget = seedFormula(db, {
    formulaId: "formula.target.stable",
    markdown: `{{formula-ref:${leaf.formulaId}}}`
  });
  const stableSource = seedFormula(db, {
    formulaId: "formula.source.stable",
    markdown: `{{formula-ref:${stableTarget.formulaId}}}`
  });
  seedBinding(db, stableSource);

  seedNode(db, "legacy-source");
  seedNode(db, "legacy-target");
  const legacyTarget = seedFormula(db, {
    formulaId: "formula.target.legacy",
    sourceFormulaId: "legacy-target"
  });
  const legacySource = seedFormula(db, {
    formulaId: "formula.source.legacy",
    sourceFormulaId: "legacy-source",
    markdown: "{{derive:legacy-target|Legacy target|blue}}"
  });
  seedMapping(db, "legacy-source", legacySource.formulaId);
  seedMapping(db, "legacy-target", legacyTarget.formulaId);
  seedLink(db, "legacy-source", "legacy-target");
  const orphanLinkId = seedLink(db, "legacy-no-source", "legacy-target");
  const ignoredLinkId = seedLink(db, "legacy-no-source", "legacy-target", 1, "reference");

  seedNode(db, "legacy-conflict-source");
  const conflictTarget = seedFormula(db, { formulaId: "formula.target.conflict" });
  const conflictSource = seedFormula(db, {
    formulaId: "formula.source.conflict",
    sourceFormulaId: "legacy-conflict-source",
    markdown: `{{formula-ref:${stableTarget.formulaId}}}`
  });
  seedMapping(db, "legacy-conflict-source", conflictSource.formulaId);
  seedLink(db, "legacy-conflict-source", conflictTarget.slug);

  seedFormula(db, { formulaId: "formula.ambiguous.one", sourceFormulaId: "legacy-shared" });
  seedFormula(db, { formulaId: "formula.ambiguous.two", sourceFormulaId: "legacy-shared" });
  seedFormula(db, {
    formulaId: "formula.source.ambiguous",
    markdown: "{{derive:legacy-shared|Shared|blue}}"
  });
  seedFormula(db, {
    formulaId: "formula.source.missing",
    markdown: "{{derive:legacy-ghost|Ghost|blue}}"
  });
  seedFormula(db, {
    formulaId: "formula.source.duplicate",
    markdown:
      "{{derive:legacy-target|Legacy target|blue}}\n{{derive:legacy-target|Again|green}}"
  });
  seedFormula(db, {
    formulaId: "formula.source.self",
    sourceFormulaId: "legacy-self",
    markdown: "{{derive:legacy-self|Self|red}}"
  });
  seedFormula(db, {
    formulaId: "formula.cycle.a",
    sourceFormulaId: "legacy-cycle-a",
    markdown: "{{derive:legacy-cycle-b|B|blue}}"
  });
  seedFormula(db, {
    formulaId: "formula.cycle.b",
    sourceFormulaId: "legacy-cycle-b",
    markdown: "{{derive:legacy-cycle-a|A|blue}}"
  });
  seedFormula(db, {
    formulaId: "formula.target.archived",
    sourceFormulaId: "legacy-archived",
    status: "archived"
  });
  seedFormula(db, {
    formulaId: "formula.source.archived-target",
    markdown: "{{derive:legacy-archived|Archived|blue}}"
  });
  return {
    leaf,
    stableTarget,
    stableSource,
    legacyTarget,
    legacySource,
    conflictTarget,
    conflictSource,
    orphanLinkId,
    ignoredLinkId
  };
}

function dependencyPath(db, sourceFormulaId) {
  return db
    .prepare(
      `WITH RECURSIVE path(formula_id, depth) AS (
         SELECT ?, 0
         UNION ALL
         SELECT dependency.target_formula_id, path.depth + 1
         FROM path
         JOIN formula_cards card ON card.formula_id = path.formula_id
         JOIN formula_revision_dependencies dependency
           ON dependency.revision_id = card.current_revision_id
       )
       SELECT formula_id AS formulaId, depth FROM path ORDER BY depth ASC, formula_id ASC`
    )
    .all(sourceFormulaId);
}

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function startFixtureServer(fixtureDir, dbPath) {
  const port = await availablePort();
  const child = childProcess.spawn(process.execPath, ["--experimental-sqlite", path.join(ROOT, "server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: fixtureDir,
      DB_PATH: dbPath,
      PORT: String(port),
      HOST: "127.0.0.1",
      ADMIN_PASSWORD: "fixture-only-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server start timeout\n${output}`)), 10000);
    const poll = setInterval(() => {
      if (output.includes("LarkixMaker running at")) {
        clearTimeout(timeout);
        clearInterval(poll);
        resolve();
      } else if (child.exitCode !== null) {
        clearTimeout(timeout);
        clearInterval(poll);
        reject(new Error(`server exited before ready\n${output}`));
      }
    }, 25);
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill();
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

async function apiChecks(fixture, evidence, repairId) {
  const server = await startFixtureServer(fixture.fixtureDir, fixture.dbPath);
  try {
    const login = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Larkix", password: "fixture-only-password" })
    });
    assert.equal(login.status, 200);
    const loginPayload = await login.json();
    const cookie = String(login.headers.get("set-cookie") || "").split(";")[0];
    assert.ok(cookie.startsWith("gokottamaker_session="));
    const adminHeaders = { Cookie: cookie, "X-CSRF-Token": loginPayload.csrfToken };
    const queueResponse = await fetch(
      `${server.baseUrl}/api/admin/formula-relation-repairs?status=pending`,
      { headers: adminHeaders }
    );
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json();
    assert.ok(queue.repairs.some((repair) => repair.repairId === repairId));

    const resolveResponse = await fetch(
      `${server.baseUrl}/api/admin/formula-relation-repairs/${encodeURIComponent(repairId)}/events`,
      {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "resolved",
          targetFormulaId: evidence.stableTarget.formulaId,
          note: "API fixture verified the stored immutable dependency"
        })
      }
    );
    assert.equal(resolveResponse.status, 200, await resolveResponse.text());

    const publicResponse = await fetch(
      `${server.baseUrl}/api/formulas/${encodeURIComponent(evidence.stableSource.slug)}`
    );
    assert.equal(publicResponse.status, 200);
    const publicPayload = await publicResponse.json();
    assert.deepEqual(
      publicPayload.card.derivation.dependencies.map((item) => item.slug),
      [evidence.stableTarget.slug]
    );
    assert.equal("formulaId" in publicPayload.card.derivation.dependencies[0], false);
    assert.equal("evidence" in publicPayload.card.derivation.dependencies[0], false);
  } finally {
    await server.stop();
  }
}

async function main() {
  const fixture = openFixture();
  let db = fixture.db;
  try {
    const evidence = seedEvidence(db);
    const before = relationInventory(db);
    const bindingBefore = db
      .prepare("SELECT * FROM article_formula_bindings WHERE binding_id = 'binding.relation.fixture'")
      .get();
    const dryRun = dryRunRelationMigration(fixture);
    assert.equal(dryRun.restoreVerification.passed, true);
    assert.equal(dryRun.restoreVerification.restoredDatabaseSha256, dryRun.manifest.backupDatabaseSha256);
    assert.equal(dryRun.plan.sourceInventory.preservedDigest, before.preservedDigest);
    assert.ok(
      dryRun.plan.relations.some(
        (relation) =>
          relation.sourceFormulaId === evidence.stableSource.formulaId &&
          relation.targetFormulaId === evidence.stableTarget.formulaId &&
          relation.provenance === "markdown"
      )
    );
    assert.ok(
      dryRun.plan.relations.some(
        (relation) =>
          relation.sourceFormulaId === evidence.legacySource.formulaId &&
          relation.targetFormulaId === evidence.legacyTarget.formulaId &&
          relation.provenance === "legacy_linear"
      )
    );
    const issueCodes = new Set(dryRun.plan.repairs.map((repair) => repair.issueCode));
    for (const issueCode of [
      "ambiguous_target",
      "missing_source",
      "missing_target",
      "duplicate_dependency",
      "self_reference",
      "evidence_conflict",
      "cycle",
      "archived_target"
    ]) {
      assert.ok(issueCodes.has(issueCode), `missing repair fixture for ${issueCode}`);
    }
    assert.ok(
      dryRun.plan.repairs.some(
        (repair) =>
          repair.sourceTable === "knowledge_links" &&
          Number(repair.sourceKey) === evidence.orphanLinkId &&
          repair.issueCode === "missing_source"
      )
    );
    assert.equal(
      dryRun.plan.repairs.some(
        (repair) =>
          repair.sourceTable === "knowledge_links" && Number(repair.sourceKey) === evidence.ignoredLinkId
      ),
      false
    );

    const applied = applyDisposableRelationMigration(fixture);
    assert.equal(applied.verification.passed, true);
    assert.equal(applied.verification.zeroDeletion, true);
    assert.equal(applied.verification.preservedDigestBefore, applied.verification.preservedDigestAfter);
    assert.deepEqual(
      db.prepare("SELECT * FROM article_formula_bindings WHERE binding_id = 'binding.relation.fixture'").get(),
      bindingBefore
    );
    assert.deepEqual(
      dependencyPath(db, evidence.stableSource.formulaId).map((item) => item.formulaId),
      [evidence.stableSource.formulaId, evidence.stableTarget.formulaId, evidence.leaf.formulaId]
    );
    const after = relationInventory(db);
    assert.equal(after.counts.knowledgeNodes, before.counts.knowledgeNodes);
    assert.equal(after.counts.knowledgeLinks, before.counts.knowledgeLinks);
    assert.equal(after.counts.legacyFormulaMappings, before.counts.legacyFormulaMappings);
    assert.equal(after.counts.formulaCards, before.counts.formulaCards);
    assert.equal(after.counts.formulaRevisions, before.counts.formulaRevisions);

    const store = createContentStore(db);
    const conflictRepair = store
      .listFormulaRelationRepairs({ status: "pending" })
      .find(
        (repair) =>
          repair.issueCode === "evidence_conflict" &&
          repair.sourceFormulaId === evidence.conflictSource.formulaId
      );
    assert.ok(conflictRepair);
    assert.throws(
      () =>
        store.appendFormulaRelationRepairEvent(
          conflictRepair.repairId,
          {
            eventType: "resolved",
            targetFormulaId: evidence.conflictTarget.formulaId,
            note: "wrong target has no stored relation"
          },
          { id: 42, username: "RelationFixture" }
        ),
      /请先在来源公式修订中保存该依赖关系/
    );
    const resolved = store.appendFormulaRelationRepairEvent(
      conflictRepair.repairId,
      {
        eventType: "resolved",
        targetFormulaId: evidence.stableTarget.formulaId,
        note: "stable formula-ref is authoritative and stored"
      },
      { id: 42, username: "RelationFixture" }
    );
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.latestEvent.targetFormulaId, evidence.stableTarget.formulaId);
    const reopened = store.appendFormulaRelationRepairEvent(
      conflictRepair.repairId,
      { eventType: "reopened", targetFormulaId: "", note: "API append-only check follows" },
      { id: 42, username: "RelationFixture" }
    );
    assert.equal(reopened.status, "pending");
    assert.throws(
      () => db.prepare("UPDATE formula_relation_repair_queue SET reason = 'mutated'").run(),
      /append-only/
    );
    assert.throws(
      () => db.prepare("DELETE FROM formula_relation_repair_events").run(),
      /append-only/
    );

    const relationCount = after.counts.formulaRevisionDependencies;
    const second = applyDisposableRelationMigration(fixture);
    assert.equal(second.verification.insertedRelationCount, 0);
    assert.equal(second.verification.queuedRepairCount, 0);
    assert.equal(relationInventory(db).counts.formulaRevisionDependencies, relationCount);

    store.publishFormulaCard(evidence.leaf.formulaId, { id: 42, username: "RelationFixture" });
    store.publishFormulaCard(evidence.stableTarget.formulaId, { id: 42, username: "RelationFixture" });
    store.publishFormulaCard(evidence.stableSource.formulaId, { id: 42, username: "RelationFixture" });

    db.close();
    db = null;
    const cli = childProcess.spawnSync(
      process.execPath,
      [
        "--experimental-sqlite",
        path.join(ROOT, "scripts", "migrate-legacy-formula-relations.js"),
        "--fixture",
        fixture.fixtureDir,
        "--db",
        fixture.dbPath
      ],
      { cwd: ROOT, encoding: "utf8", windowsHide: true }
    );
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    const cliReport = JSON.parse(cli.stdout);
    assert.equal(cliReport.mode, "dry-run");
    assert.equal(cliReport.insertedRelationCount, 0);
    assert.equal(cliReport.zeroDeletion, true);

    db = createDatabase({
      root: ROOT,
      dataDir: fixture.fixtureDir,
      dbDir: fixture.dbDir,
      dbPath: fixture.dbPath,
      uploadDir: path.join(fixture.fixtureDir, "uploads")
    });
    assert.equal(relationInventory(db).counts.formulaRevisionDependencies, relationCount);
    db.close();
    db = null;

    const adminSource = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
    const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
    const publicSource = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
    assert.match(adminHtml, /id="formulaRepairList"/);
    assert.match(adminSource, /formula-relation-repairs/);
    assert.match(adminSource, /手动填写，不自动选择/);
    assert.match(publicSource, /\$\{renderFormulaDerivationSection\(card\)\}/);
    assert.match(publicSource, /derivation\.dependencies/);

    await apiChecks(fixture, evidence, conflictRepair.repairId);
    process.stdout.write(
      `${stableStringify(
        {
          passed: true,
          planDigest: applied.plan.planDigest,
          backupDatabaseSha256: applied.manifest.backupDatabaseSha256,
          insertedRelationCount: applied.verification.insertedRelationCount,
          queuedRepairCount: applied.verification.queuedRepairCount,
          zeroDeletion: applied.verification.zeroDeletion,
          idempotentSecondInsertCount: second.verification.insertedRelationCount
        },
        2
      )}\n`
    );
  } finally {
    if (db) db.close();
    removeFixture(fixture.fixtureDir);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
