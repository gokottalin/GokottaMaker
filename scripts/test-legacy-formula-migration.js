"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const {
  DISPOSABLE_PREFIX,
  applyDisposableMigration,
  applyMigrationPlan,
  assertDisposableFixture,
  buildMigrationPlan,
  cleanupDisposableLegacyRows,
  createDisposableFixture,
  dryRunMigration,
  sha256,
  sourceInventory,
  stableStringify,
  verifyBackupManifest
} = require("../lib/legacy-formula-migration");

const root = path.resolve(__dirname, "..");
const fixtures = [];

function fixtureDatabase(seed = true) {
  const { fixtureDir } = createDisposableFixture();
  fixtures.push(fixtureDir);
  const dbDir = path.join(fixtureDir, "database");
  const dbPath = path.join(dbDir, "fixture.sqlite");
  const db = createDatabase({
    root,
    dataDir: fixtureDir,
    dbDir,
    dbPath,
    uploadDir: path.join(fixtureDir, "uploads")
  });
  if (seed) seedValidLegacyData(db);
  return { fixtureDir, dbPath, db };
}

function cleanupFixtures() {
  const failures = [];
  for (const fixtureDir of fixtures.splice(0)) {
    try {
      assertDisposableFixture(fixtureDir);
      const resolved = path.resolve(fixtureDir);
      const relative = path.relative(path.resolve(os.tmpdir()), resolved);
      assert.ok(path.basename(resolved).startsWith(DISPOSABLE_PREFIX));
      assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
      fs.rmSync(resolved, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100
      });
      assert.equal(fs.existsSync(resolved), false, `fixture cleanup left a directory: ${resolved}`);
    } catch (error) {
      failures.push(`${fixtureDir}: ${error.message}`);
    }
  }
  if (failures.length) {
    throw new Error(`fixture cleanup failed:\n${failures.join("\n")}`);
  }
}

function seedNode(db, overrides = {}) {
  const node = {
    id: "legacy-a",
    slug: "legacy-a",
    nodeType: "derivation",
    symbol: "D.boost",
    title: "Ohm relation",
    summary: "Voltage-current relation",
    markdown: "# Ohm\n\n$$V = I R$$\n\nExact source Markdown.",
    cover: "",
    accentColor: "purple",
    tags: "",
    publishStatus: "published",
    visibilityStatus: "public",
    deletedAt: null,
    ...overrides
  };
  db.prepare(
    `INSERT INTO knowledge_nodes
      (id, slug, node_type, symbol, title, summary, markdown, cover, accent_color,
       tags, publish_status, visibility_status, deleted_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    node.id,
    node.slug,
    node.nodeType,
    node.symbol,
    node.title,
    node.summary,
    node.markdown,
    node.cover,
    node.accentColor,
    node.tags,
    node.publishStatus,
    node.visibilityStatus,
    node.deletedAt,
    node.publishStatus === "published" ? "2026-07-01T00:00:00.000Z" : null
  );
  return node;
}

function seedLink(db, overrides = {}) {
  const link = {
    sourceType: "knowledge_node",
    sourceId: "legacy-a",
    sourceSlug: "legacy-a",
    targetSlug: "legacy-b",
    label: "B link",
    colorToken: "blue",
    linkKind: "derive",
    ordinal: 0,
    ...overrides
  };
  db.prepare(
    `INSERT INTO knowledge_links
      (source_type, source_id, source_slug, target_slug, label, color_token, link_kind, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    link.sourceType,
    link.sourceId,
    link.sourceSlug,
    link.targetSlug,
    link.label,
    link.colorToken,
    link.linkKind,
    link.ordinal
  );
  return Number(db.prepare("SELECT last_insert_rowid() AS id").get().id);
}

function seedValidLegacyData(db) {
  const nodeA = seedNode(db, {
    markdown:
      "# Ohm\n\n$$D = (V_{out} - V_{in}) / V_{out}$$\n\n" +
      "Depends on {{derive:legacy-b|Power base|blue}}."
  });
  const nodeB = seedNode(db, {
    id: "legacy-b",
    slug: "legacy-b",
    symbol: "L.boost",
    title: "Power relation",
    summary: "Power relation summary",
    markdown: "# Power\r\n\r\n$$P = V I$$\r\n\r\nByte-exact source  \r\n"
  });
  const historical = {
    node: {
      ...nodeB,
      symbol: "I_L.peak",
      markdown: "# Power history\n\n$$P_0 = V I$$\n\nOriginal revision."
    },
    links: []
  };
  db.prepare(
    `INSERT INTO knowledge_node_revisions
      (node_id, node_slug, node_title, revision_reason, snapshot_json,
       source_updated_at, actor_username)
     VALUES (?, ?, ?, 'save', ?, '2026-06-01T00:00:00.000Z', 'fixture')`
  ).run(nodeB.id, nodeB.slug, nodeB.title, JSON.stringify(historical));
  db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, excerpt, cover, markdown,
       read_time, date, publish_status, featured, featured_order, tags)
     VALUES ('post-legacy', 'post-legacy', 'Legacy references', '电力电子',
             'power-electronics', '', '',
             'One {{derive:legacy-a|Ohm|green}} and two {{derive:legacy-a|Again|blue}}.',
             '3 分钟', '2026-07-01', 'published', 0, 0, '')`
  ).run();
  seedLink(db);
  seedLink(db, {
    sourceType: "post",
    sourceId: "post-legacy",
    sourceSlug: "post-legacy",
    targetSlug: "legacy-a",
    label: "Ohm",
    colorToken: "green"
  });
  return { nodeA, nodeB };
}

function validMappingRules() {
  return {
    "legacy-a": {
      exactLatex: "D = (V_{out} - V_{in}) / V_{out}",
      latexSourceEvidence:
        "fixture mapping reviewed against the displayed conclusion equation in knowledge_nodes:legacy-a"
    },
    "legacy-b": {
      exactLatex: "P = V I",
      latexSourceEvidence:
        "fixture mapping reviewed against the displayed conclusion equation in knowledge_nodes:legacy-b",
      revisionLatex: {
        "knowledge_node_revisions:1": {
          exactLatex: "P_0 = V I",
          sourceEvidence:
            "fixture mapping reviewed against the displayed conclusion equation in knowledge_node_revisions:1"
        }
      }
    }
  };
}

function counts(db) {
  const names = [
    "knowledge_nodes",
    "knowledge_node_revisions",
    "knowledge_links",
    "formula_cards",
    "formula_revisions",
    "article_formula_bindings",
    "formula_revision_dependencies",
    "content_revisions",
    "legacy_formula_mappings",
    "legacy_formula_migration_reports",
    "legacy_formula_redirects"
  ];
  return Object.fromEntries(
    names.map((name) => [
      name,
      Number(db.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count || 0)
    ])
  );
}

function immutableTargetState(db) {
  return {
    cards: db
      .prepare(
        `SELECT formula_id, slug, display_name, module_key, category_path, purpose,
                current_revision_id, published_revision_id, publish_status, archived_at
         FROM formula_cards ORDER BY formula_id ASC`
      )
      .all(),
    revisions: db
      .prepare(
        `SELECT revision_id, formula_id, sequence_no, latex, markdown_derivation,
                display_name, module_key, category_path, purpose, tags_json,
                source_book_id, source_book_revision, source_formula_id
         FROM formula_revisions ORDER BY formula_id ASC, sequence_no ASC, revision_id ASC`
      )
      .all(),
    dependencies: db
      .prepare(
        `SELECT revision_id, source_formula_id, target_formula_id, ordinal, provenance
         FROM formula_revision_dependencies
         ORDER BY revision_id ASC, ordinal ASC, target_formula_id ASC`
      )
      .all(),
    bindings: db
      .prepare(
        `SELECT binding_id, post_id, formula_id, revision_id, display_mode, ordinal
         FROM article_formula_bindings ORDER BY binding_id ASC`
      )
      .all(),
    contentRevisions: db
      .prepare(
        `SELECT content_type, content_id, revision_reason, snapshot_json, source_updated_at
         FROM content_revisions
         WHERE revision_reason = 'legacy_formula_migration'
         ORDER BY id ASC`
      )
      .all()
  };
}

function expectBlocked(work, pattern) {
  assert.throws(work, pattern);
}

function insertFormulaCard(db, options) {
  const formulaId = options.formulaId;
  const slug = options.slug;
  const revisionId = options.revisionId || `rev.test.${sha256(formulaId).slice(7, 31)}`;
  const status = options.status || "published";
  const tags = options.tags || ["legacy:derivation"];
  db.prepare(
    `INSERT INTO formula_cards
      (formula_id, slug, display_name, module_key, category_path, purpose,
       publish_status, current_revision_id, published_revision_id)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, NULL)`
  ).run(
    formulaId,
    slug,
    options.displayName || formulaId,
    options.moduleKey || "legacy-formulas",
    options.categoryPath || "Legacy/derivation",
    options.purpose || ""
  );
  db.prepare(
    `INSERT INTO formula_revisions
      (revision_id, formula_id, sequence_no, latex, markdown_derivation,
       display_name, module_key, category_path, purpose, tags_json,
       revision_reason, source_formula_id)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'fixture', ?)`
  ).run(
    revisionId,
    formulaId,
    options.latex || "x=1",
    options.markdown || "# Fixture",
    options.displayName || formulaId,
    options.moduleKey || "legacy-formulas",
    options.categoryPath || "Legacy/derivation",
    options.purpose || "",
    JSON.stringify(tags),
    options.sourceFormulaId || ""
  );
  if (status === "published") {
    db.prepare(
      `INSERT INTO formula_revision_publications
        (revision_id, formula_id, actor_username)
       VALUES (?, ?, 'fixture')`
    ).run(revisionId, formulaId);
  }
  db.prepare(
    `UPDATE formula_cards
     SET current_revision_id = ?, published_revision_id = ?,
         publish_status = ?, archived_at = ?
     WHERE formula_id = ?`
  ).run(
    revisionId,
    status === "published" ? revisionId : null,
    status,
    status === "archived" ? "2026-07-01T00:00:00.000Z" : null,
    formulaId
  );
  return { formulaId, slug, revisionId, status };
}

function insertVerifiedRedirect(db, options) {
  const planDigest = sha256(`plan:${options.legacySlug}`);
  const reportDigest = sha256(`report:${options.legacySlug}`);
  const targetIds = [
    {
      formulaId: options.formulaId,
      slug: options.targetSlug,
      currentRevisionId: options.currentRevisionId || null,
      publishedRevisionId: options.publishedRevisionId || null
    }
  ];
  db.prepare(
    `INSERT INTO legacy_formula_mappings
      (source_table, source_key, source_digest, disposition, target_kind,
       target_ids_json, reason, report_digest)
     VALUES ('knowledge_nodes', ?, ?, 'mapped', 'formula_card', ?, 'fixture', ?)`
  ).run(options.sourceNodeId, sha256(options.sourceNodeId), stableStringify(targetIds), planDigest);
  db.prepare(
    `INSERT INTO legacy_formula_migration_reports
      (report_digest, plan_digest, manifest_digest, mode, unresolved_count,
       cleanup_eligible, report_json)
     VALUES (?, ?, ?, 'apply_verified', 0, 1, '{}')`
  ).run(reportDigest, planDigest, sha256(`manifest:${options.legacySlug}`));
  db.prepare(
    `INSERT INTO legacy_formula_redirects
      (legacy_slug, source_node_id, formula_id, target_slug,
       source_publish_status, source_visibility_status, source_deleted_at,
       verification_status, report_digest)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?)`
  ).run(
    options.legacySlug,
    options.sourceNodeId,
    options.formulaId,
    options.targetSlug,
    options.sourcePublishStatus || "published",
    options.sourceVisibilityStatus || "public",
    options.sourceDeletedAt || null,
    planDigest
  );
}

function tableExists(db, name) {
  return Boolean(
    db.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
  );
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
  const child = childProcess.spawn(
    process.execPath,
    ["--experimental-sqlite", path.join(root, "server.js")],
    {
      cwd: root,
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
    }
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
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
    port,
    output: () => output,
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

function assertSourceRowsIntact(db, expected) {
  const actual = sourceInventory(db).selectedCounts;
  assert.deepEqual(actual, expected);
}

function testSupportOnlyStartup() {
  const migrationSource = fs.readFileSync(
    path.join(root, "migrations", "023_legacy_formula_migration_support.js"),
    "utf8"
  );
  assert.doesNotMatch(
    migrationSource,
    /DELETE\s+FROM\s+(?:knowledge_nodes|knowledge_node_revisions|knowledge_links)/i
  );
  const fixture = fixtureDatabase();
  const before = sourceInventory(fixture.db).selectedCounts;
  assert.ok(tableExists(fixture.db, "legacy_formula_backup_manifests"));
  assert.ok(tableExists(fixture.db, "legacy_formula_mappings"));
  assert.ok(tableExists(fixture.db, "legacy_formula_redirects"));
  assert.ok(tableExists(fixture.db, "legacy_formula_migration_reports"));
  fixture.db.close();
  const reopened = createDatabase({
    root,
    dataDir: fixture.fixtureDir,
    dbDir: path.dirname(fixture.dbPath),
    dbPath: fixture.dbPath,
    uploadDir: path.join(fixture.fixtureDir, "uploads")
  });
  assertSourceRowsIntact(reopened, before);
  reopened.close();
}

function testDefaultCliDryRun() {
  const fixture = fixtureDatabase();
  const before = sourceInventory(fixture.db).selectedCounts;
  fixture.db.close();
  const result = childProcess.spawnSync(
    process.execPath,
    [
      "--experimental-sqlite",
      path.join(root, "scripts", "migrate-legacy-formulas.js"),
      "--fixture",
      fixture.fixtureDir,
      "--db",
      fixture.dbPath
    ],
    { cwd: root, encoding: "utf8", windowsHide: true }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.mode, "dry-run");
  assert.equal(summary.cleanupEligible, false);
  assert.ok(summary.unresolvedCount > 0);
  assert.ok(fs.existsSync(summary.reportPath));
  const reopened = createDatabase({
    root,
    dataDir: fixture.fixtureDir,
    dbDir: path.dirname(fixture.dbPath),
    dbPath: fixture.dbPath,
    uploadDir: path.join(fixture.fixtureDir, "uploads")
  });
  assertSourceRowsIntact(reopened, before);
  assert.equal(counts(reopened).formula_cards, 0);
  reopened.close();
}

function testSuccessfulMigrationAndCleanup() {
  const fixture = fixtureDatabase();
  const sourceBefore = sourceInventory(fixture.db);
  const mappingRules = validMappingRules();
  const dryRun = dryRunMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules
  });
  assert.equal(dryRun.mode, "dry_run");
  assert.equal(dryRun.plan.unresolvedCount, 0);
  assert.equal(dryRun.restoreVerification.passed, true);
  assert.equal(verifyBackupManifest(dryRun.manifest).passed, true);
  assert.equal(dryRun.manifest.method.snapshot, "VACUUM INTO");
  assert.deepEqual(dryRun.restoreVerification.selectedRowCounts, sourceBefore.selectedCounts);
  assertSourceRowsIntact(fixture.db, sourceBefore.selectedCounts);
  assert.equal(counts(fixture.db).formula_cards, 0);

  const report = applyMigrationPlan({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    plan: dryRun.plan,
    manifest: dryRun.manifest,
    restoreVerification: dryRun.restoreVerification
  });
  assert.equal(report.mode, "apply_verified");
  assert.equal(report.verification.cleanupEligible, true);
  assert.ok(Object.values(report.verification.checks).every((check) => check.passed));
  assertSourceRowsIntact(fixture.db, sourceBefore.selectedCounts);
  const migratedCounts = counts(fixture.db);
  assert.equal(migratedCounts.formula_cards, 2);
  assert.equal(migratedCounts.article_formula_bindings, 2);
  assert.equal(migratedCounts.formula_revision_dependencies, 1);
  assert.equal(migratedCounts.content_revisions, 1);
  assert.equal(migratedCounts.legacy_formula_mappings, 5);
  assert.equal(migratedCounts.legacy_formula_redirects, 2);
  const formulaMarkdown = fixture.db
    .prepare(
      `SELECT markdown_derivation AS markdown
       FROM formula_revisions
       WHERE source_formula_id = 'legacy-a'`
    )
    .get().markdown;
  assert.match(formulaMarkdown, /\{\{formula-ref:formula\.legacy\./);
  assert.doesNotMatch(formulaMarkdown, /\{\{derive:/);
  assert.match(
    fixture.db.prepare("SELECT markdown FROM posts WHERE id = 'post-legacy'").get().markdown,
    /\{\{formula:bind\.legacy\./
  );
  assert.doesNotMatch(
    fixture.db.prepare("SELECT markdown FROM posts WHERE id = 'post-legacy'").get().markdown,
    /\{\{derive:legacy-a\|/
  );
  const oldSnapshot = JSON.parse(
    fixture.db
      .prepare(
        `SELECT snapshot_json AS snapshotJson
         FROM content_revisions
         WHERE content_id = 'post-legacy' AND revision_reason = 'legacy_formula_migration'`
      )
      .get().snapshotJson
  );
  assert.match(oldSnapshot.markdown, /\{\{derive:legacy-a\|Ohm\|green\}\}/);
  const bindingIds = fixture.db
    .prepare(
      `SELECT binding_id AS bindingId FROM article_formula_bindings
       WHERE post_id = 'post-legacy' ORDER BY ordinal ASC`
    )
    .all()
    .map((row) => row.bindingId);
  assert.equal(new Set(bindingIds).size, 2);

  const beforeIdempotent = immutableTargetState(fixture.db);
  const secondReport = applyDisposableMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules
  });
  assert.equal(
    secondReport.mode,
    "apply_verified",
    stableStringify(secondReport.verification.checks, 2)
  );
  assert.equal(secondReport.verification.cleanupEligible, true);
  assert.deepEqual(immutableTargetState(fixture.db), beforeIdempotent);
  const rebuiltPlan = buildMigrationPlan(fixture.db, { mappingRules });
  assert.equal(rebuiltPlan.unresolvedCount, 0);
  assert.equal(rebuiltPlan.mappings.length, dryRun.plan.mappings.length);

  const store = createContentStore(fixture.db);
  const redirectBeforeCleanup = store.resolveLegacyFormulaRedirect("legacy-a");
  assert.equal(redirectBeforeCleanup.statusCode, 308);
  assert.match(redirectBeforeCleanup.location, /^\/derive\.html\?formula=legacy-/);

  const cleanup = cleanupDisposableLegacyRows({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    reportDigest: secondReport.reportDigest
  });
  assert.equal(cleanup.mode, "cleanup_completed");
  assert.equal(cleanup.verification.cleanupCompleted, true);
  const after = counts(fixture.db);
  assert.equal(after.knowledge_nodes, 0);
  assert.equal(after.knowledge_node_revisions, 0);
  assert.equal(after.knowledge_links, 0);
  assert.equal(after.formula_cards, migratedCounts.formula_cards);
  assert.equal(after.formula_revisions, migratedCounts.formula_revisions);
  assert.equal(after.article_formula_bindings, migratedCounts.article_formula_bindings);
  assert.equal(after.legacy_formula_mappings, migratedCounts.legacy_formula_mappings);
  assert.equal(after.legacy_formula_redirects, migratedCounts.legacy_formula_redirects);
  assert.ok(after.legacy_formula_migration_reports >= 2);
  assert.equal(verifyBackupManifest(report.manifest).passed, true);
  assert.equal(store.resolveLegacyFormulaRedirect("legacy-a").statusCode, 308);
  return {
    fixture,
    report,
    cleanup,
    evidence: {
      sourceBefore: sourceBefore.selectedCounts,
      manifestDigest: report.manifest.manifestDigest,
      backupDatabaseSha256: report.manifest.files.find(
        (file) => file.role === "sqlite-consistent-snapshot"
      ).sha256,
      sourceExportSha256: report.manifest.files.find(
        (file) => file.role === "exact-legacy-source-export"
      ).sha256,
      restoreVerificationDigest: report.restoreVerification.verificationDigest,
      planDigest: report.plan.planDigest,
      applyReportDigest: report.reportDigest,
      secondApplyReportDigest: secondReport.reportDigest,
      cleanupReportDigest: cleanup.reportDigest,
      bindingIds,
      redirect: redirectBeforeCleanup,
      migratedCounts,
      afterCleanupCounts: after
    }
  };
}

function testAmbiguousMappingBlocks() {
  const fixture = fixtureDatabase();
  const expected = sourceInventory(fixture.db).selectedCounts;
  insertFormulaCard(fixture.db, {
    formulaId: "formula.ambiguous.one",
    slug: "ambiguous-one",
    sourceFormulaId: "legacy-a"
  });
  insertFormulaCard(fixture.db, {
    formulaId: "formula.ambiguous.two",
    slug: "ambiguous-two",
    sourceFormulaId: "legacy-a"
  });
  const dryRun = dryRunMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir
  });
  assert.ok(dryRun.plan.unresolvedCount > 0);
  assert.match(
    dryRun.plan.mappings.find(
      (mapping) => mapping.sourceTable === "knowledge_nodes" && mapping.sourceKey === "legacy-a"
    ).reason,
    /ambiguous/
  );
  expectBlocked(
    () =>
      applyMigrationPlan({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        plan: dryRun.plan,
        manifest: dryRun.manifest,
        restoreVerification: dryRun.restoreVerification
      }),
    /unresolved\/ambiguous/
  );
  assertSourceRowsIntact(fixture.db, expected);
  fixture.db.close();
}

function testMissingTargetBlocks() {
  const fixture = fixtureDatabase();
  const expected = sourceInventory(fixture.db).selectedCounts;
  seedLink(fixture.db, {
    sourceType: "knowledge_node",
    sourceId: "legacy-b",
    sourceSlug: "legacy-b",
    targetSlug: "missing-target",
    label: "Missing",
    ordinal: 1
  });
  const dryRun = dryRunMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules: validMappingRules()
  });
  assert.ok(dryRun.plan.unresolvedCount > 0);
  assert.ok(
    dryRun.plan.mappings.some(
      (mapping) => mapping.sourceTable === "knowledge_links" && /missing or unresolved/.test(mapping.reason)
    )
  );
  assertSourceRowsIntact(fixture.db, {
    ...expected,
    knowledge_links: expected.knowledge_links + 1
  });
  fixture.db.close();
}

function testProjectReferenceBlocks() {
  const fixture = fixtureDatabase();
  dbInsertProject(fixture.db);
  seedLink(fixture.db, {
    sourceType: "project",
    sourceId: "project-legacy",
    sourceSlug: "project-legacy",
    targetSlug: "legacy-a",
    label: "Project old link",
    ordinal: 0
  });
  const expected = sourceInventory(fixture.db).selectedCounts;
  const plan = buildMigrationPlan(fixture.db, { mappingRules: validMappingRules() });
  const projectDisposition = plan.mappings.find(
    (mapping) =>
      mapping.sourceTable === "knowledge_links" &&
      mapping.sourceRow.source_type === "project"
  );
  assert.equal(projectDisposition.disposition, "unresolved");
  assert.match(projectDisposition.reason, /no safe new binding rewrite/);
  assertSourceRowsIntact(fixture.db, expected);
  fixture.db.close();
}

function testLegacySymbolRequiresTraceableLatex() {
  const fixture = fixtureDatabase();
  const blockedPlan = buildMigrationPlan(fixture.db);
  const nodeMapping = blockedPlan.mappings.find(
    (mapping) =>
      mapping.sourceTable === "knowledge_nodes" && mapping.sourceKey === "legacy-a"
  );
  assert.equal(nodeMapping.disposition, "unresolved");
  assert.match(nodeMapping.reason, /symbol is treated as a label only: D\.boost/);
  assert.equal(blockedPlan.formulas.length, 0);

  const explicitPlan = buildMigrationPlan(fixture.db, {
    mappingRules: validMappingRules()
  });
  assert.equal(explicitPlan.unresolvedCount, 0);
  const explicitMapping = explicitPlan.mappings.find(
    (mapping) =>
      mapping.sourceTable === "knowledge_nodes" && mapping.sourceKey === "legacy-a"
  );
  assert.equal(explicitMapping.disposition, "mapped");
  const decision = explicitMapping.targetIds[0].latexDecision;
  assert.equal(decision.legacySymbol, "D.boost");
  assert.equal(decision.decision, "mapping_rule_exact_latex");
  assert.match(decision.sourceEvidence, /displayed conclusion equation/);
  assert.equal(decision.exactLatex, "D = (V_{out} - V_{in}) / V_{out}");
  fixture.db.close();
}

function mergeFixture(mismatch = false) {
  const fixture = fixtureDatabase(false);
  const shared = {
    nodeType: "derivation",
    symbol: "BOOST-L",
    title: "Shared boost conclusion",
    summary: "Exact shared conclusion",
    markdown: "# Shared\n\n$$D = 1 - V_{in} / V_{out}$$",
    tags: "",
    publishStatus: "published",
    visibilityStatus: "public"
  };
  seedNode(fixture.db, {
    ...shared,
    id: "legacy-merge-a",
    slug: "legacy-merge-a"
  });
  seedNode(fixture.db, {
    ...shared,
    id: "legacy-merge-b",
    slug: "legacy-merge-b",
    markdown: mismatch
      ? "# Shared\n\n$$D = 1 - V_{in} / V_{out}$$\n\nDifferent proof."
      : shared.markdown
  });
  const target = insertFormulaCard(fixture.db, {
    formulaId: "formula.explicit.shared-boost",
    slug: "shared-boost",
    displayName: shared.title,
    moduleKey: "legacy-formulas",
    categoryPath: "Legacy/derivation",
    purpose: shared.summary,
    latex: "D = 1 - V_{in} / V_{out}",
    markdown: shared.markdown,
    tags: ["legacy:derivation"]
  });
  const mappingRules = Object.fromEntries(
    ["legacy-merge-a", "legacy-merge-b"].map((nodeId) => [
      nodeId,
      {
        targetFormulaId: target.formulaId,
        mergeKey: "boost-duty-exact-v1",
        exactLatex: "D = 1 - V_{in} / V_{out}",
        latexSourceEvidence: `reviewed conclusion equation for ${nodeId}`
      }
    ])
  );
  return { fixture, target, mappingRules };
}

function testExplicitMergeSuccess() {
  const { fixture, target, mappingRules } = mergeFixture(false);
  const before = immutableTargetState(fixture.db);
  const plan = buildMigrationPlan(fixture.db, { mappingRules });
  assert.equal(plan.unresolvedCount, 0);
  const nodeMappings = plan.mappings.filter(
    (mapping) => mapping.sourceTable === "knowledge_nodes"
  );
  assert.equal(nodeMappings.length, 2);
  assert.ok(nodeMappings.every((mapping) => mapping.disposition === "merged"));
  assert.ok(nodeMappings.every((mapping) => mapping.mergeKey === "boost-duty-exact-v1"));
  assert.ok(
    nodeMappings.every(
      (mapping) => mapping.targetIds[0].currentRevisionId === target.revisionId
    )
  );
  const report = applyDisposableMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules
  });
  assert.equal(report.verification.cleanupEligible, true);
  assert.deepEqual(immutableTargetState(fixture.db), before);
  assert.equal(counts(fixture.db).legacy_formula_redirects, 2);
  fixture.db.close();
}

function testExplicitMergeMismatchBlocks() {
  const { fixture, mappingRules } = mergeFixture(true);
  const sourceBefore = sourceInventory(fixture.db);
  const dryRun = dryRunMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules
  });
  assert.ok(dryRun.plan.unresolvedCount > 0);
  assert.ok(
    dryRun.plan.mappings
      .filter((mapping) => mapping.sourceTable === "knowledge_nodes")
      .some(
        (mapping) =>
          mapping.disposition === "unresolved" &&
          /existing target content|explicit merge requires/.test(mapping.reason)
      )
  );
  expectBlocked(
    () =>
      applyMigrationPlan({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        plan: dryRun.plan,
        manifest: dryRun.manifest,
        restoreVerification: dryRun.restoreVerification
      }),
    /unresolved\/ambiguous/
  );
  assert.deepEqual(sourceInventory(fixture.db), sourceBefore);
  fixture.db.close();
}

function dbInsertProject(db) {
  db.prepare(
    `INSERT INTO projects
      (id, slug, title, status, status_key, summary, cover, markdown,
       license, stars, date, visibility_status, featured, featured_order, tags)
     VALUES ('project-legacy', 'project-legacy', 'Legacy project', '在线', 'online',
             '', '', '{{derive:legacy-a|Old|purple}}', '', 0, '2026-07-01',
             'published', 0, 0, '')`
  ).run();
}

function testRedirectLoopBlocks() {
  const fixture = fixtureDatabase(false);
  const nodeA = seedNode(fixture.db, {
    markdown: "# Loop\n\n$$x = 1$$"
  });
  insertFormulaCard(fixture.db, {
    formulaId: "formula.self.loop",
    slug: "legacy-a",
    displayName: nodeA.title,
    latex: "x = 1",
    markdown: nodeA.markdown,
    purpose: nodeA.summary,
    sourceFormulaId: "legacy-a",
    tags: ["legacy:derivation"]
  });
  const plan = buildMigrationPlan(fixture.db, {
    mappingRules: {
      "legacy-a": {
        targetFormulaId: "formula.self.loop",
        exactLatex: "x = 1",
        latexSourceEvidence: "fixture exact conclusion equation"
      }
    }
  });
  assert.ok(plan.unresolvedCount > 0);
  assert.ok(plan.issues.some((issue) => /self-loop or multi-hop redirect/.test(issue)));
  assert.equal(sourceInventory(fixture.db).selectedCounts.knowledge_nodes, 1);
  fixture.db.close();
}

function applyValidFixture() {
  const fixture = fixtureDatabase();
  const report = applyDisposableMigration({
    db: fixture.db,
    dbPath: fixture.dbPath,
    fixtureDir: fixture.fixtureDir,
    mappingRules: validMappingRules()
  });
  assert.equal(report.verification.cleanupEligible, true);
  return { fixture, report };
}

function testChecksumFailureBlocksCleanup() {
  const { fixture, report } = applyValidFixture();
  const expected = sourceInventory(fixture.db).selectedCounts;
  const exportFile = report.manifest.files.find(
    (file) => file.role === "exact-legacy-source-export"
  );
  fs.appendFileSync(exportFile.path, "\nTAMPERED\n", "utf8");
  expectBlocked(
    () =>
      cleanupDisposableLegacyRows({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        reportDigest: report.reportDigest
      }),
    /backup checksum gate failed/
  );
  assertSourceRowsIntact(fixture.db, expected);
  fixture.db.close();
}

function testCountDriftBlocksCleanup() {
  const { fixture, report } = applyValidFixture();
  const node = fixture.db
    .prepare("SELECT * FROM knowledge_nodes WHERE id = 'legacy-a'")
    .get();
  fixture.db.prepare(
    `INSERT INTO knowledge_node_revisions
      (node_id, node_slug, node_title, revision_reason, snapshot_json)
     VALUES ('legacy-a', 'legacy-a', 'Drift', 'drift', ?)`
  ).run(JSON.stringify({ node, links: [] }));
  const expected = sourceInventory(fixture.db).selectedCounts;
  expectBlocked(
    () =>
      cleanupDisposableLegacyRows({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        reportDigest: report.reportDigest
      }),
    /selected legacy source count drift/
  );
  assertSourceRowsIntact(fixture.db, expected);
  fixture.db.close();
}

function testContentMismatchBlocksCleanup() {
  const { fixture, report } = applyValidFixture();
  fixture.db
    .prepare("UPDATE knowledge_nodes SET markdown = markdown || '\nMISMATCH' WHERE id = 'legacy-a'")
    .run();
  const expected = sourceInventory(fixture.db).selectedCounts;
  expectBlocked(
    () =>
      cleanupDisposableLegacyRows({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        reportDigest: report.reportDigest
      }),
    /exact digest drift|exact source content mismatch/
  );
  assertSourceRowsIntact(fixture.db, expected);
  fixture.db.close();
}

function testCleanupRollbackAfterDeleteValidationFailure() {
  const { fixture, report } = applyValidFixture();
  const sourceBefore = sourceInventory(fixture.db);
  const countsBefore = counts(fixture.db);
  expectBlocked(
    () =>
      cleanupDisposableLegacyRows({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        reportDigest: report.reportDigest,
        faultInjection: { afterDeleteValidationFailure: true }
      }),
    /injected post-delete validation failure/
  );
  assert.deepEqual(sourceInventory(fixture.db), sourceBefore);
  assert.deepEqual(counts(fixture.db), countsBefore);
  fixture.db.close();
}

function testCleanupRollbackReportPersistenceFailure() {
  const { fixture, report } = applyValidFixture();
  const sourceBefore = sourceInventory(fixture.db);
  const countsBefore = counts(fixture.db);
  expectBlocked(
    () =>
      cleanupDisposableLegacyRows({
        db: fixture.db,
        dbPath: fixture.dbPath,
        fixtureDir: fixture.fixtureDir,
        reportDigest: report.reportDigest,
        faultInjection: { reportPersistenceFailure: true }
      }),
    /injected cleanup report persistence failure/
  );
  assert.deepEqual(sourceInventory(fixture.db), sourceBefore);
  assert.deepEqual(counts(fixture.db), countsBefore);
  fixture.db.close();
}

function injectUnsafeRedirectFixtures(db) {
  const draft = insertFormulaCard(db, {
    formulaId: "formula.redirect.draft",
    slug: "redirect-draft-target",
    status: "draft"
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-draft",
    sourceNodeId: "redirect-draft-node",
    formulaId: draft.formulaId,
    targetSlug: draft.slug,
    currentRevisionId: draft.revisionId,
    publishedRevisionId: null
  });
  const privateTarget = insertFormulaCard(db, {
    formulaId: "formula.redirect.private",
    slug: "redirect-private-target"
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-private",
    sourceNodeId: "redirect-private-node",
    formulaId: privateTarget.formulaId,
    targetSlug: privateTarget.slug,
    currentRevisionId: privateTarget.revisionId,
    publishedRevisionId: privateTarget.revisionId,
    sourceVisibilityStatus: "private"
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-missing",
    sourceNodeId: "redirect-missing-node",
    formulaId: "formula.redirect.missing",
    targetSlug: "redirect-missing-target",
    currentRevisionId: "rev.redirect.missing",
    publishedRevisionId: "rev.redirect.missing"
  });
  const self = insertFormulaCard(db, {
    formulaId: "formula.redirect.self",
    slug: "redirect-self"
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-self",
    sourceNodeId: "redirect-self-node",
    formulaId: self.formulaId,
    targetSlug: self.slug,
    currentRevisionId: self.revisionId,
    publishedRevisionId: self.revisionId
  });
  const chainA = insertFormulaCard(db, {
    formulaId: "formula.redirect.chain.a",
    slug: "redirect-chain-b"
  });
  const chainB = insertFormulaCard(db, {
    formulaId: "formula.redirect.chain.b",
    slug: "redirect-chain-final"
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-chain-a",
    sourceNodeId: "redirect-chain-a-node",
    formulaId: chainA.formulaId,
    targetSlug: chainA.slug,
    currentRevisionId: chainA.revisionId,
    publishedRevisionId: chainA.revisionId
  });
  insertVerifiedRedirect(db, {
    legacySlug: "redirect-chain-b",
    sourceNodeId: "redirect-chain-b-node",
    formulaId: chainB.formulaId,
    targetSlug: chainB.slug,
    currentRevisionId: chainB.revisionId,
    publishedRevisionId: chainB.revisionId
  });
}

async function testServerRedirectMatrix(success) {
  injectUnsafeRedirectFixtures(success.fixture.db);
  const validLocation = createContentStore(success.fixture.db).resolveLegacyFormulaRedirect("legacy-a").location;
  success.fixture.db.close();
  const server = await startFixtureServer(success.fixture.fixtureDir, success.fixture.dbPath);
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const valid = await fetch(`${base}/derive.html?slug=legacy-a`, { redirect: "manual" });
    assert.equal(valid.status, 308);
    assert.equal(valid.headers.get("location"), validLocation);
    const head = await fetch(`${base}/derive.html?slug=legacy-a`, {
      method: "HEAD",
      redirect: "manual"
    });
    assert.equal(head.status, 308);
    for (const slug of [
      "redirect-draft",
      "redirect-private",
      "redirect-missing",
      "redirect-self",
      "redirect-chain-a"
    ]) {
      const response = await fetch(`${base}/derive.html?slug=${slug}`, { redirect: "manual" });
      assert.notEqual(response.status, 308, `${slug} must not redirect`);
      assert.equal(response.status, 200, `${slug} should safely fall through to static derive page`);
    }
    const formulaAlreadyNew = await fetch(
      `${base}/derive.html?slug=legacy-a&formula=already-new`,
      { redirect: "manual" }
    );
    assert.equal(formulaAlreadyNew.status, 200);
  } finally {
    await server.stop();
  }
}

async function main() {
  const evidence = [];
  try {
    testSupportOnlyStartup();
    evidence.push("support-only startup keeps legacy rows");
    testDefaultCliDryRun();
    evidence.push("CLI default dry-run creates backup/report without target writes");
    const success = testSuccessfulMigrationAndCleanup();
    evidence.push("backup, restore, apply, idempotency, verification, and disposable cleanup");
    testAmbiguousMappingBlocks();
    evidence.push("ambiguous mapping blocks apply and keeps legacy rows");
    testMissingTargetBlocks();
    evidence.push("missing target remains unresolved and keeps legacy rows");
    testProjectReferenceBlocks();
    evidence.push("project legacy reference gets unresolved disposition");
    testLegacySymbolRequiresTraceableLatex();
    evidence.push("label-like symbol blocks until exact LaTeX and source evidence are explicit");
    testExplicitMergeSuccess();
    evidence.push("exact explicit many-to-one merge reuses one compatible immutable target");
    testExplicitMergeMismatchBlocks();
    evidence.push("inconsistent explicit merge proof blocks apply and keeps legacy rows");
    testRedirectLoopBlocks();
    evidence.push("self/multi-hop redirect plan is rejected");
    testChecksumFailureBlocksCleanup();
    evidence.push("checksum mismatch blocks cleanup");
    testCountDriftBlocksCleanup();
    evidence.push("count drift blocks cleanup");
    testContentMismatchBlocksCleanup();
    evidence.push("content mismatch blocks cleanup");
    testCleanupRollbackAfterDeleteValidationFailure();
    evidence.push("post-delete validation fault rolls back all three legacy tables");
    testCleanupRollbackReportPersistenceFailure();
    evidence.push("cleanup-report persistence fault rolls back all three legacy tables");
    await testServerRedirectMatrix(success);
    evidence.push("real HTTP 308 plus draft/private/missing/self/multi-hop rejection");
    console.log("Legacy formula migration safety tests passed.");
    evidence.forEach((item) => console.log(`- ${item}`));
    console.log(`EVIDENCE ${stableStringify(success.evidence)}`);
  } finally {
    cleanupFixtures();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
