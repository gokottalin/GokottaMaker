"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  extractFormulaDependencyReferences,
  extractLegacyDeriveReferences
} = require("./validators");

const DISPOSABLE_PREFIX = "larkix-legacy-formula-";
const DISPOSABLE_MARKER = ".larkix-disposable-fixture.json";
const SOURCE_TABLES = ["knowledge_nodes", "knowledge_node_revisions", "knowledge_links"];
const LEGACY_NODE_TYPES = new Set(["formula", "derivation"]);
const FORMULA_REFERENCE_PATTERN =
  /\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}/g;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value, space = 0) {
  return JSON.stringify(stableValue(value), null, space);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function rowDigest(row) {
  return sha256(stableStringify(row));
}

function normalizedDigestText(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function tableCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count || 0);
}

function databaseChecks(db) {
  const integrityRows = db.prepare("PRAGMA integrity_check").all();
  const foreignKeyRows = db.prepare("PRAGMA foreign_key_check").all();
  return {
    integrity: integrityRows.map((row) => Object.values(row)[0]),
    foreignKeyViolations: foreignKeyRows,
    passed:
      integrityRows.length === 1 &&
      String(Object.values(integrityRows[0])[0]).toLowerCase() === "ok" &&
      foreignKeyRows.length === 0
  };
}

function schemaState(db) {
  return {
    migrations: db
      .prepare(
        `SELECT id, name, executed_at AS executedAt
         FROM schema_migrations
         ORDER BY id ASC`
      )
      .all(),
    sourceSchemas: db
      .prepare(
        `SELECT name, type, sql
         FROM sqlite_master
         WHERE name IN ('knowledge_nodes', 'knowledge_node_revisions', 'knowledge_links')
         ORDER BY type ASC, name ASC`
      )
      .all()
  };
}

function sourceInventory(db) {
  const allNodes = db
    .prepare(
      `SELECT id, slug, node_type, symbol, title, summary, markdown, cover,
              accent_color, tags, publish_status, visibility_status, deleted_at,
              created_at, updated_at, published_at
       FROM knowledge_nodes
       ORDER BY id ASC`
    )
    .all();
  const nodes = allNodes.filter((node) => LEGACY_NODE_TYPES.has(node.node_type));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeSlugs = new Set(nodes.map((node) => node.slug));
  const allRevisions = db
    .prepare(
      `SELECT id, node_id, node_slug, node_title, revision_reason, snapshot_json,
              source_updated_at, actor_user_id, actor_username, created_at
       FROM knowledge_node_revisions
       ORDER BY id ASC`
    )
    .all();
  const revisions = allRevisions.filter((revision) => nodeIds.has(revision.node_id));
  const allLinks = db
    .prepare(
      `SELECT id, source_type, source_id, source_slug, target_slug, label,
              color_token, link_kind, ordinal, created_at, updated_at
       FROM knowledge_links
       ORDER BY id ASC`
    )
    .all();
  const links = allLinks.filter(
    (link) =>
      (link.source_type === "knowledge_node" && nodeIds.has(link.source_id)) ||
      nodeSlugs.has(link.target_slug)
  );
  const selectedCounts = {
    knowledge_nodes: nodes.length,
    knowledge_node_revisions: revisions.length,
    knowledge_links: links.length
  };
  const totalCounts = {
    knowledge_nodes: allNodes.length,
    knowledge_node_revisions: allRevisions.length,
    knowledge_links: allLinks.length
  };
  const exact = { nodes, revisions, links };
  return {
    ...exact,
    selectedCounts,
    totalCounts,
    outOfScopeCounts: Object.fromEntries(
      SOURCE_TABLES.map((table) => [table, totalCounts[table] - selectedCounts[table]])
    ),
    exactDigest: sha256(stableStringify(exact)),
    normalizedDigest: sha256(
      stableStringify(exact).normalize("NFC").replaceAll("\\r\\n", "\\n")
    )
  };
}

function createDisposableFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), DISPOSABLE_PREFIX));
  const marker = {
    kind: "larkix.legacy-formula-disposable.v1",
    nonce: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(fixtureDir, DISPOSABLE_MARKER), `${stableStringify(marker, 2)}\n`, "utf8");
  return { fixtureDir, marker };
}

function assertDisposableFixture(fixtureDir, dbPath = "") {
  const resolvedFixture = path.resolve(fixtureDir || "");
  const resolvedTemp = path.resolve(os.tmpdir());
  const relative = path.relative(resolvedTemp, resolvedFixture);
  if (
    !resolvedFixture ||
    !path.basename(resolvedFixture).startsWith(DISPOSABLE_PREFIX) ||
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("legacy formula operations require a newly created system-temp disposable fixture");
  }
  const markerPath = path.join(resolvedFixture, DISPOSABLE_MARKER);
  if (!fs.existsSync(markerPath)) throw new Error("disposable fixture marker is missing");
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  if (
    marker.kind !== "larkix.legacy-formula-disposable.v1" ||
    !/^[0-9a-f-]{36}$/i.test(String(marker.nonce || ""))
  ) {
    throw new Error("disposable fixture marker is invalid");
  }
  if (dbPath) {
    const resolvedDb = path.resolve(dbPath);
    const dbRelative = path.relative(resolvedFixture, resolvedDb);
    if (!dbRelative || dbRelative.startsWith("..") || path.isAbsolute(dbRelative)) {
      throw new Error("database must be contained by the disposable fixture");
    }
  }
  return marker;
}

function fileEvidence(filePath, role) {
  const stat = fs.statSync(filePath);
  return {
    role,
    path: path.resolve(filePath),
    sizeBytes: stat.size,
    sha256: sha256File(filePath)
  };
}

function createConsistentBackup({ db, dbPath, fixtureDir, backupDir }) {
  assertDisposableFixture(fixtureDir, dbPath);
  const targetDir =
    backupDir ||
    fs.mkdtempSync(path.join(path.resolve(fixtureDir), "backup-"));
  fs.mkdirSync(targetDir, { recursive: true });
  const backupDatabasePath = path.join(targetDir, "legacy-source.sqlite");
  const sourceExportPath = path.join(targetDir, "legacy-source-rows.json");
  const manifestPath = path.join(targetDir, "manifest.json");
  for (const target of [backupDatabasePath, sourceExportPath, manifestPath]) {
    if (fs.existsSync(target)) throw new Error(`backup target already exists: ${target}`);
  }

  const checkpointRows = db.prepare("PRAGMA wal_checkpoint(FULL)").all();
  const sourceMainHash = sha256File(dbPath);
  const inventory = sourceInventory(db);
  const state = schemaState(db);
  db.exec(`VACUUM INTO ${sqlString(backupDatabasePath)}`);

  const snapshotDb = new DatabaseSync(backupDatabasePath);
  const snapshotChecks = databaseChecks(snapshotDb);
  const snapshotInventory = sourceInventory(snapshotDb);
  const snapshotState = schemaState(snapshotDb);
  snapshotDb.close();
  if (!snapshotChecks.passed) throw new Error("VACUUM INTO snapshot failed SQLite integrity checks");
  if (
    snapshotInventory.exactDigest !== inventory.exactDigest ||
    stableStringify(snapshotState) !== stableStringify(state)
  ) {
    throw new Error("VACUUM INTO snapshot does not match source schema or legacy rows");
  }

  const sourceExport = {
    schemaVersion: "larkix.legacy-formula-source-export.v1",
    inventory,
    schemaState: state
  };
  fs.writeFileSync(sourceExportPath, `${stableStringify(sourceExport, 2)}\n`, "utf8");
  const files = [
    fileEvidence(backupDatabasePath, "sqlite-consistent-snapshot"),
    fileEvidence(sourceExportPath, "exact-legacy-source-export")
  ];
  const manifestBody = {
    schemaVersion: "larkix.legacy-formula-backup-manifest.v1",
    createdAt: new Date().toISOString(),
    method: {
      checkpoint: "PRAGMA wal_checkpoint(FULL)",
      snapshot: "VACUUM INTO",
      note: "The backup database is a SQLite-created consistent standalone snapshot, not a main-file copy."
    },
    source: {
      databasePath: path.resolve(dbPath),
      databaseMainSha256AfterCheckpoint: sourceMainHash,
      selectedRowCounts: inventory.selectedCounts,
      totalRowCounts: inventory.totalCounts,
      exactSourceDigest: inventory.exactDigest,
      normalizedSourceDigest: inventory.normalizedDigest,
      schemaState: state,
      checkpointRows
    },
    files,
    restoreInstructions: [
      "Verify every file size and SHA-256 from this manifest.",
      "Copy legacy-source.sqlite into a second isolated directory.",
      "Open it with a new SQLite connection.",
      "Run PRAGMA integrity_check and PRAGMA foreign_key_check.",
      "Compare schema migrations, source schemas, row counts, and exact source digest."
    ]
  };
  const manifestDigest = sha256(stableStringify(manifestBody));
  const manifest = { ...manifestBody, manifestDigest, manifestPath };
  fs.writeFileSync(manifestPath, `${stableStringify(manifest, 2)}\n`, "utf8");
  return manifest;
}

function verifyBackupManifest(manifest) {
  const manifestBody = { ...manifest };
  delete manifestBody.manifestDigest;
  delete manifestBody.manifestPath;
  const mismatches = [];
  const calculatedDigest = sha256(stableStringify(manifestBody));
  if (calculatedDigest !== manifest.manifestDigest) {
    mismatches.push(`manifest digest mismatch: ${calculatedDigest}`);
  }
  for (const file of manifest.files || []) {
    if (!fs.existsSync(file.path)) {
      mismatches.push(`backup file missing: ${file.path}`);
      continue;
    }
    const stat = fs.statSync(file.path);
    if (stat.size !== file.sizeBytes) mismatches.push(`backup size mismatch: ${file.path}`);
    const digest = sha256File(file.path);
    if (digest !== file.sha256) mismatches.push(`backup checksum mismatch: ${file.path}`);
  }
  return { passed: mismatches.length === 0, mismatches, calculatedDigest };
}

function restoreBackupToSecondDirectory({ manifest, fixtureDir, restoreDir }) {
  assertDisposableFixture(fixtureDir);
  const manifestCheck = verifyBackupManifest(manifest);
  if (!manifestCheck.passed) {
    return { passed: false, mismatches: manifestCheck.mismatches, manifestCheck };
  }
  const targetDir =
    restoreDir ||
    fs.mkdtempSync(path.join(path.resolve(fixtureDir), "restore-"));
  fs.mkdirSync(targetDir, { recursive: true });
  const sourceDatabase = manifest.files.find((file) => file.role === "sqlite-consistent-snapshot");
  const sourceExport = manifest.files.find((file) => file.role === "exact-legacy-source-export");
  if (!sourceDatabase || !sourceExport) {
    return { passed: false, mismatches: ["manifest backup roles are incomplete"], manifestCheck };
  }
  const restoredDatabasePath = path.join(targetDir, "restored.sqlite");
  if (fs.existsSync(restoredDatabasePath)) {
    return { passed: false, mismatches: ["restore destination already exists"], manifestCheck };
  }
  fs.copyFileSync(sourceDatabase.path, restoredDatabasePath);
  const restoredHash = sha256File(restoredDatabasePath);
  const restoredDb = new DatabaseSync(restoredDatabasePath);
  const sqliteChecks = databaseChecks(restoredDb);
  const restoredInventory = sourceInventory(restoredDb);
  const restoredState = schemaState(restoredDb);
  restoredDb.close();
  const exported = JSON.parse(fs.readFileSync(sourceExport.path, "utf8"));
  const mismatches = [];
  if (restoredHash !== sourceDatabase.sha256) mismatches.push("restored database checksum mismatch");
  if (!sqliteChecks.passed) mismatches.push("restored database SQLite checks failed");
  if (restoredInventory.exactDigest !== exported.inventory.exactDigest) {
    mismatches.push("restored source content digest mismatch");
  }
  if (stableStringify(restoredInventory.selectedCounts) !== stableStringify(exported.inventory.selectedCounts)) {
    mismatches.push("restored selected source counts mismatch");
  }
  if (stableStringify(restoredState) !== stableStringify(exported.schemaState)) {
    mismatches.push("restored schema or migration state mismatch");
  }
  const result = {
    passed: mismatches.length === 0,
    mismatches,
    restoreDir: targetDir,
    restoredDatabasePath,
    restoredDatabaseSha256: restoredHash,
    sqliteChecks,
    selectedRowCounts: restoredInventory.selectedCounts,
    exactSourceDigest: restoredInventory.exactDigest,
    schemaStateDigest: sha256(stableStringify(restoredState)),
    manifestCheck
  };
  result.verificationDigest = sha256(
    stableStringify({
      passed: result.passed,
      mismatches: result.mismatches,
      restoredDatabaseSha256: result.restoredDatabaseSha256,
      sqliteChecks: result.sqliteChecks,
      selectedRowCounts: result.selectedRowCounts,
      exactSourceDigest: result.exactSourceDigest,
      schemaStateDigest: result.schemaStateDigest
    })
  );
  return result;
}

function deterministicFormulaId(nodeId) {
  return `formula.legacy.${sha256(nodeId).slice("sha256:".length, "sha256:".length + 24)}`;
}

function deterministicFormulaSlug(node) {
  const digest = sha256(node.id).slice("sha256:".length, "sha256:".length + 10);
  const stem = String(node.slug || "formula").slice(0, 56).replace(/-+$/g, "");
  return `legacy-${stem}-${digest}`.slice(0, 80);
}

function deterministicBindingId(postId, linkId, occurrence) {
  const digest = sha256(stableStringify([postId, Number(linkId), Number(occurrence)]))
    .slice("sha256:".length, "sha256:".length + 32);
  return `bind.legacy.${digest}`;
}

function legacyTags(node) {
  const values = String(node.tags || "")
    .split(/[,，、]/)
    .map((tag) =>
      tag
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48)
    )
    .filter(Boolean)
    .map((tag) => `legacy:${tag}`);
  values.push(`legacy:${node.node_type || node.nodeType || "derivation"}`);
  return [...new Set(values)].sort();
}

function targetStatusForNode(node) {
  if (node.deleted_at || node.deletedAt || node.publish_status === "archived" || node.publishStatus === "archived") {
    return "archived";
  }
  const publishStatus = node.publish_status || node.publishStatus || "draft";
  const visibilityStatus = node.visibility_status || node.visibilityStatus || "public";
  return publishStatus === "published" && ["public", "unlisted"].includes(visibilityStatus)
    ? "published"
    : "draft";
}

function legacyNodeView(value) {
  const node = value?.node || value || {};
  return {
    id: String(node.id || ""),
    slug: String(node.slug || ""),
    node_type: String(node.node_type || node.nodeType || "derivation"),
    symbol: String(node.symbol || ""),
    title: String(node.title || ""),
    summary: String(node.summary || ""),
    markdown: String(node.markdown || ""),
    cover: String(node.cover || ""),
    accent_color: String(node.accent_color || node.accentColor || "purple"),
    tags: String(node.tags || ""),
    publish_status: String(node.publish_status || node.publishStatus || "draft"),
    visibility_status: String(node.visibility_status || node.visibilityStatus || "public"),
    deleted_at: node.deleted_at || node.deletedAt || null,
    created_at: node.created_at || node.createdAt || null,
    updated_at: node.updated_at || node.updatedAt || null,
    published_at: node.published_at || node.publishedAt || null
  };
}

function formulaMetadata(node) {
  return {
    displayName: node.title,
    moduleKey: "legacy-formulas",
    categoryPath: `Legacy/${node.node_type}`,
    purpose: node.summary,
    tags: legacyTags(node)
  };
}

function formulaTargetRow(db, formulaId) {
  return (
    db
      .prepare(
        `SELECT card.formula_id AS formulaId, card.slug, card.display_name AS displayName,
                card.module_key AS moduleKey, card.category_path AS categoryPath,
                card.purpose, card.current_revision_id AS currentRevisionId,
                card.published_revision_id AS publishedRevisionId,
                card.publish_status AS publishStatus, card.archived_at AS archivedAt,
                revision.sequence_no AS currentRevisionSequence,
                revision.latex, revision.markdown_derivation AS markdownDerivation,
                revision.display_name AS revisionDisplayName,
                revision.module_key AS revisionModuleKey,
                revision.category_path AS revisionCategoryPath,
                revision.purpose AS revisionPurpose,
                revision.tags_json AS revisionTagsJson,
                revision.source_formula_id AS sourceFormulaId
         FROM formula_cards card
         LEFT JOIN formula_revisions revision ON revision.revision_id = card.current_revision_id
         WHERE card.formula_id = ?`
      )
      .get(formulaId) || null
  );
}

function formulaRevisionCompatible(db, revisionId, formulaId, content) {
  if (!revisionId) return false;
  const row = db
    .prepare(
      `SELECT formula_id AS formulaId, latex,
              markdown_derivation AS markdownDerivation,
              display_name AS displayName, module_key AS moduleKey,
              category_path AS categoryPath, purpose, tags_json AS tagsJson
       FROM formula_revisions WHERE revision_id = ?`
    )
    .get(revisionId);
  if (!row || row.formulaId !== formulaId) return false;
  let tags;
  try {
    tags = JSON.parse(row.tagsJson || "[]");
  } catch {
    return false;
  }
  const dependencies = db
    .prepare(
      `SELECT target_formula_id AS targetFormulaId
       FROM formula_revision_dependencies
       WHERE revision_id = ?
       ORDER BY ordinal ASC, target_formula_id ASC`
    )
    .all(revisionId)
    .map((dependency) => dependency.targetFormulaId);
  return (
    row.latex === content.latex &&
    row.markdownDerivation === content.markdownDerivation &&
    row.displayName === content.displayName &&
    row.moduleKey === content.moduleKey &&
    row.categoryPath === content.categoryPath &&
    row.purpose === content.purpose &&
    stableStringify(tags) === stableStringify(content.tags) &&
    stableStringify(dependencies) === stableStringify(content.dependencyFormulaIds)
  );
}

function formulaTargetCompatible(db, target, node, content) {
  if (!target) return false;
  const metadata = formulaMetadata(node);
  return (
    (target.revisionDisplayName || target.displayName) === metadata.displayName &&
    (target.revisionModuleKey || target.moduleKey) === metadata.moduleKey &&
    (target.revisionCategoryPath || target.categoryPath) === metadata.categoryPath &&
    (target.revisionPurpose ?? target.purpose ?? "") === metadata.purpose &&
    target.publishStatus === targetStatusForNode(node) &&
    formulaRevisionCompatible(db, target.currentRevisionId, target.formulaId, content)
  );
}

function existingMappingRows(db) {
  return new Map(
    db
      .prepare(
        `SELECT source_table AS sourceTable, source_key AS sourceKey,
                source_digest AS sourceDigest, disposition, target_kind AS targetKind,
                target_ids_json AS targetIdsJson, merge_key AS mergeKey, reason
         FROM legacy_formula_mappings
         ORDER BY source_table ASC, source_key ASC`
      )
      .all()
      .map((row) => [`${row.sourceTable}:${row.sourceKey}`, row])
  );
}

function mappingRecord({
  sourceTable,
  sourceKey,
  sourceRow,
  disposition,
  targetKind = "",
  targetIds = [],
  mergeKey = "",
  reason = "",
  sourceStatus = {}
}) {
  return {
    sourceTable,
    sourceKey: String(sourceKey),
    sourceRow,
    sourceDigest: rowDigest(sourceRow),
    disposition,
    targetKind,
    targetIds,
    mergeKey,
    reason,
    sourceStatus
  };
}

function findFormulaCandidates(db, node, mappingRule) {
  if (Array.isArray(mappingRule)) {
    return { ambiguous: true, reason: "explicit mapping contains multiple targets", candidates: mappingRule };
  }
  if (mappingRule) {
    const formulaId = String(mappingRule.targetFormulaId || mappingRule.formulaId || "");
    if (formulaId) {
      return {
        explicitTarget: true,
        ruleProvided: true,
        mergeKey: String(mappingRule.mergeKey || ""),
        candidates: [formulaId]
      };
    }
  }
  const generatedId = deterministicFormulaId(node.id);
  const candidates = new Set();
  if (formulaTargetRow(db, generatedId)) candidates.add(generatedId);
  for (const row of db
    .prepare(
      `SELECT DISTINCT formula_id AS formulaId
       FROM formula_revisions
       WHERE source_formula_id IN (?, ?)
       ORDER BY formula_id ASC`
    )
    .all(node.id, node.slug)) {
    candidates.add(row.formulaId);
  }
  const slugRow = db
    .prepare("SELECT formula_id AS formulaId FROM formula_cards WHERE slug = ?")
    .get(node.slug);
  if (slugRow) candidates.add(slugRow.formulaId);
  return {
    explicitTarget: false,
    ruleProvided: Boolean(mappingRule),
    mergeKey: String(mappingRule?.mergeKey || ""),
    candidates: [...candidates].sort()
  };
}

function revisionIdentity({
  formulaId,
  node,
  exactLatex,
  markdownDerivation,
  dependencyFormulaIds
}) {
  const metadata = formulaMetadata(node);
  const content = {
    formulaId,
    latex: exactLatex,
    markdownDerivation,
    ...metadata,
    dependencyFormulaIds
  };
  return {
    revisionId: `rev.legacy.${sha256(stableStringify(content)).slice("sha256:".length, "sha256:".length + 40)}`,
    exactContentDigest: sha256(stableStringify(content)),
    normalizedContentDigest: sha256(
      stableStringify({
        ...content,
        latex: normalizedDigestText(content.latex),
        markdownDerivation: normalizedDigestText(content.markdownDerivation)
      })
    ),
    content
  };
}

function latexRuleEntry(mappingRule, source) {
  if (!mappingRule || typeof mappingRule !== "object") return null;
  if (source.current) {
    if (!mappingRule.exactLatex || !mappingRule.latexSourceEvidence) return null;
    return {
      exactLatex: String(mappingRule.exactLatex),
      sourceEvidence: String(mappingRule.latexSourceEvidence),
      decision: "mapping_rule_exact_latex"
    };
  }
  const revisionRules = mappingRule.revisionLatex || {};
  const key = `${source.sourceTable}:${source.sourceKey}`;
  const entry = revisionRules[key] || revisionRules[source.sourceKey];
  if (!entry || typeof entry !== "object" || !entry.exactLatex || !entry.sourceEvidence) {
    return null;
  }
  return {
    exactLatex: String(entry.exactLatex),
    sourceEvidence: String(entry.sourceEvidence),
    decision: "mapping_rule_revision_exact_latex"
  };
}

function resolveLatexDecision(mappingRule, source, target) {
  const explicit = latexRuleEntry(mappingRule, source);
  if (explicit) {
    if (!explicit.exactLatex.trim() || !explicit.sourceEvidence.trim()) return null;
    return {
      ...explicit,
      legacySymbol: source.node.symbol,
      sourceKey: `${source.sourceTable}:${source.sourceKey}`
    };
  }
  if (
    source.current &&
    target?.latex &&
    [source.node.id, source.node.slug].includes(target.sourceFormulaId)
  ) {
    return {
      exactLatex: target.latex,
      sourceEvidence: `existing immutable revision ${target.currentRevisionId} declares source_formula_id=${target.sourceFormulaId}`,
      decision: "existing_revision_source_provenance",
      legacySymbol: source.node.symbol,
      sourceKey: `${source.sourceTable}:${source.sourceKey}`
    };
  }
  if (
    source.current &&
    target?.latex &&
    mappingRule?.targetFormulaId &&
    String(mappingRule.latexSourceEvidence || "").trim()
  ) {
    return {
      exactLatex: target.latex,
      sourceEvidence: String(mappingRule.latexSourceEvidence),
      decision: "explicit_compatible_target_revision",
      legacySymbol: source.node.symbol,
      sourceKey: `${source.sourceTable}:${source.sourceKey}`
    };
  }
  return null;
}

function findCompatibleFormulaRevision(db, formulaId, content) {
  const candidates = db
    .prepare(
      `SELECT revision_id AS revisionId, sequence_no AS sequenceNo
       FROM formula_revisions
       WHERE formula_id = ?
       ORDER BY sequence_no ASC, revision_id ASC`
    )
    .all(formulaId);
  return (
    candidates.find((candidate) =>
      formulaRevisionCompatible(db, candidate.revisionId, formulaId, content)
    ) || null
  );
}

function convertLegacyDerivationMarkdown({ node, links, targetBySlug, sourceFormulaId }) {
  let references;
  try {
    references = extractLegacyDeriveReferences(node.markdown);
  } catch (error) {
    return { error: error.message };
  }
  const seenSlugs = new Set();
  const replacements = [];
  const dependencyFormulaIds = [];
  for (const reference of references) {
    if (seenSlugs.has(reference.targetSlug)) {
      return {
        error: `duplicate legacy dependency shortcode cannot map uniquely: ${reference.targetSlug}`
      };
    }
    seenSlugs.add(reference.targetSlug);
    const target = targetBySlug.get(reference.targetSlug);
    if (!target) {
      return { error: `dependency target is missing or unresolved: ${reference.targetSlug}` };
    }
    if (target.formulaId === sourceFormulaId) {
      return { error: `dependency self-loop: ${reference.targetSlug}` };
    }
    dependencyFormulaIds.push(target.formulaId);
    replacements.push({
      start: reference.start,
      end: reference.end,
      shortcode: `{{formula-ref:${target.formulaId}}}`
    });
  }
  const linkedSlugs = [...new Set(
    (links || []).map((link) => String(link.target_slug || link.targetSlug || ""))
  )];
  if (
    stableStringify([...seenSlugs].sort()) !== stableStringify(linkedSlugs.sort())
  ) {
    return {
      error: `Markdown dependency shortcodes and knowledge_links differ: markdown=${[
        ...seenSlugs
      ].join(",")} links=${linkedSlugs.join(",")}`
    };
  }
  let markdownDerivation = node.markdown;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    markdownDerivation =
      markdownDerivation.slice(0, replacement.start) +
      replacement.shortcode +
      markdownDerivation.slice(replacement.end);
  }
  if (extractLegacyDeriveReferences(markdownDerivation).length > 0) {
    return { error: "migrated Markdown still contains a legacy derive shortcode" };
  }
  const parsedDependencies = extractFormulaDependencyReferences(markdownDerivation);
  if (stableStringify(parsedDependencies) !== stableStringify(dependencyFormulaIds)) {
    return { error: "migrated Markdown formula-ref set does not match planned dependencies" };
  }
  return {
    markdownDerivation,
    originalMarkdown: node.markdown,
    originalMarkdownDigest: sha256(node.markdown),
    migratedMarkdownDigest: sha256(markdownDerivation),
    dependencyFormulaIds
  };
}

function parseSnapshotRevision(row) {
  try {
    const snapshot = JSON.parse(row.snapshot_json);
    return { node: legacyNodeView(snapshot), links: Array.isArray(snapshot.links) ? snapshot.links : [] };
  } catch (error) {
    return { error: `invalid snapshot JSON: ${error.message}` };
  }
}

function wouldContainCycle(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceFormulaId)) adjacency.set(edge.sourceFormulaId, []);
    adjacency.get(edge.sourceFormulaId).push(edge.targetFormulaId);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const target of adjacency.get(node) || []) {
      if (visit(target)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return [...adjacency.keys()].some(visit);
}

function publicLegacyNode(node) {
  return (
    node.publish_status === "published" &&
    ["public", "unlisted"].includes(node.visibility_status) &&
    !node.deleted_at
  );
}

function postRow(db, id) {
  return (
    db
      .prepare(
        `SELECT id, slug, title, category, category_key, recommendation_priority,
                excerpt, cover, markdown, read_time, date, publish_status, featured,
                featured_order, deleted_at, tags, created_at, updated_at, published_at
         FROM posts WHERE id = ?`
      )
      .get(id) || null
  );
}

function postSnapshot(row) {
  return {
    id: row.id,
    slug: row.slug,
    type: "post",
    title: row.title,
    category: row.category,
    categoryKey: row.category_key,
    recommendationPriority: Number(row.recommendation_priority || 100),
    excerpt: row.excerpt || "",
    cover: row.cover || "",
    markdown: row.markdown,
    readTime: row.read_time || "",
    date: row.date || "",
    publishStatus: row.publish_status,
    featured: Number(row.featured || 0),
    featuredOrder: Number(row.featured_order || 0),
    deletedAt: row.deleted_at || null,
    tags: row.tags || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    publishedAt: row.published_at || null
  };
}

function sourceStatus(node) {
  return {
    publishStatus: node.publish_status,
    visibilityStatus: node.visibility_status,
    deletedAt: node.deleted_at
  };
}

function buildMigrationPlan(db, options = {}) {
  const inventory = sourceInventory(db);
  const mappings = [];
  const issues = [];
  const formulas = [];
  const articleTransforms = [];
  const relations = [];
  const redirects = [];
  const nodeTargets = new Map();
  const existingMappings = existingMappingRows(db);
  const mappingRules = options.mappingRules || {};

  for (const rawNode of inventory.nodes) {
    const node = legacyNodeView(rawNode);
    const rule = mappingRules[node.id] || mappingRules[node.slug];
    const candidateResult = findFormulaCandidates(db, node, rule);
    if (!node.title.trim() || !node.slug) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: node.id,
          sourceRow: rawNode,
          disposition: "unresolved",
          reason: "legacy node is missing title or slug",
          sourceStatus: sourceStatus(node)
        })
      );
      continue;
    }
    if (candidateResult.ambiguous || candidateResult.candidates.length > 1) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: node.id,
          sourceRow: rawNode,
          disposition: "unresolved",
          reason: candidateResult.reason || `ambiguous formula targets: ${candidateResult.candidates.join(", ")}`,
          sourceStatus: sourceStatus(node)
        })
      );
      continue;
    }
    let formulaId = candidateResult.candidates[0] || deterministicFormulaId(node.id);
    let target = formulaTargetRow(db, formulaId);
    let create = !target;
    const targetSlug = create ? deterministicFormulaSlug(node) : target.slug;
    if (candidateResult.explicitTarget && !target) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: node.id,
          sourceRow: rawNode,
          disposition: "unresolved",
          reason: `explicit formula target is missing: ${formulaId}`,
          sourceStatus: sourceStatus(node)
        })
      );
      continue;
    }
    const currentSource = {
      sourceTable: "knowledge_nodes",
      sourceKey: node.id,
      sourceRow: rawNode,
      node,
      current: true
    };
    const currentLatexDecision = resolveLatexDecision(rule, currentSource, target);
    if (!currentLatexDecision) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: node.id,
          sourceRow: rawNode,
          disposition: "unresolved",
          reason:
            `no traceable exact conclusion LaTeX; legacy symbol is treated as a label only: ` +
            `${node.symbol || "(empty)"}`,
          sourceStatus: sourceStatus(node)
        })
      );
      continue;
    }
    const slugOwner = db
      .prepare("SELECT formula_id AS formulaId FROM formula_cards WHERE slug = ?")
      .get(targetSlug);
    if (create && slugOwner && slugOwner.formulaId !== formulaId) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: node.id,
          sourceRow: rawNode,
          disposition: "unresolved",
          reason: `deterministic target slug is occupied: ${targetSlug}`,
          sourceStatus: sourceStatus(node)
        })
      );
      continue;
    }
    const managedExisting =
      target &&
      (target.formulaId === deterministicFormulaId(node.id) ||
        target.sourceFormulaId === node.id ||
        target.sourceFormulaId === node.slug);
    const targetInfo = {
      node,
      rawNode,
      rule,
      currentLatexDecision,
      existingTarget: target,
      formulaId,
      slug: targetSlug,
      create,
      managed: create || managedExisting,
      allowAppendRevisions:
        Boolean(managedExisting) ||
        (Boolean(candidateResult.explicitTarget) &&
          rule?.allowAppendHistoricalRevisions === true),
      mergeKey: candidateResult.mergeKey || "",
      explicitTarget: Boolean(candidateResult.explicitTarget),
      status: targetStatusForNode(node),
      metadata: formulaMetadata(node),
      revisions: [],
      currentRevisionId: "",
      publishedRevisionId: ""
    };
    nodeTargets.set(node.id, targetInfo);
    formulas.push(targetInfo);
  }

  const targetBySlug = new Map(
    [...nodeTargets.values()].map((target) => [target.node.slug, target])
  );
  const currentLinksByNode = new Map();
  for (const link of inventory.links) {
    if (link.source_type !== "knowledge_node" || !nodeTargets.has(link.source_id)) continue;
    if (!currentLinksByNode.has(link.source_id)) currentLinksByNode.set(link.source_id, []);
    currentLinksByNode.get(link.source_id).push(link);
  }

  const plannedRevisionIds = new Map();
  for (const formula of formulas) {
    const historyRows = inventory.revisions.filter((revision) => revision.node_id === formula.node.id);
    const revisionSources = [];
    for (const row of historyRows) {
      const parsed = parseSnapshotRevision(row);
      if (parsed.error) {
        mappings.push(
          mappingRecord({
            sourceTable: "knowledge_node_revisions",
            sourceKey: row.id,
            sourceRow: row,
            disposition: "unresolved",
            reason: parsed.error,
            sourceStatus: {}
          })
        );
        continue;
      }
      revisionSources.push({
        sourceTable: "knowledge_node_revisions",
        sourceKey: String(row.id),
        sourceRow: row,
        node: parsed.node,
        links: parsed.links
      });
    }
    revisionSources.push({
      sourceTable: "knowledge_nodes",
      sourceKey: formula.node.id,
      sourceRow: formula.rawNode,
      node: formula.node,
      links: currentLinksByNode.get(formula.node.id) || [],
      current: true
    });

    let nextSequence = Number(
      db
        .prepare("SELECT COALESCE(MAX(sequence_no), 0) AS sequence FROM formula_revisions WHERE formula_id = ?")
        .get(formula.formulaId).sequence || 0
    );
    for (const source of revisionSources) {
      const conversion = convertLegacyDerivationMarkdown({
        node: source.node,
        links: source.links,
        targetBySlug,
        sourceFormulaId: formula.formulaId
      });
      if (conversion.error) {
        if (source.sourceTable === "knowledge_node_revisions") {
          mappings.push(
            mappingRecord({
              sourceTable: source.sourceTable,
              sourceKey: source.sourceKey,
              sourceRow: source.sourceRow,
              disposition: "unresolved",
              reason: conversion.error,
              sourceStatus: {}
            })
          );
        } else {
          formula.currentFailure = conversion.error;
        }
        continue;
      }
      const latexDecision = source.current
        ? formula.currentLatexDecision
        : resolveLatexDecision(formula.rule, source, formula.existingTarget);
      if (!latexDecision) {
        const reason =
          `no traceable exact conclusion LaTeX for ${source.sourceTable}:${source.sourceKey}; ` +
          `legacy symbol is treated as a label only: ${source.node.symbol || "(empty)"}`;
        if (source.sourceTable === "knowledge_node_revisions") {
          mappings.push(
            mappingRecord({
              sourceTable: source.sourceTable,
              sourceKey: source.sourceKey,
              sourceRow: source.sourceRow,
              disposition: "unresolved",
              reason,
              sourceStatus: {}
            })
          );
        } else {
          formula.currentFailure = reason;
        }
        continue;
      }
      const identity = revisionIdentity({
        formulaId: formula.formulaId,
        node: source.node,
        exactLatex: latexDecision.exactLatex,
        markdownDerivation: conversion.markdownDerivation,
        dependencyFormulaIds: conversion.dependencyFormulaIds
      });
      let revisionId = identity.revisionId;
      let sequenceNo = 0;
      let createRevision = false;
      let disposition = "mapped";
      let dispositionReason = "deterministic immutable revision";
      const compatibleExisting = findCompatibleFormulaRevision(
        db,
        formula.formulaId,
        identity.content
      );

      if (source.current && formula.existingTarget) {
        if (
          !formulaTargetCompatible(
            db,
            formula.existingTarget,
            source.node,
            identity.content
          )
        ) {
          formula.currentFailure =
            `existing target content, metadata, status, or dependencies do not exactly match: ` +
            `${formula.formulaId}`;
          continue;
        }
        revisionId = formula.existingTarget.currentRevisionId;
        sequenceNo = Number(formula.existingTarget.currentRevisionSequence || 0);
        dispositionReason = "exact compatible immutable current revision reused";
      } else if (compatibleExisting) {
        revisionId = compatibleExisting.revisionId;
        sequenceNo = Number(compatibleExisting.sequenceNo);
        disposition = "merged";
        dispositionReason = "exact compatible immutable revision reused";
      } else {
        const stored = db
          .prepare(
            `SELECT formula_id AS formulaId, sequence_no AS sequenceNo
             FROM formula_revisions WHERE revision_id = ?`
          )
          .get(identity.revisionId);
        if (stored && stored.formulaId !== formula.formulaId) {
          const reason = `deterministic revision identity collision: ${identity.revisionId}`;
          if (source.sourceTable === "knowledge_node_revisions") {
            mappings.push(
              mappingRecord({
                sourceTable: source.sourceTable,
                sourceKey: source.sourceKey,
                sourceRow: source.sourceRow,
                disposition: "unresolved",
                reason
              })
            );
          } else {
            formula.currentFailure = reason;
          }
          continue;
        }
        if (!formula.create && !formula.allowAppendRevisions) {
          const reason =
            `existing target has no exact immutable revision and append was not explicitly allowed: ` +
            `${formula.formulaId}`;
          if (source.sourceTable === "knowledge_node_revisions") {
            mappings.push(
              mappingRecord({
                sourceTable: source.sourceTable,
                sourceKey: source.sourceKey,
                sourceRow: source.sourceRow,
                disposition: "unresolved",
                reason
              })
            );
          } else {
            formula.currentFailure = reason;
          }
          continue;
        }
        const planned = plannedRevisionIds.get(identity.revisionId);
        if (planned && planned.exactContentDigest !== identity.exactContentDigest) {
          const reason = `planned revision identity collision: ${identity.revisionId}`;
          if (source.sourceTable === "knowledge_node_revisions") {
            mappings.push(
              mappingRecord({
                sourceTable: source.sourceTable,
                sourceKey: source.sourceKey,
                sourceRow: source.sourceRow,
                disposition: "unresolved",
                reason
              })
            );
          } else {
            formula.currentFailure = reason;
          }
          continue;
        }
        if (planned) {
          sequenceNo = planned.sequenceNo;
          disposition = "merged";
          dispositionReason = "exact planned immutable revision reused";
        } else {
          nextSequence += 1;
          sequenceNo = nextSequence;
          createRevision = !stored;
          plannedRevisionIds.set(identity.revisionId, {
            exactContentDigest: identity.exactContentDigest,
            sequenceNo
          });
        }
      }

      if (!revisionId || !sequenceNo) {
        const reason = `immutable revision identity or sequence is missing: ${identity.revisionId}`;
        if (source.sourceTable === "knowledge_node_revisions") {
          mappings.push(
            mappingRecord({
              sourceTable: source.sourceTable,
              sourceKey: source.sourceKey,
              sourceRow: source.sourceRow,
              disposition: "unresolved",
              reason
            })
          );
        } else {
          formula.currentFailure = reason;
        }
        continue;
      }
      const revision = {
        ...identity,
        revisionId,
        formulaId: formula.formulaId,
        sequenceNo,
        sourceTable: source.sourceTable,
        sourceKey: source.sourceKey,
        sourceRow: source.sourceRow,
        sourceNode: source.node,
        dependencyFormulaIds: conversion.dependencyFormulaIds,
        originalMarkdown: conversion.originalMarkdown,
        originalMarkdownDigest: conversion.originalMarkdownDigest,
        migratedMarkdownDigest: conversion.migratedMarkdownDigest,
        latexDecision,
        current: Boolean(source.current),
        create: createRevision
      };
      formula.revisions.push(revision);
      if (source.current) {
        formula.currentRevisionId = revisionId;
        formula.publishedRevisionId = formula.status === "published" ? revisionId : "";
      } else {
        const priorMapping = existingMappings.get(
          `${source.sourceTable}:${source.sourceKey}`
        );
        let priorTargetIds = [];
        try {
          priorTargetIds = JSON.parse(priorMapping?.targetIdsJson || "[]");
        } catch {
          priorTargetIds = [];
        }
        const reusePriorDisposition =
          priorMapping?.sourceDigest === rowDigest(source.sourceRow) &&
          priorMapping.targetKind === "formula_revision" &&
          priorTargetIds.some((targetId) =>
            typeof targetId === "string"
              ? targetId === revisionId
              : targetId?.revisionId === revisionId
          );
        mappings.push(
          mappingRecord({
            sourceTable: "knowledge_node_revisions",
            sourceKey: source.sourceKey,
            sourceRow: source.sourceRow,
            disposition: reusePriorDisposition
              ? priorMapping.disposition
              : disposition,
            targetKind: reusePriorDisposition
              ? priorMapping.targetKind
              : "formula_revision",
            targetIds: reusePriorDisposition
              ? priorTargetIds
              : [
                  {
                    revisionId,
                    formulaId: formula.formulaId,
                    exactContentDigest: identity.exactContentDigest,
                    originalMarkdownDigest: conversion.originalMarkdownDigest,
                    migratedMarkdownDigest: conversion.migratedMarkdownDigest,
                    latexDecision
                  }
                ],
            mergeKey: reusePriorDisposition
              ? priorMapping.mergeKey
              : disposition === "merged"
                ? identity.exactContentDigest
                : "",
            reason: reusePriorDisposition ? priorMapping.reason : dispositionReason
          })
        );
      }
    }
    if (!formula.currentRevisionId) {
      formula.currentFailure =
        formula.currentFailure || "current immutable revision could not be mapped";
    }
  }

  const formulaGroups = new Map();
  for (const formula of formulas) {
    if (!formulaGroups.has(formula.formulaId)) formulaGroups.set(formula.formulaId, []);
    formulaGroups.get(formula.formulaId).push(formula);
  }
  for (const group of formulaGroups.values()) {
    const merged = group.length > 1;
    let mergeFailure = "";
    if (merged) {
      const mergeKeys = new Set(group.map((formula) => formula.mergeKey));
      const proofDigests = new Set(
        group.map((formula) => {
          const current = formula.revisions.find((revision) => revision.current);
          return sha256(
            stableStringify({
              exactContentDigest: current?.exactContentDigest || "",
              currentRevisionId: formula.currentRevisionId,
              targetStatus: formula.status,
              sourceStatus: sourceStatus(formula.node)
            })
          );
        })
      );
      if (
        !group.every((formula) => formula.explicitTarget) ||
        mergeKeys.size !== 1 ||
        !group[0].mergeKey ||
        proofDigests.size !== 1
      ) {
        mergeFailure =
          "explicit merge requires one non-empty mergeKey and exact mathematical, Markdown, " +
          "metadata, source-status, target-status, and immutable revision identity proof";
      }
    }
    for (const formula of group) {
      const current = formula.revisions.find((revision) => revision.current);
      const failure = formula.currentFailure || mergeFailure;
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_nodes",
          sourceKey: formula.node.id,
          sourceRow: formula.rawNode,
          disposition: failure ? "unresolved" : merged ? "merged" : "mapped",
          targetKind: failure ? "" : "formula_card",
          targetIds: failure
            ? []
            : [
                {
                  formulaId: formula.formulaId,
                  slug: formula.slug,
                  currentRevisionId: formula.currentRevisionId,
                  publishedRevisionId: formula.publishedRevisionId || null,
                  exactContentDigest: current.exactContentDigest,
                  originalMarkdownDigest: current.originalMarkdownDigest,
                  migratedMarkdownDigest: current.migratedMarkdownDigest,
                  latexDecision: current.latexDecision
                }
              ],
          mergeKey: !failure && merged ? formula.mergeKey : "",
          reason: failure
            ? failure
            : merged
              ? "explicit merge key with exact immutable content and status proof"
              : "deterministic formula identity with traceable exact LaTeX",
          sourceStatus: sourceStatus(formula.node)
        })
      );
    }
  }

  const articleWork = new Map();
  for (const link of inventory.links) {
    const linkSourceKey = String(link.id);
    const sourceTarget = nodeTargets.get(link.source_id);
    const target = targetBySlug.get(link.target_slug);
    if (link.source_type === "knowledge_node" && sourceTarget) {
      if (!target || !sourceTarget.currentRevisionId) {
        mappings.push(
          mappingRecord({
            sourceTable: "knowledge_links",
            sourceKey: linkSourceKey,
            sourceRow: link,
            disposition: "unresolved",
            reason: `knowledge-node dependency target is missing or unresolved: ${link.target_slug}`
          })
        );
        continue;
      }
      const currentRevision = sourceTarget.revisions.find((revision) => revision.current);
      const dependencyOrdinal =
        currentRevision?.dependencyFormulaIds.indexOf(target.formulaId) ?? -1;
      if (dependencyOrdinal < 0) {
        mappings.push(
          mappingRecord({
            sourceTable: "knowledge_links",
            sourceKey: linkSourceKey,
            sourceRow: link,
            disposition: "unresolved",
            reason:
              "knowledge-node relation is not represented by one unique migrated Markdown formula-ref"
          })
        );
        continue;
      }
      const relation = {
        linkId: Number(link.id),
        revisionId: sourceTarget.currentRevisionId,
        sourceFormulaId: sourceTarget.formulaId,
        targetFormulaId: target.formulaId,
        ordinal: dependencyOrdinal,
        provenance: "markdown"
      };
      relations.push(relation);
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "mapped",
          targetKind: "formula_dependency",
          targetIds: [relation],
          reason: "position-stable migrated Markdown formula-ref plus matching legacy relation"
        })
      );
      continue;
    }
    if (!target) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "unresolved",
          reason: `link target is missing or unresolved: ${link.target_slug}`
        })
      );
      continue;
    }
    if (link.source_type !== "post") {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "unresolved",
          reason: `${link.source_type} legacy reference has no safe new binding rewrite`
        })
      );
      continue;
    }
    const post = postRow(db, link.source_id);
    if (!post) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "unresolved",
          reason: `post source is missing: ${link.source_id}`
        })
      );
      continue;
    }
    const targetRevisionId =
      post.publish_status === "published" ? target.publishedRevisionId : target.currentRevisionId;
    if (!targetRevisionId) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "unresolved",
          reason: "published article cannot bind a draft/private/missing formula target"
        })
      );
      continue;
    }
    const priorMapping = existingMappings.get(`knowledge_links:${linkSourceKey}`);
    const references = extractLegacyDeriveReferences(post.markdown).filter(
      (reference) => reference.targetSlug === link.target_slug
    );
    if (!references.length && priorMapping?.targetKind === "article_bindings") {
      let priorTargets = [];
      try {
        priorTargets = JSON.parse(priorMapping.targetIdsJson);
      } catch {
        priorTargets = [];
      }
      const idempotent = priorTargets.length > 0 && priorTargets.every((binding) => {
        const row = db
          .prepare(
            `SELECT binding_id AS bindingId, post_id AS postId, formula_id AS formulaId,
                    revision_id AS revisionId, display_mode AS displayMode
             FROM article_formula_bindings WHERE binding_id = ?`
          )
          .get(binding.bindingId);
        const shortcode = `{{formula:${binding.bindingId}|${binding.formulaId}|${binding.revisionId}|${binding.displayMode}}}`;
        return (
          row &&
          row.postId === post.id &&
          row.formulaId === binding.formulaId &&
          row.revisionId === binding.revisionId &&
          post.markdown.includes(shortcode)
        );
      });
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: idempotent ? "mapped" : "unresolved",
          targetKind: idempotent ? "article_bindings" : "",
          targetIds: idempotent ? priorTargets : [],
          reason: idempotent
            ? "idempotent article shortcode and binding already verified"
            : "legacy article shortcode is missing without verified bindings"
        })
      );
      continue;
    }
    if (!references.length) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: linkSourceKey,
          sourceRow: link,
          disposition: "unresolved",
          reason: `post Markdown has no matching derive shortcode: ${link.target_slug}`
        })
      );
      continue;
    }
    if (!articleWork.has(post.id)) {
      articleWork.set(post.id, { post, replacements: [], bindings: [] });
    }
    const work = articleWork.get(post.id);
    const bindingTargets = references.map((reference, index) => {
      const binding = {
        bindingId: deterministicBindingId(post.id, link.id, index),
        postId: post.id,
        formulaId: target.formulaId,
        revisionId: targetRevisionId,
        displayMode: "inline",
        sourceLinkId: Number(link.id),
        sourceTargetSlug: link.target_slug
      };
      const shortcode = `{{formula:${binding.bindingId}|${binding.formulaId}|${binding.revisionId}|inline}}`;
      work.replacements.push({ start: reference.start, end: reference.end, shortcode, bindingId: binding.bindingId });
      work.bindings.push(binding);
      return binding;
    });
    mappings.push(
      mappingRecord({
        sourceTable: "knowledge_links",
        sourceKey: linkSourceKey,
        sourceRow: link,
        disposition: "mapped",
        targetKind: "article_bindings",
        targetIds: bindingTargets,
        reason: "position-stable Markdown rewrite plus immutable article binding"
      })
    );
  }

  for (const work of articleWork.values()) {
    const sorted = [...work.replacements].sort((left, right) => right.start - left.start);
    let migratedMarkdown = work.post.markdown;
    let lastStart = migratedMarkdown.length + 1;
    for (const replacement of sorted) {
      if (replacement.end > lastStart) {
        issues.push(`posts:${work.post.id}: overlapping derive shortcode replacements`);
        continue;
      }
      migratedMarkdown =
        migratedMarkdown.slice(0, replacement.start) +
        replacement.shortcode +
        migratedMarkdown.slice(replacement.end);
      lastStart = replacement.start;
    }
    const formulaOrder = [];
    let match;
    FORMULA_REFERENCE_PATTERN.lastIndex = 0;
    while ((match = FORMULA_REFERENCE_PATTERN.exec(migratedMarkdown))) formulaOrder.push(match[1]);
    work.bindings.forEach((binding) => {
      binding.ordinal = formulaOrder.indexOf(binding.bindingId);
      if (binding.ordinal < 0) issues.push(`posts:${work.post.id}: migrated binding shortcode is missing`);
    });
    articleTransforms.push({
      postId: work.post.id,
      originalMarkdown: work.post.markdown,
      originalMarkdownDigest: sha256(work.post.markdown),
      migratedMarkdown,
      migratedMarkdownDigest: sha256(migratedMarkdown),
      originalSnapshot: postSnapshot(work.post),
      bindings: work.bindings.sort((left, right) => left.ordinal - right.ordinal)
    });
  }

  const allCurrentEdges = db
    .prepare(
      `SELECT dependency.source_formula_id AS sourceFormulaId,
              dependency.target_formula_id AS targetFormulaId
       FROM formula_revision_dependencies dependency
       JOIN formula_cards card ON card.current_revision_id = dependency.revision_id
       ORDER BY dependency.source_formula_id ASC, dependency.target_formula_id ASC`
    )
    .all();
  const plannedEdges = [
    ...allCurrentEdges,
    ...relations,
    ...formulas.flatMap((formula) => {
      const current = formula.revisions.find((revision) => revision.current);
      return (current?.dependencyFormulaIds || []).map((targetFormulaId) => ({
        sourceFormulaId: formula.formulaId,
        targetFormulaId
      }));
    })
  ];
  if (wouldContainCycle(plannedEdges)) {
    issues.push("planned formula dependency graph contains a self-loop or multi-hop cycle");
  }

  const legacySlugs = new Set(inventory.nodes.map((node) => node.slug));
  for (const formula of formulas) {
    if (!publicLegacyNode(formula.node)) continue;
    if (formula.status !== "published" || !formula.publishedRevisionId) {
      issues.push(`redirect:${formula.node.slug}: public legacy route target is not published`);
      continue;
    }
    if (legacySlugs.has(formula.slug)) {
      issues.push(`redirect:${formula.node.slug}: self-loop or multi-hop redirect target ${formula.slug}`);
      continue;
    }
    redirects.push({
      legacySlug: formula.node.slug,
      sourceNodeId: formula.node.id,
      formulaId: formula.formulaId,
      targetSlug: formula.slug,
      sourcePublishStatus: formula.node.publish_status,
      sourceVisibilityStatus: formula.node.visibility_status,
      sourceDeletedAt: formula.node.deleted_at,
      verificationStatus: "verified"
    });
  }

  const mappedSourceKeys = new Set(mappings.map((mapping) => `${mapping.sourceTable}:${mapping.sourceKey}`));
  for (const row of inventory.revisions) {
    if (!mappedSourceKeys.has(`knowledge_node_revisions:${row.id}`)) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_node_revisions",
          sourceKey: row.id,
          sourceRow: row,
          disposition: "unresolved",
          reason: "revision was not assigned an immutable target"
        })
      );
    }
  }
  for (const row of inventory.links) {
    if (!mappedSourceKeys.has(`knowledge_links:${row.id}`)) {
      mappings.push(
        mappingRecord({
          sourceTable: "knowledge_links",
          sourceKey: row.id,
          sourceRow: row,
          disposition: "unresolved",
          reason: "legacy link was not assigned a target disposition"
        })
      );
    }
  }

  mappings.sort((left, right) =>
    `${left.sourceTable}:${left.sourceKey}`.localeCompare(`${right.sourceTable}:${right.sourceKey}`)
  );
  formulas.sort((left, right) => left.formulaId.localeCompare(right.formulaId));
  relations.sort((left, right) => left.linkId - right.linkId);
  redirects.sort((left, right) => left.legacySlug.localeCompare(right.legacySlug));
  articleTransforms.sort((left, right) => left.postId.localeCompare(right.postId));
  const unresolvedCount =
    mappings.filter((mapping) => mapping.disposition === "unresolved").length + issues.length;
  const planBody = {
    schemaVersion: "larkix.legacy-formula-migration-plan.v1",
    sourceInventory: inventory,
    mappings,
    formulas,
    relations,
    articleTransforms,
    redirects,
    issues: [...issues].sort(),
    unresolvedCount,
    baselineTargetCounts: {
      formulaCards: tableCount(db, "formula_cards"),
      formulaRevisions: tableCount(db, "formula_revisions"),
      articleFormulaBindings: tableCount(db, "article_formula_bindings"),
      formulaRevisionDependencies: tableCount(db, "formula_revision_dependencies"),
      contentRevisions: tableCount(db, "content_revisions")
    }
  };
  return { ...planBody, planDigest: sha256(stableStringify(planBody)) };
}

function insertClassification(db, kind, slug, displayName, parentSlug = "") {
  const normalizedName = String(displayName).normalize("NFKC").trim().toLowerCase();
  const digest = sha256(stableStringify([kind, parentSlug, normalizedName]))
    .slice("sha256:".length, "sha256:".length + 24);
  db.prepare(
    `INSERT OR IGNORE INTO formula_classifications
      (classification_id, kind, slug, display_name, parent_slug, normalized_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(`cls.${kind}.${digest}`, kind, slug, displayName, parentSlug, normalizedName);
}

function insertFormulaTargets(db, plan) {
  const insertCard = db.prepare(
    `INSERT OR IGNORE INTO formula_cards
      (formula_id, slug, display_name, module_key, category_path, purpose,
       current_revision_id, archived_at, created_at, updated_at, publish_status,
       published_revision_id, published_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, NULL, ?)`
  );
  const insertRevision = db.prepare(
    `INSERT OR IGNORE INTO formula_revisions
      (revision_id, formula_id, sequence_no, latex, markdown_derivation,
       display_name, module_key, category_path, purpose, tags_json, revision_reason,
       source_book_id, source_book_revision, source_formula_id, actor_user_id, actor_username)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy_migration', 'legacy-knowledge-nodes',
             's21', ?, NULL, 'A28_LegacyFormulaMigrationSafety')`
  );
  const insertTag = db.prepare(
    `INSERT OR IGNORE INTO formula_card_tags (formula_id, tag_key, namespace, value)
     VALUES (?, ?, 'legacy', ?)`
  );
  for (const formula of plan.formulas) {
    if (!formula.managed) continue;
    const archivedAt = formula.status === "archived" ? new Date().toISOString() : null;
    const publishedAt = formula.status === "published" ? new Date().toISOString() : null;
    insertCard.run(
      formula.formulaId,
      formula.slug,
      formula.metadata.displayName,
      formula.metadata.moduleKey,
      formula.metadata.categoryPath,
      formula.metadata.purpose,
      archivedAt,
      formula.status,
      publishedAt
    );
    insertClassification(db, "module", formula.metadata.moduleKey, formula.metadata.moduleKey);
    const categorySlug = `legacy-${formula.node.node_type}`;
    insertClassification(
      db,
      "category",
      categorySlug,
      formula.metadata.categoryPath,
      formula.metadata.moduleKey
    );
    for (const tag of formula.metadata.tags) {
      insertClassification(db, "tag", tag.replace(":", "-"), tag);
      insertTag.run(formula.formulaId, tag, tag.slice("legacy:".length));
    }
  }
  for (const formula of plan.formulas) {
    if (!formula.managed && !formula.allowAppendRevisions) continue;
    for (const revision of formula.revisions) {
      if (!revision.create) continue;
      insertRevision.run(
        revision.revisionId,
        formula.formulaId,
        revision.sequenceNo,
        revision.content.latex,
        revision.content.markdownDerivation,
        revision.content.displayName,
        revision.content.moduleKey,
        revision.content.categoryPath,
        revision.content.purpose,
        JSON.stringify(revision.content.tags),
        revision.sourceNode.id || formula.node.id
      );
    }
  }
  const insertDependency = db.prepare(
    `INSERT INTO formula_revision_dependencies
      (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
     VALUES (?, ?, ?, ?, 'markdown')`
  );
  const dependencyExists = db.prepare(
    `SELECT 1 AS found
     FROM formula_revision_dependencies
     WHERE revision_id = ? AND target_formula_id = ?`
  );
  for (const formula of plan.formulas) {
    for (const revision of formula.revisions) {
      revision.dependencyFormulaIds.forEach((targetFormulaId, ordinal) => {
        if (dependencyExists.get(revision.revisionId, targetFormulaId)) return;
        insertDependency.run(revision.revisionId, formula.formulaId, targetFormulaId, ordinal);
      });
    }
  }
  const publishRevision = db.prepare(
    `INSERT OR IGNORE INTO formula_revision_publications
      (revision_id, formula_id, actor_username, published_at)
     VALUES (?, ?, 'A28_LegacyFormulaMigrationSafety', CURRENT_TIMESTAMP)`
  );
  const setPointers = db.prepare(
    `UPDATE formula_cards
     SET current_revision_id = ?, published_revision_id = ?, publish_status = ?,
         archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END,
         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE published_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE formula_id = ?`
  );
  const formulaById = new Map(plan.formulas.map((formula) => [formula.formulaId, formula]));
  const ordered = [];
  const visited = new Set();
  function visitFormula(formula) {
    if (!formula || visited.has(formula.formulaId)) return;
    visited.add(formula.formulaId);
    const current = formula.revisions.find((revision) => revision.current);
    for (const targetFormulaId of current?.dependencyFormulaIds || []) {
      visitFormula(formulaById.get(targetFormulaId));
    }
    ordered.push(formula);
  }
  plan.formulas.forEach(visitFormula);
  for (const formula of ordered) {
    if (!formula.managed) continue;
    if (formula.publishedRevisionId) publishRevision.run(formula.publishedRevisionId, formula.formulaId);
    setPointers.run(
      formula.currentRevisionId,
      formula.publishedRevisionId || null,
      formula.status,
      formula.status,
      formula.status,
      formula.formulaId
    );
  }
}

function insertArticleTransforms(db, plan) {
  const insertRevision = db.prepare(
    `INSERT INTO content_revisions
      (content_type, content_id, content_title, revision_reason, snapshot_json,
       source_updated_at, actor_user_id, actor_username)
     VALUES ('post', ?, ?, 'legacy_formula_migration', ?, ?, NULL, 'A28_LegacyFormulaMigrationSafety')`
  );
  const updatePost = db.prepare(
    "UPDATE posts SET markdown = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND markdown = ?"
  );
  const insertBinding = db.prepare(
    `INSERT OR IGNORE INTO article_formula_bindings
      (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateOrdinal = db.prepare(
    `UPDATE article_formula_bindings
     SET ordinal = ?, display_mode = ?, updated_at = CURRENT_TIMESTAMP
     WHERE binding_id = ?`
  );
  for (const transform of plan.articleTransforms) {
    const current = postRow(db, transform.postId);
    if (!current) throw new Error(`post disappeared before apply: ${transform.postId}`);
    if (current.markdown === transform.originalMarkdown) {
      insertRevision.run(
        transform.postId,
        current.title || "",
        JSON.stringify(transform.originalSnapshot),
        current.updated_at || ""
      );
      const changed = updatePost.run(
        transform.migratedMarkdown,
        transform.postId,
        transform.originalMarkdown
      );
      if (Number(changed.changes || 0) !== 1) {
        throw new Error(`post Markdown changed during migration: ${transform.postId}`);
      }
    } else if (current.markdown !== transform.migratedMarkdown) {
      throw new Error(`post Markdown does not match source or idempotent target: ${transform.postId}`);
    }
    for (const binding of transform.bindings) {
      insertBinding.run(
        binding.bindingId,
        binding.postId,
        binding.formulaId,
        binding.revisionId,
        binding.displayMode,
        binding.ordinal
      );
      updateOrdinal.run(binding.ordinal, binding.displayMode, binding.bindingId);
    }
  }
}

function insertSupportEvidence(db, plan, manifest) {
  db.prepare(
    `INSERT OR IGNORE INTO legacy_formula_backup_manifests
      (manifest_digest, source_database_sha256, backup_database_sha256, manifest_json)
     VALUES (?, ?, ?, ?)`
  ).run(
    manifest.manifestDigest,
    manifest.source.databaseMainSha256AfterCheckpoint,
    manifest.files.find((file) => file.role === "sqlite-consistent-snapshot").sha256,
    stableStringify(manifest)
  );
  const insertMapping = db.prepare(
    `INSERT OR IGNORE INTO legacy_formula_mappings
      (source_table, source_key, source_digest, disposition, target_kind,
       target_ids_json, merge_key, reason, source_status_json, report_digest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const mapping of plan.mappings) {
    insertMapping.run(
      mapping.sourceTable,
      mapping.sourceKey,
      mapping.sourceDigest,
      mapping.disposition,
      mapping.targetKind,
      stableStringify(mapping.targetIds),
      mapping.mergeKey,
      mapping.reason,
      stableStringify(mapping.sourceStatus),
      plan.planDigest
    );
  }
  const insertRedirect = db.prepare(
    `INSERT OR IGNORE INTO legacy_formula_redirects
      (legacy_slug, source_node_id, formula_id, target_slug, source_publish_status,
       source_visibility_status, source_deleted_at, verification_status, report_digest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const redirect of plan.redirects) {
    insertRedirect.run(
      redirect.legacySlug,
      redirect.sourceNodeId,
      redirect.formulaId,
      redirect.targetSlug,
      redirect.sourcePublishStatus,
      redirect.sourceVisibilityStatus,
      redirect.sourceDeletedAt,
      redirect.verificationStatus,
      plan.planDigest
    );
  }
}

function sourceRowByMapping(db, mapping) {
  if (mapping.sourceTable === "knowledge_nodes") {
    return db
      .prepare(
        `SELECT id, slug, node_type, symbol, title, summary, markdown, cover,
                accent_color, tags, publish_status, visibility_status, deleted_at,
                created_at, updated_at, published_at
         FROM knowledge_nodes WHERE id = ?`
      )
      .get(mapping.sourceKey);
  }
  if (mapping.sourceTable === "knowledge_node_revisions") {
    return db
      .prepare(
        `SELECT id, node_id, node_slug, node_title, revision_reason, snapshot_json,
                source_updated_at, actor_user_id, actor_username, created_at
         FROM knowledge_node_revisions WHERE id = ?`
      )
      .get(Number(mapping.sourceKey));
  }
  return db
    .prepare(
      `SELECT id, source_type, source_id, source_slug, target_slug, label,
              color_token, link_kind, ordinal, created_at, updated_at
       FROM knowledge_links WHERE id = ?`
    )
    .get(Number(mapping.sourceKey));
}

function checkResult() {
  return { passed: true, mismatches: [], evidence: [] };
}

function mismatch(check, message) {
  check.passed = false;
  check.mismatches.push(message);
}

function verifyAppliedMigration(db, plan, restoreVerification, manifest) {
  const checks = {
    schema: checkResult(),
    quantities: checkResult(),
    content: checkResult(),
    references: checkResult(),
    relations: checkResult(),
    status: checkResult(),
    redirects: checkResult()
  };
  const sqliteChecks = databaseChecks(db);
  checks.schema.evidence.push(sqliteChecks);
  if (!sqliteChecks.passed) mismatch(checks.schema, "SQLite integrity or foreign-key check failed");
  const currentInventory = sourceInventory(db);
  if (
    stableStringify(currentInventory.selectedCounts) !==
    stableStringify(plan.sourceInventory.selectedCounts)
  ) {
    mismatch(
      checks.quantities,
      `selected legacy source count drift: ${stableStringify(currentInventory.selectedCounts)}`
    );
  }
  if (currentInventory.exactDigest !== plan.sourceInventory.exactDigest) {
    mismatch(checks.content, "selected legacy source exact digest drift");
  }
  const sourceCounts = {
    knowledge_nodes: plan.mappings.filter((item) => item.sourceTable === "knowledge_nodes").length,
    knowledge_node_revisions: plan.mappings.filter(
      (item) => item.sourceTable === "knowledge_node_revisions"
    ).length,
    knowledge_links: plan.mappings.filter((item) => item.sourceTable === "knowledge_links").length
  };
  for (const [table, expected] of Object.entries(sourceCounts)) {
    const actual = plan.mappings
      .filter((mapping) => mapping.sourceTable === table)
      .filter((mapping) => sourceRowByMapping(db, mapping)).length;
    checks.quantities.evidence.push({ table, expected, actual });
    if (actual !== expected) mismatch(checks.quantities, `${table} source count drift: ${actual}/${expected}`);
  }
  for (const mapping of plan.mappings) {
    const source = sourceRowByMapping(db, mapping);
    if (!source) {
      mismatch(checks.content, `${mapping.sourceTable}:${mapping.sourceKey} source row missing`);
      continue;
    }
    if (rowDigest(source) !== mapping.sourceDigest) {
      mismatch(checks.content, `${mapping.sourceTable}:${mapping.sourceKey} exact source content mismatch`);
    }
    const persisted = db
      .prepare(
        `SELECT source_digest AS sourceDigest, disposition, target_kind AS targetKind,
                target_ids_json AS targetIdsJson
         FROM legacy_formula_mappings
         WHERE source_table = ? AND source_key = ?`
      )
      .get(mapping.sourceTable, mapping.sourceKey);
    if (
      !persisted ||
      persisted.sourceDigest !== mapping.sourceDigest ||
      persisted.disposition !== mapping.disposition ||
      persisted.targetKind !== mapping.targetKind ||
      persisted.targetIdsJson !== stableStringify(mapping.targetIds)
    ) {
      mismatch(checks.quantities, `${mapping.sourceTable}:${mapping.sourceKey} mapping evidence mismatch`);
    }
  }
  for (const formula of plan.formulas) {
    const card = formulaTargetRow(db, formula.formulaId);
    if (!card) {
      mismatch(checks.content, `formula card missing: ${formula.formulaId}`);
      continue;
    }
    for (const revision of formula.revisions) {
      const row = db
        .prepare(
          `SELECT formula_id AS formulaId, sequence_no AS sequenceNo, latex,
                  markdown_derivation AS markdownDerivation, display_name AS displayName,
                  module_key AS moduleKey, category_path AS categoryPath, purpose,
                  tags_json AS tagsJson
           FROM formula_revisions WHERE revision_id = ?`
        )
        .get(revision.revisionId);
      if (!row) {
        mismatch(checks.content, `formula revision missing: ${revision.revisionId}`);
        continue;
      }
      const storedDependencyFormulaIds = db
        .prepare(
          `SELECT target_formula_id AS targetFormulaId
           FROM formula_revision_dependencies
           WHERE revision_id = ?
           ORDER BY ordinal ASC, target_formula_id ASC`
        )
        .all(revision.revisionId)
        .map((dependency) => dependency.targetFormulaId);
      const exact = {
        formulaId: row.formulaId,
        latex: row.latex,
        markdownDerivation: row.markdownDerivation,
        displayName: row.displayName,
        moduleKey: row.moduleKey,
        categoryPath: row.categoryPath,
        purpose: row.purpose,
        tags: JSON.parse(row.tagsJson || "[]"),
        dependencyFormulaIds: storedDependencyFormulaIds
      };
      if (sha256(stableStringify(exact)) !== revision.exactContentDigest) {
        mismatch(checks.content, `formula revision exact content mismatch: ${revision.revisionId}`);
      }
      if (extractLegacyDeriveReferences(row.markdownDerivation).length > 0) {
        mismatch(checks.references, `legacy derive shortcode remains: ${revision.revisionId}`);
      }
      const parsedDependencies = extractFormulaDependencyReferences(row.markdownDerivation);
      if (
        stableStringify(parsedDependencies) !==
          stableStringify(revision.dependencyFormulaIds) ||
        stableStringify(storedDependencyFormulaIds) !==
          stableStringify(revision.dependencyFormulaIds)
      ) {
        mismatch(
          checks.relations,
          `formula Markdown and dependency rows differ: ${revision.revisionId}`
        );
      }
      checks.content.evidence.push({
        revisionId: revision.revisionId,
        exactContentDigest: revision.exactContentDigest,
        normalizedContentDigest: revision.normalizedContentDigest,
        originalMarkdownDigest: revision.originalMarkdownDigest,
        migratedMarkdownDigest: revision.migratedMarkdownDigest,
        latexDecision: revision.latexDecision
      });
    }
    if (
      card.currentRevisionId !== formula.currentRevisionId ||
      (card.publishedRevisionId || "") !== (formula.publishedRevisionId || "") ||
      card.publishStatus !== formula.status
    ) {
      mismatch(checks.status, `formula status or revision pointer mismatch: ${formula.formulaId}`);
    }
    if (
      formula.status === "published" &&
      !db
        .prepare("SELECT 1 AS found FROM formula_revision_publications WHERE revision_id = ?")
        .get(formula.publishedRevisionId)
    ) {
      mismatch(checks.status, `published revision audit missing: ${formula.publishedRevisionId}`);
    }
  }
  for (const transform of plan.articleTransforms) {
    const post = postRow(db, transform.postId);
    if (!post || post.markdown !== transform.migratedMarkdown) {
      mismatch(checks.references, `post Markdown migration mismatch: ${transform.postId}`);
      continue;
    }
    const revision = db
      .prepare(
        `SELECT snapshot_json AS snapshotJson
         FROM content_revisions
         WHERE content_type = 'post' AND content_id = ?
           AND revision_reason = 'legacy_formula_migration'
         ORDER BY id ASC LIMIT 1`
      )
      .get(transform.postId);
    if (!revision || JSON.parse(revision.snapshotJson).markdown !== transform.originalMarkdown) {
      mismatch(checks.references, `post pre-migration content revision missing: ${transform.postId}`);
    }
    for (const binding of transform.bindings) {
      const row = db
        .prepare(
          `SELECT post_id AS postId, formula_id AS formulaId, revision_id AS revisionId,
                  display_mode AS displayMode, ordinal
           FROM article_formula_bindings WHERE binding_id = ?`
        )
        .get(binding.bindingId);
      const shortcode = `{{formula:${binding.bindingId}|${binding.formulaId}|${binding.revisionId}|${binding.displayMode}}}`;
      if (
        !row ||
        row.postId !== binding.postId ||
        row.formulaId !== binding.formulaId ||
        row.revisionId !== binding.revisionId ||
        row.displayMode !== binding.displayMode ||
        Number(row.ordinal) !== Number(binding.ordinal) ||
        !post.markdown.includes(shortcode)
      ) {
        mismatch(checks.references, `article binding or shortcode mismatch: ${binding.bindingId}`);
      }
    }
  }
  const expectedRelations = new Map();
  for (const formula of plan.formulas) {
    for (const revision of formula.revisions) {
      revision.dependencyFormulaIds.forEach((targetFormulaId, ordinal) => {
        expectedRelations.set(`${revision.revisionId}:${targetFormulaId}`, {
          revisionId: revision.revisionId,
          sourceFormulaId: formula.formulaId,
          targetFormulaId,
          ordinal
        });
      });
    }
  }
  for (const expected of expectedRelations.values()) {
    const row = db
      .prepare(
        `SELECT source_formula_id AS sourceFormulaId, ordinal, provenance
         FROM formula_revision_dependencies
         WHERE revision_id = ? AND target_formula_id = ?`
      )
      .get(expected.revisionId, expected.targetFormulaId);
    if (
      !row ||
      row.sourceFormulaId !== expected.sourceFormulaId ||
      Number(row.ordinal) !== expected.ordinal ||
      row.provenance !== "markdown"
    ) {
      mismatch(
        checks.relations,
        `formula dependency mismatch: ${expected.revisionId}/${expected.targetFormulaId}`
      );
    }
  }
  if (wouldContainCycle(db
    .prepare(
      `SELECT source_formula_id AS sourceFormulaId, target_formula_id AS targetFormulaId
       FROM formula_revision_dependencies`
    )
    .all())) {
    mismatch(checks.relations, "stored formula dependency graph contains a cycle");
  }
  const redirectRows = db
    .prepare(
      `SELECT legacy_slug AS legacySlug, formula_id AS formulaId, target_slug AS targetSlug,
              source_node_id AS sourceNodeId,
              source_publish_status AS sourcePublishStatus,
              source_visibility_status AS sourceVisibilityStatus,
              source_deleted_at AS sourceDeletedAt, verification_status AS verificationStatus
       FROM legacy_formula_redirects
       ORDER BY legacy_slug ASC`
    )
    .all();
  const redirectByLegacy = new Map(redirectRows.map((row) => [row.legacySlug, row]));
  for (const expected of plan.redirects) {
    const row = redirectByLegacy.get(expected.legacySlug);
    const card = row ? formulaTargetRow(db, row.formulaId) : null;
    if (
      !row ||
      row.formulaId !== expected.formulaId ||
      row.sourceNodeId !== expected.sourceNodeId ||
      row.targetSlug !== expected.targetSlug ||
      row.verificationStatus !== "verified" ||
      !card ||
      card.slug !== row.targetSlug ||
      card.publishStatus !== "published" ||
      !card.publishedRevisionId ||
      redirectByLegacy.has(row.targetSlug)
    ) {
      mismatch(checks.redirects, `unsafe or missing permanent redirect: ${expected.legacySlug}`);
    }
  }
  checks.redirects.evidence.push(
    ...plan.redirects.map((redirect) => ({
      legacy: `/derive.html?slug=${redirect.legacySlug}`,
      status: 308,
      destination: `/derive.html?formula=${redirect.targetSlug}`
    }))
  );
  if (!restoreVerification?.passed) mismatch(checks.schema, "independent restore verification did not pass");
  const manifestCheck = verifyBackupManifest(manifest);
  if (!manifestCheck.passed) {
    mismatch(checks.schema, `backup manifest verification failed: ${manifestCheck.mismatches.join("; ")}`);
  }
  const passed = Object.values(checks).every((check) => check.passed);
  return {
    passed,
    checks,
    unresolvedCount: plan.unresolvedCount,
    cleanupEligible: passed && plan.unresolvedCount === 0 && restoreVerification?.passed === true,
    verificationDigest: sha256(stableStringify(checks))
  };
}

function persistMigrationReport(db, report) {
  return db.prepare(
    `INSERT OR IGNORE INTO legacy_formula_migration_reports
      (report_digest, plan_digest, manifest_digest, mode, unresolved_count,
       cleanup_eligible, report_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    report.reportDigest,
    report.plan.planDigest,
    report.manifest.manifestDigest,
    report.mode,
    report.verification.unresolvedCount,
    report.verification.cleanupEligible ? 1 : 0,
    stableStringify(report)
  );
}

function applyMigrationPlan({ db, dbPath, fixtureDir, plan, manifest, restoreVerification }) {
  assertDisposableFixture(fixtureDir, dbPath);
  if (!verifyBackupManifest(manifest).passed) throw new Error("backup manifest gate failed before apply");
  if (!restoreVerification?.passed) throw new Error("independent restore gate failed before apply");
  if (plan.unresolvedCount !== 0) {
    throw new Error(`migration apply blocked by ${plan.unresolvedCount} unresolved/ambiguous issue(s)`);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    insertFormulaTargets(db, plan);
    insertArticleTransforms(db, plan);
    insertSupportEvidence(db, plan, manifest);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original migration failure.
    }
    throw error;
  }
  const verification = verifyAppliedMigration(db, plan, restoreVerification, manifest);
  const reportBody = {
    schemaVersion: "larkix.legacy-formula-migration-report.v1",
    mode: verification.cleanupEligible ? "apply_verified" : "apply_blocked",
    plan,
    manifest,
    restoreVerification,
    verification
  };
  const report = { ...reportBody, reportDigest: sha256(stableStringify(reportBody)) };
  persistMigrationReport(db, report);
  return report;
}

function dryRunMigration({ db, dbPath, fixtureDir, mappingRules = {}, backupDir, restoreDir }) {
  assertDisposableFixture(fixtureDir, dbPath);
  const manifest = createConsistentBackup({ db, dbPath, fixtureDir, backupDir });
  const restoreVerification = restoreBackupToSecondDirectory({ manifest, fixtureDir, restoreDir });
  const plan = buildMigrationPlan(db, { mappingRules });
  const reportBody = {
    schemaVersion: "larkix.legacy-formula-migration-dry-run.v1",
    mode: "dry_run",
    plan,
    manifest,
    restoreVerification,
    cleanupEligible: false
  };
  return { ...reportBody, reportDigest: sha256(stableStringify(reportBody)) };
}

function applyDisposableMigration({ db, dbPath, fixtureDir, mappingRules = {}, backupDir, restoreDir }) {
  const dryRun = dryRunMigration({
    db,
    dbPath,
    fixtureDir,
    mappingRules,
    backupDir,
    restoreDir
  });
  return applyMigrationPlan({
    db,
    dbPath,
    fixtureDir,
    plan: dryRun.plan,
    manifest: dryRun.manifest,
    restoreVerification: dryRun.restoreVerification
  });
}

function cleanupPreservedState(db) {
  const tables = [
    "formula_cards",
    "formula_revisions",
    "formula_revision_dependencies",
    "formula_revision_publications",
    "formula_classifications",
    "formula_card_tags",
    "article_formula_bindings",
    "content_revisions",
    "legacy_formula_backup_manifests",
    "legacy_formula_mappings",
    "legacy_formula_redirects",
    "legacy_formula_migration_reports"
  ];
  return Object.fromEntries(
    tables.map((table) => [
      table,
      db
        .prepare(`SELECT * FROM ${table}`)
        .all()
        .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
    ])
  );
}

function cleanupDisposableLegacyRows({
  db,
  dbPath,
  fixtureDir,
  reportDigest,
  faultInjection = {}
}) {
  assertDisposableFixture(fixtureDir, dbPath);
  const persisted = db
    .prepare(
      `SELECT report_json AS reportJson, cleanup_eligible AS cleanupEligible, mode
       FROM legacy_formula_migration_reports WHERE report_digest = ?`
    )
    .get(reportDigest);
  if (!persisted || persisted.mode !== "apply_verified" || Number(persisted.cleanupEligible) !== 1) {
    throw new Error("cleanup requires the exact persisted cleanup-eligible report digest");
  }
  const report = JSON.parse(persisted.reportJson);
  if (report.reportDigest !== reportDigest) throw new Error("persisted report digest does not match request");
  const reportBody = { ...report };
  delete reportBody.reportDigest;
  if (sha256(stableStringify(reportBody)) !== reportDigest) {
    throw new Error("persisted report content digest mismatch");
  }
  const backupCheck = verifyBackupManifest(report.manifest);
  if (!backupCheck.passed) {
    throw new Error(`cleanup backup checksum gate failed: ${backupCheck.mismatches.join("; ")}`);
  }
  if (!report.restoreVerification?.passed) throw new Error("cleanup restore verification gate failed");
  const freshVerification = verifyAppliedMigration(
    db,
    report.plan,
    report.restoreVerification,
    report.manifest
  );
  if (!freshVerification.cleanupEligible) {
    const mismatches = Object.values(freshVerification.checks).flatMap((check) => check.mismatches);
    throw new Error(`cleanup verification gate failed: ${mismatches.join("; ")}`);
  }

  const before = {
    knowledge_nodes: tableCount(db, "knowledge_nodes"),
    knowledge_node_revisions: tableCount(db, "knowledge_node_revisions"),
    knowledge_links: tableCount(db, "knowledge_links"),
    formula_cards: tableCount(db, "formula_cards"),
    formula_revisions: tableCount(db, "formula_revisions"),
    article_formula_bindings: tableCount(db, "article_formula_bindings"),
    mappings: tableCount(db, "legacy_formula_mappings"),
    reports: tableCount(db, "legacy_formula_migration_reports"),
    redirects: tableCount(db, "legacy_formula_redirects")
  };
  const sourceKeys = {
    knowledge_links: report.plan.mappings
      .filter((mapping) => mapping.sourceTable === "knowledge_links")
      .map((mapping) => Number(mapping.sourceKey)),
    knowledge_node_revisions: report.plan.mappings
      .filter((mapping) => mapping.sourceTable === "knowledge_node_revisions")
      .map((mapping) => Number(mapping.sourceKey)),
    knowledge_nodes: report.plan.mappings
      .filter((mapping) => mapping.sourceTable === "knowledge_nodes")
      .map((mapping) => mapping.sourceKey)
  };
  const preservedStateBefore = cleanupPreservedState(db);
  let cleanupReport;
  db.exec("BEGIN IMMEDIATE");
  try {
    const deleteLink = db.prepare("DELETE FROM knowledge_links WHERE id = ?");
    const deleteRevision = db.prepare("DELETE FROM knowledge_node_revisions WHERE id = ?");
    const deleteNode = db.prepare("DELETE FROM knowledge_nodes WHERE id = ?");
    sourceKeys.knowledge_links.forEach((id) => deleteLink.run(id));
    sourceKeys.knowledge_node_revisions.forEach((id) => deleteRevision.run(id));
    sourceKeys.knowledge_nodes.forEach((id) => deleteNode.run(id));
    if (faultInjection.afterDeleteValidationFailure === true) {
      throw new Error("injected post-delete validation failure");
    }
    const after = {
      knowledge_nodes: tableCount(db, "knowledge_nodes"),
      knowledge_node_revisions: tableCount(db, "knowledge_node_revisions"),
      knowledge_links: tableCount(db, "knowledge_links"),
      formula_cards: tableCount(db, "formula_cards"),
      formula_revisions: tableCount(db, "formula_revisions"),
      article_formula_bindings: tableCount(db, "article_formula_bindings"),
      mappings: tableCount(db, "legacy_formula_mappings"),
      reports: tableCount(db, "legacy_formula_migration_reports"),
      redirects: tableCount(db, "legacy_formula_redirects")
    };
    const preservedTargets = [
      "formula_cards",
      "formula_revisions",
      "article_formula_bindings",
      "mappings",
      "reports",
      "redirects"
    ];
    for (const key of preservedTargets) {
      if (after[key] !== before[key]) {
        throw new Error(`cleanup changed preserved target count: ${key}`);
      }
    }
    const expectedAfter = {
      knowledge_nodes: before.knowledge_nodes - sourceKeys.knowledge_nodes.length,
      knowledge_node_revisions:
        before.knowledge_node_revisions - sourceKeys.knowledge_node_revisions.length,
      knowledge_links: before.knowledge_links - sourceKeys.knowledge_links.length
    };
    for (const [key, expected] of Object.entries(expectedAfter)) {
      if (after[key] !== expected) {
        throw new Error(`cleanup count mismatch for ${key}: ${after[key]}/${expected}`);
      }
    }
    const afterDeleteSqliteChecks = databaseChecks(db);
    if (!afterDeleteSqliteChecks.passed) {
      throw new Error("cleanup post-delete SQLite integrity or foreign-key check failed");
    }
    const preservedStateAfterDelete = cleanupPreservedState(db);
    if (stableStringify(preservedStateAfterDelete) !== stableStringify(preservedStateBefore)) {
      throw new Error("cleanup changed preserved target content after legacy deletion");
    }
    const cleanupBody = {
      schemaVersion: "larkix.legacy-formula-cleanup-report.v1",
      mode: "cleanup_completed",
      sourceReportDigest: reportDigest,
      plan: report.plan,
      manifest: report.manifest,
      restoreVerification: report.restoreVerification,
      verification: {
        ...freshVerification,
        cleanupEligible: false,
        cleanupCompleted: true,
        before,
        after,
        afterDeleteSqliteChecks,
        deletedSourceKeys: sourceKeys
      }
    };
    cleanupReport = {
      ...cleanupBody,
      reportDigest: sha256(stableStringify(cleanupBody))
    };
    if (faultInjection.reportPersistenceFailure === true) {
      throw new Error("injected cleanup report persistence failure");
    }
    persistMigrationReport(db, cleanupReport);
    const persistedCleanupReport = db
      .prepare(
        `SELECT report_digest AS reportDigest
         FROM legacy_formula_migration_reports
         WHERE report_digest = ? AND mode = 'cleanup_completed'`
      )
      .get(cleanupReport.reportDigest);
    if (!persistedCleanupReport) {
      throw new Error("cleanup report persistence verification failed");
    }
    const preservedStateAfterReport = cleanupPreservedState(db);
    for (const [table, rows] of Object.entries(preservedStateBefore)) {
      if (table === "legacy_formula_migration_reports") continue;
      if (stableStringify(preservedStateAfterReport[table]) !== stableStringify(rows)) {
        throw new Error(`cleanup report persistence changed preserved target content: ${table}`);
      }
    }
    const priorReportDigests = new Set(
      preservedStateBefore.legacy_formula_migration_reports.map((row) => row.report_digest)
    );
    const afterReportDigests = new Set(
      preservedStateAfterReport.legacy_formula_migration_reports.map((row) => row.report_digest)
    );
    if (
      [...priorReportDigests].some((digest) => !afterReportDigests.has(digest)) ||
      !afterReportDigests.has(cleanupReport.reportDigest) ||
      afterReportDigests.size !== priorReportDigests.size + 1
    ) {
      throw new Error("cleanup report persistence did not preserve prior reports exactly");
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original cleanup failure.
    }
    throw error;
  }
  return cleanupReport;
}

module.exports = {
  DISPOSABLE_MARKER,
  DISPOSABLE_PREFIX,
  applyDisposableMigration,
  applyMigrationPlan,
  assertDisposableFixture,
  buildMigrationPlan,
  cleanupDisposableLegacyRows,
  createConsistentBackup,
  createDisposableFixture,
  dryRunMigration,
  restoreBackupToSecondDirectory,
  sha256,
  sourceInventory,
  stableStringify,
  verifyAppliedMigration,
  verifyBackupManifest
};
