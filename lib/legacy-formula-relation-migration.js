"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  assertDisposableFixture,
  sha256,
  stableStringify
} = require("./legacy-formula-migration");
const {
  analyzeFormulaDependencyGraph,
  extractFormulaDependencyReferences,
  extractLegacyDeriveReferences
} = require("./validators");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function tableCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count || 0);
}

function relationInventory(db) {
  const cards = db
    .prepare(
      `SELECT formula_id AS formulaId, slug, current_revision_id AS currentRevisionId,
              published_revision_id AS publishedRevisionId, publish_status AS publishStatus,
              archived_at AS archivedAt
       FROM formula_cards ORDER BY formula_id ASC`
    )
    .all();
  const revisions = db
    .prepare(
      `SELECT revision_id AS revisionId, formula_id AS formulaId,
              sequence_no AS sequenceNo, markdown_derivation AS markdownDerivation,
              source_formula_id AS sourceFormulaId
       FROM formula_revisions ORDER BY formula_id ASC, sequence_no ASC, revision_id ASC`
    )
    .all();
  const dependencies = db
    .prepare(
      `SELECT revision_id AS revisionId, source_formula_id AS sourceFormulaId,
              target_formula_id AS targetFormulaId, ordinal, provenance, created_at AS createdAt
       FROM formula_revision_dependencies
       ORDER BY revision_id ASC, ordinal ASC, target_formula_id ASC`
    )
    .all();
  const legacyLinks = db
    .prepare(
      `SELECT id, source_type AS sourceType, source_id AS sourceId,
              source_slug AS sourceSlug, target_slug AS targetSlug,
              link_kind AS linkKind, ordinal
       FROM knowledge_links ORDER BY id ASC`
    )
    .all();
  const legacyNodes = db
    .prepare(
      `SELECT id, slug, node_type AS nodeType, publish_status AS publishStatus,
              visibility_status AS visibilityStatus, deleted_at AS deletedAt
       FROM knowledge_nodes ORDER BY id ASC`
    )
    .all();
  const mappings = db
    .prepare(
      `SELECT source_table AS sourceTable, source_key AS sourceKey,
              source_digest AS sourceDigest, disposition, target_kind AS targetKind,
              target_ids_json AS targetIdsJson, report_digest AS reportDigest
       FROM legacy_formula_mappings ORDER BY source_table ASC, source_key ASC`
    )
    .all();
  const articleBindings = db
    .prepare(
      `SELECT binding_id AS bindingId, post_id AS postId, formula_id AS formulaId,
              revision_id AS revisionId, display_mode AS displayMode, ordinal
       FROM article_formula_bindings ORDER BY binding_id ASC`
    )
    .all();
  const exact = { cards, revisions, dependencies, legacyLinks, legacyNodes, mappings, articleBindings };
  const preserved = { cards, revisions, legacyLinks, legacyNodes, mappings, articleBindings };
  return {
    ...exact,
    counts: {
      formulaCards: cards.length,
      formulaRevisions: revisions.length,
      formulaRevisionDependencies: dependencies.length,
      knowledgeNodes: legacyNodes.length,
      knowledgeLinks: legacyLinks.length,
      legacyFormulaMappings: mappings.length,
      articleFormulaBindings: articleBindings.length,
      repairQueue: tableCount(db, "formula_relation_repair_queue"),
      repairEvents: tableCount(db, "formula_relation_repair_events"),
      relationReports: tableCount(db, "formula_relation_migration_reports")
    },
    exactDigest: sha256(stableStringify(exact)),
    preservedDigest: sha256(stableStringify(preserved))
  };
}

function databaseChecks(db) {
  const integrity = db.prepare("PRAGMA integrity_check").all().map((row) => Object.values(row)[0]);
  const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  return {
    integrity,
    foreignKeys,
    passed: integrity.length === 1 && String(integrity[0]).toLowerCase() === "ok" && foreignKeys.length === 0
  };
}

function createRelationBackup({ db, dbPath, fixtureDir }) {
  assertDisposableFixture(fixtureDir, dbPath);
  db.prepare("PRAGMA wal_checkpoint(FULL)").all();
  const backupDir = fs.mkdtempSync(path.join(path.resolve(fixtureDir), "relation-backup-"));
  const backupPath = path.join(backupDir, "formula-relations.sqlite");
  const manifestPath = path.join(backupDir, "manifest.json");
  const inventory = relationInventory(db);
  db.exec(`VACUUM INTO ${sqlString(backupPath)}`);
  const backupDatabaseSha256 = fileSha256(backupPath);
  const manifestBody = {
    schemaVersion: "larkix.formula-relation-backup.v1",
    method: "PRAGMA wal_checkpoint(FULL) + VACUUM INTO",
    backupPath,
    backupDatabaseSha256,
    backupSizeBytes: fs.statSync(backupPath).size,
    inventoryCounts: inventory.counts,
    inventoryDigest: inventory.exactDigest,
    preservedDigest: inventory.preservedDigest
  };
  const manifest = {
    ...manifestBody,
    manifestDigest: sha256(stableStringify(manifestBody)),
    manifestPath
  };
  fs.writeFileSync(manifestPath, `${stableStringify(manifest, 2)}\n`, "utf8");
  return manifest;
}

function verifyRelationBackup({ manifest, fixtureDir }) {
  assertDisposableFixture(fixtureDir);
  const restoreDir = fs.mkdtempSync(path.join(path.resolve(fixtureDir), "relation-restore-"));
  const restoredPath = path.join(restoreDir, "restored.sqlite");
  fs.copyFileSync(manifest.backupPath, restoredPath);
  const mismatches = [];
  if (fileSha256(restoredPath) !== manifest.backupDatabaseSha256) {
    mismatches.push("restored database checksum mismatch");
  }
  const restoredDb = new DatabaseSync(restoredPath);
  restoredDb.exec("PRAGMA foreign_keys = ON");
  const checks = databaseChecks(restoredDb);
  const inventory = relationInventory(restoredDb);
  restoredDb.close();
  if (!checks.passed) mismatches.push("restored database SQLite checks failed");
  if (inventory.exactDigest !== manifest.inventoryDigest) {
    mismatches.push("restored relation inventory digest mismatch");
  }
  return {
    passed: mismatches.length === 0,
    mismatches,
    restoredPath,
    restoredDatabaseSha256: fileSha256(restoredPath),
    inventoryDigest: inventory.exactDigest,
    checks,
    verificationDigest: sha256(
      stableStringify({ mismatches, checks, inventoryDigest: inventory.exactDigest })
    )
  };
}

function addAlias(index, alias, formulaId) {
  const key = String(alias || "").trim();
  if (!key || !formulaId) return;
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(String(formulaId));
}

function mappedFormulaIds(mapping) {
  if (!mapping || !["mapped", "merged"].includes(mapping.disposition)) return [];
  let targets;
  try {
    targets = JSON.parse(mapping.targetIdsJson || "[]");
  } catch {
    return [];
  }
  return (Array.isArray(targets) ? targets : [])
    .map((target) => (typeof target === "string" ? target : target?.formulaId || ""))
    .filter(Boolean);
}

function buildFormulaAliases(inventory) {
  const aliases = new Map();
  const legacySourceIdsByFormula = new Map();
  const nodeById = new Map(inventory.legacyNodes.map((node) => [node.id, node]));
  for (const card of inventory.cards) {
    addAlias(aliases, card.formulaId, card.formulaId);
    addAlias(aliases, card.slug, card.formulaId);
  }
  for (const revision of inventory.revisions) {
    addAlias(aliases, revision.sourceFormulaId, revision.formulaId);
  }
  for (const mapping of inventory.mappings.filter(
    (item) => item.sourceTable === "knowledge_nodes" && item.targetKind === "formula_card"
  )) {
    const formulaIds = mappedFormulaIds(mapping);
    const node = nodeById.get(mapping.sourceKey);
    for (const formulaId of formulaIds) {
      addAlias(aliases, mapping.sourceKey, formulaId);
      addAlias(aliases, node?.slug, formulaId);
      if (!legacySourceIdsByFormula.has(formulaId)) legacySourceIdsByFormula.set(formulaId, new Set());
      legacySourceIdsByFormula.get(formulaId).add(mapping.sourceKey);
    }
  }
  return { aliases, legacySourceIdsByFormula };
}

function candidateIds(aliases, reference) {
  return [...(aliases.get(String(reference || "").trim()) || [])].sort((left, right) =>
    left.localeCompare(right)
  );
}

function repairRecord(input) {
  const sourceRow = input.sourceRow || {};
  const body = {
    sourceTable: input.sourceTable,
    sourceKey: String(input.sourceKey),
    sourceDigest: sha256(stableStringify(sourceRow)),
    sourceFormulaId: String(input.sourceFormulaId || ""),
    sourceRevisionId: String(input.sourceRevisionId || ""),
    targetReference: String(input.targetReference || ""),
    issueCode: input.issueCode,
    reason: input.reason,
    candidateTargetIds: [...new Set(input.candidateTargetIds || [])].sort(),
    evidence: input.evidence || {}
  };
  return {
    repairId: `repair.${sha256(stableStringify(body)).slice("sha256:".length, "sha256:".length + 40)}`,
    ...body
  };
}

function buildRelationMigrationPlan(db) {
  const inventory = relationInventory(db);
  const formulaIds = new Set(inventory.cards.map((card) => card.formulaId));
  const cardById = new Map(inventory.cards.map((card) => [card.formulaId, card]));
  const revisionById = new Map(inventory.revisions.map((revision) => [revision.revisionId, revision]));
  const { aliases, legacySourceIdsByFormula } = buildFormulaAliases(inventory);
  const repairs = new Map();
  const candidates = new Map();
  const processedLegacyLinkIds = new Set();
  const existingByRevisionTarget = new Map(
    inventory.dependencies.map((dependency) => [
      `${dependency.revisionId}\u0000${dependency.targetFormulaId}`,
      dependency
    ])
  );
  const linksBySourceNode = new Map();
  for (const link of inventory.legacyLinks.filter(
    (item) => item.sourceType === "knowledge_node" && item.linkKind === "derive"
  )) {
    if (!linksBySourceNode.has(link.sourceId)) linksBySourceNode.set(link.sourceId, []);
    linksBySourceNode.get(link.sourceId).push(link);
  }

  const queueRepair = (input) => {
    const repair = repairRecord(input);
    repairs.set(repair.repairId, repair);
  };
  const addCandidate = (input) => {
    const key = `${input.revisionId}\u0000${input.targetFormulaId}`;
    const current = candidates.get(key);
    if (current) {
      current.evidence.push(...input.evidence);
      if (input.provenance === "markdown") current.provenance = "markdown";
      if (input.ordinal < current.ordinal) current.ordinal = input.ordinal;
      return;
    }
    candidates.set(key, { ...input, evidence: [...input.evidence] });
  };

  for (const revision of inventory.revisions) {
    const sourceCard = cardById.get(revision.formulaId);
    const stableTargets = new Map();
    const legacyShortcodeTargets = new Map();
    const legacyRelationTargets = new Map();
    let stableReferences = [];
    try {
      stableReferences = extractFormulaDependencyReferences(revision.markdownDerivation);
    } catch (error) {
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: revision.revisionId,
        sourceRow: revision,
        sourceFormulaId: revision.formulaId,
        sourceRevisionId: revision.revisionId,
        issueCode: /duplicate|重复/i.test(error.message) ? "duplicate_dependency" : "invalid_shortcode",
        reason: error.message,
        evidence: { kind: "stable_shortcode" }
      });
    }
    stableReferences.forEach((targetFormulaId, ordinal) => {
      if (!formulaIds.has(targetFormulaId)) {
        queueRepair({
          sourceTable: "formula_revisions",
          sourceKey: revision.revisionId,
          sourceRow: revision,
          sourceFormulaId: revision.formulaId,
          sourceRevisionId: revision.revisionId,
          targetReference: targetFormulaId,
          issueCode: "missing_target",
          reason: `stable formula dependency target is missing: ${targetFormulaId}`,
          evidence: { kind: "stable_shortcode", ordinal }
        });
        return;
      }
      stableTargets.set(targetFormulaId, {
        ordinal,
        evidence: [{ kind: "stable_shortcode", reference: targetFormulaId }]
      });
    });

    let legacyReferences = [];
    try {
      legacyReferences = extractLegacyDeriveReferences(revision.markdownDerivation);
    } catch (error) {
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: revision.revisionId,
        sourceRow: revision,
        sourceFormulaId: revision.formulaId,
        sourceRevisionId: revision.revisionId,
        issueCode: "invalid_shortcode",
        reason: error.message,
        evidence: { kind: "legacy_shortcode" }
      });
    }
    const duplicateLegacyShortcodeTargets = new Set();
    legacyReferences.forEach((reference, ordinal) => {
      const resolved = candidateIds(aliases, reference.targetSlug);
      if (resolved.length !== 1) {
        queueRepair({
          sourceTable: "formula_revisions",
          sourceKey: revision.revisionId,
          sourceRow: revision,
          sourceFormulaId: revision.formulaId,
          sourceRevisionId: revision.revisionId,
          targetReference: reference.targetSlug,
          issueCode: resolved.length ? "ambiguous_target" : "missing_target",
          reason: resolved.length
            ? `legacy shortcode target is ambiguous: ${reference.targetSlug}`
            : `legacy shortcode target is missing: ${reference.targetSlug}`,
          candidateTargetIds: resolved,
          evidence: { kind: "legacy_shortcode", shortcode: reference.shortcode, ordinal }
        });
        return;
      }
      const targetFormulaId = resolved[0];
      if (legacyShortcodeTargets.has(targetFormulaId)) {
        duplicateLegacyShortcodeTargets.add(targetFormulaId);
        queueRepair({
          sourceTable: "formula_revisions",
          sourceKey: revision.revisionId,
          sourceRow: revision,
          sourceFormulaId: revision.formulaId,
          sourceRevisionId: revision.revisionId,
          targetReference: reference.targetSlug,
          issueCode: "duplicate_dependency",
          reason: `legacy Markdown repeats the same dependency target: ${targetFormulaId}`,
          candidateTargetIds: [targetFormulaId],
          evidence: { kind: "legacy_shortcode", shortcode: reference.shortcode }
        });
        return;
      }
      if (!legacyShortcodeTargets.has(targetFormulaId)) {
        legacyShortcodeTargets.set(targetFormulaId, { ordinal, evidence: [] });
      }
      legacyShortcodeTargets.get(targetFormulaId).evidence.push({
        kind: "legacy_shortcode",
        reference: reference.targetSlug,
        shortcode: reference.shortcode
      });
    });
    duplicateLegacyShortcodeTargets.forEach((targetFormulaId) =>
      legacyShortcodeTargets.delete(targetFormulaId)
    );

    if (sourceCard?.currentRevisionId === revision.revisionId) {
      const sourceNodeIds = new Set(legacySourceIdsByFormula.get(revision.formulaId) || []);
      sourceNodeIds.add(revision.formulaId);
      sourceNodeIds.add(sourceCard.slug);
      if (revision.sourceFormulaId) sourceNodeIds.add(revision.sourceFormulaId);
      const sourceLinks = [...sourceNodeIds].flatMap((sourceNodeId) =>
        linksBySourceNode.get(sourceNodeId) || []
      );
      const duplicateLegacyRelationTargets = new Set();
      for (const link of sourceLinks) {
        processedLegacyLinkIds.add(link.id);
        const resolved = candidateIds(aliases, link.targetSlug);
        if (resolved.length !== 1) {
          queueRepair({
            sourceTable: "knowledge_links",
            sourceKey: link.id,
            sourceRow: link,
            sourceFormulaId: revision.formulaId,
            sourceRevisionId: revision.revisionId,
            targetReference: link.targetSlug,
            issueCode: resolved.length ? "ambiguous_target" : "missing_target",
            reason: resolved.length
              ? `legacy relation target is ambiguous: ${link.targetSlug}`
              : `legacy relation target is missing: ${link.targetSlug}`,
            candidateTargetIds: resolved,
            evidence: { kind: "legacy_relation", linkId: link.id }
          });
          continue;
        }
        const targetFormulaId = resolved[0];
        if (legacyRelationTargets.has(targetFormulaId)) {
          duplicateLegacyRelationTargets.add(targetFormulaId);
          queueRepair({
            sourceTable: "knowledge_links",
            sourceKey: link.id,
            sourceRow: link,
            sourceFormulaId: revision.formulaId,
            sourceRevisionId: revision.revisionId,
            targetReference: link.targetSlug,
            issueCode: "duplicate_dependency",
            reason: `legacy relation records repeat the same dependency target: ${targetFormulaId}`,
            candidateTargetIds: [targetFormulaId],
            evidence: { kind: "legacy_relation", linkId: link.id }
          });
          continue;
        }
        if (!legacyRelationTargets.has(targetFormulaId)) {
          legacyRelationTargets.set(targetFormulaId, {
            ordinal: Number(link.ordinal || 0),
            evidence: []
          });
        }
        legacyRelationTargets.get(targetFormulaId).evidence.push({
          kind: "legacy_relation",
          linkId: link.id,
          targetSlug: link.targetSlug
        });
      }
      duplicateLegacyRelationTargets.forEach((targetFormulaId) =>
        legacyRelationTargets.delete(targetFormulaId)
      );
    }

    const oldTargets = new Set([
      ...legacyShortcodeTargets.keys(),
      ...legacyRelationTargets.keys()
    ]);
    if (stableTargets.size) {
      for (const [targetFormulaId, stable] of stableTargets) {
        addCandidate({
          revisionId: revision.revisionId,
          sourceFormulaId: revision.formulaId,
          targetFormulaId,
          ordinal: stable.ordinal,
          provenance: "markdown",
          evidence: [
            ...stable.evidence,
            ...(legacyShortcodeTargets.get(targetFormulaId)?.evidence || []),
            ...(legacyRelationTargets.get(targetFormulaId)?.evidence || [])
          ],
          sourceRow: revision
        });
      }
      for (const targetFormulaId of oldTargets) {
        if (stableTargets.has(targetFormulaId)) continue;
        const evidence = [
          ...(legacyShortcodeTargets.get(targetFormulaId)?.evidence || []),
          ...(legacyRelationTargets.get(targetFormulaId)?.evidence || [])
        ];
        queueRepair({
          sourceTable: evidence.some((item) => item.kind === "legacy_relation")
            ? "knowledge_links"
            : "formula_revisions",
          sourceKey: evidence.find((item) => item.linkId)?.linkId || revision.revisionId,
          sourceRow: evidence.find((item) => item.linkId) || revision,
          sourceFormulaId: revision.formulaId,
          sourceRevisionId: revision.revisionId,
          targetReference: targetFormulaId,
          issueCode: "evidence_conflict",
          reason: "legacy relation evidence conflicts with authoritative stable formula-ref shortcodes",
          candidateTargetIds: [targetFormulaId, ...stableTargets.keys()],
          evidence: { items: evidence }
        });
      }
    } else {
      const bothKinds = legacyShortcodeTargets.size > 0 && legacyRelationTargets.size > 0;
      for (const targetFormulaId of oldTargets) {
        const shortcode = legacyShortcodeTargets.get(targetFormulaId);
        const relation = legacyRelationTargets.get(targetFormulaId);
        if (bothKinds && (!shortcode || !relation)) {
          queueRepair({
            sourceTable: relation ? "knowledge_links" : "formula_revisions",
            sourceKey: relation?.evidence?.[0]?.linkId || revision.revisionId,
            sourceRow: relation?.evidence?.[0] || revision,
            sourceFormulaId: revision.formulaId,
            sourceRevisionId: revision.revisionId,
            targetReference: targetFormulaId,
            issueCode: "evidence_conflict",
            reason: "legacy shortcode and relation records do not agree",
            candidateTargetIds: [...oldTargets],
            evidence: {
              shortcode: shortcode?.evidence || [],
              relation: relation?.evidence || []
            }
          });
          continue;
        }
        const chosen = shortcode || relation;
        addCandidate({
          revisionId: revision.revisionId,
          sourceFormulaId: revision.formulaId,
          targetFormulaId,
          ordinal: chosen.ordinal,
          provenance: "legacy_linear",
          evidence: [
            ...(shortcode?.evidence || []),
            ...(relation?.evidence || [])
          ],
          sourceRow: revision
        });
      }
    }
  }

  for (const link of inventory.legacyLinks.filter(
    (item) =>
      item.sourceType === "knowledge_node" &&
      item.linkKind === "derive" &&
      !processedLegacyLinkIds.has(item.id)
  )) {
    const sourceFormulaIds = [
      ...new Set([
        ...candidateIds(aliases, link.sourceId),
        ...candidateIds(aliases, link.sourceSlug)
      ])
    ].sort((left, right) => left.localeCompare(right));
    const targetFormulaIds = candidateIds(aliases, link.targetSlug);
    if (!sourceFormulaIds.length) {
      queueRepair({
        sourceTable: "knowledge_links",
        sourceKey: link.id,
        sourceRow: link,
        targetReference: link.targetSlug,
        issueCode: "missing_source",
        reason: `legacy relation source is not mapped to a formula card: ${link.sourceId}`,
        candidateTargetIds: targetFormulaIds,
        evidence: { kind: "legacy_relation", linkId: link.id, sourceId: link.sourceId }
      });
      continue;
    }
    if (sourceFormulaIds.length > 1) {
      queueRepair({
        sourceTable: "knowledge_links",
        sourceKey: link.id,
        sourceRow: link,
        targetReference: link.targetSlug,
        issueCode: "evidence_conflict",
        reason: `legacy relation source maps to multiple formula cards: ${link.sourceId}`,
        candidateTargetIds: targetFormulaIds,
        evidence: {
          kind: "legacy_relation",
          linkId: link.id,
          sourceId: link.sourceId,
          candidateSourceFormulaIds: sourceFormulaIds
        }
      });
      continue;
    }
    const sourceFormulaId = sourceFormulaIds[0];
    const sourceCard = cardById.get(sourceFormulaId);
    queueRepair({
      sourceTable: "knowledge_links",
      sourceKey: link.id,
      sourceRow: link,
      sourceFormulaId,
      sourceRevisionId: sourceCard?.currentRevisionId || "",
      targetReference: link.targetSlug,
      issueCode: sourceCard?.currentRevisionId ? "evidence_conflict" : "relation_without_revision",
      reason: sourceCard?.currentRevisionId
        ? "legacy relation could not be attached to the mapped current revision"
        : "legacy relation source formula has no current revision",
      candidateTargetIds: targetFormulaIds,
      evidence: { kind: "legacy_relation", linkId: link.id, sourceId: link.sourceId }
    });
  }

  const accepted = [];
  const occupiedOrdinals = new Map();
  for (const dependency of inventory.dependencies) {
    if (!occupiedOrdinals.has(dependency.revisionId)) {
      occupiedOrdinals.set(dependency.revisionId, new Map());
    }
    occupiedOrdinals.get(dependency.revisionId).set(Number(dependency.ordinal), dependency);
  }
  for (const candidate of [...candidates.values()].sort((left, right) =>
    `${left.revisionId}:${String(left.ordinal).padStart(8, "0")}:${left.targetFormulaId}`.localeCompare(
      `${right.revisionId}:${String(right.ordinal).padStart(8, "0")}:${right.targetFormulaId}`
    )
  )) {
    const sourceRevision = revisionById.get(candidate.revisionId);
    const targetCard = cardById.get(candidate.targetFormulaId);
    if (!sourceRevision) {
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: candidate.revisionId,
        sourceRow: candidate.sourceRow,
        sourceFormulaId: candidate.sourceFormulaId,
        sourceRevisionId: candidate.revisionId,
        targetReference: candidate.targetFormulaId,
        issueCode: "relation_without_revision",
        reason: "relation source revision is missing",
        candidateTargetIds: [candidate.targetFormulaId],
        evidence: { items: candidate.evidence }
      });
      continue;
    }
    if (candidate.sourceFormulaId === candidate.targetFormulaId) {
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: candidate.revisionId,
        sourceRow: candidate.sourceRow,
        sourceFormulaId: candidate.sourceFormulaId,
        sourceRevisionId: candidate.revisionId,
        targetReference: candidate.targetFormulaId,
        issueCode: "self_reference",
        reason: "formula dependency cannot reference itself",
        candidateTargetIds: [candidate.targetFormulaId],
        evidence: { items: candidate.evidence }
      });
      continue;
    }
    if (!targetCard) continue;
    if (targetCard.publishStatus === "archived" || targetCard.archivedAt) {
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: candidate.revisionId,
        sourceRow: candidate.sourceRow,
        sourceFormulaId: candidate.sourceFormulaId,
        sourceRevisionId: candidate.revisionId,
        targetReference: candidate.targetFormulaId,
        issueCode: "archived_target",
        reason: "recovered dependency target is archived",
        candidateTargetIds: [candidate.targetFormulaId],
        evidence: { items: candidate.evidence }
      });
      continue;
    }
    const existing = existingByRevisionTarget.get(
      `${candidate.revisionId}\u0000${candidate.targetFormulaId}`
    );
    if (existing) {
      if (Number(existing.ordinal) !== Number(candidate.ordinal)) {
        queueRepair({
          sourceTable: "formula_revision_dependencies",
          sourceKey: `${candidate.revisionId}:${candidate.targetFormulaId}`,
          sourceRow: existing,
          sourceFormulaId: candidate.sourceFormulaId,
          sourceRevisionId: candidate.revisionId,
          targetReference: candidate.targetFormulaId,
          issueCode: "evidence_conflict",
          reason: "existing immutable dependency ordinal conflicts with recovered evidence",
          candidateTargetIds: [candidate.targetFormulaId],
          evidence: { existing, recovered: candidate.evidence }
        });
      }
      continue;
    }
    const ordinalOwner = occupiedOrdinals.get(candidate.revisionId)?.get(Number(candidate.ordinal));
    if (ordinalOwner && ordinalOwner.targetFormulaId !== candidate.targetFormulaId) {
      queueRepair({
        sourceTable: "formula_revision_dependencies",
        sourceKey: `${candidate.revisionId}:${candidate.ordinal}`,
        sourceRow: ordinalOwner,
        sourceFormulaId: candidate.sourceFormulaId,
        sourceRevisionId: candidate.revisionId,
        targetReference: candidate.targetFormulaId,
        issueCode: "evidence_conflict",
        reason: "recovered dependency ordinal is already occupied by another target",
        candidateTargetIds: [candidate.targetFormulaId, ordinalOwner.targetFormulaId],
        evidence: { ordinalOwner, recovered: candidate.evidence }
      });
      continue;
    }
    accepted.push(candidate);
    if (!occupiedOrdinals.has(candidate.revisionId)) occupiedOrdinals.set(candidate.revisionId, new Map());
    occupiedOrdinals.get(candidate.revisionId).set(Number(candidate.ordinal), candidate);
  }

  const currentRevisionIds = new Set(inventory.cards.map((card) => card.currentRevisionId).filter(Boolean));
  const existingCurrentEdges = inventory.dependencies.filter((dependency) =>
    currentRevisionIds.has(dependency.revisionId)
  );
  const activeCandidates = new Set(
    accepted.filter((candidate) => currentRevisionIds.has(candidate.revisionId))
  );
  while (activeCandidates.size) {
    const analysis = analyzeFormulaDependencyGraph({
      formulaIds,
      edges: [...existingCurrentEdges, ...activeCandidates]
    });
    const cycle = analysis.issues.find((issue) => issue.code === "FORMULA_DEPENDENCY_CYCLE");
    if (!cycle) break;
    const cycleEdges = new Set(
      cycle.cyclePath.slice(0, -1).map((sourceFormulaId, index) =>
        `${sourceFormulaId}\u0000${cycle.cyclePath[index + 1]}`
      )
    );
    const affected = [...activeCandidates].filter((candidate) =>
      cycleEdges.has(`${candidate.sourceFormulaId}\u0000${candidate.targetFormulaId}`)
    );
    if (!affected.length) throw new Error("existing current formula graph already contains a cycle");
    for (const candidate of affected) {
      activeCandidates.delete(candidate);
      const index = accepted.indexOf(candidate);
      if (index >= 0) accepted.splice(index, 1);
      queueRepair({
        sourceTable: "formula_revisions",
        sourceKey: candidate.revisionId,
        sourceRow: candidate.sourceRow,
        sourceFormulaId: candidate.sourceFormulaId,
        sourceRevisionId: candidate.revisionId,
        targetReference: candidate.targetFormulaId,
        issueCode: "cycle",
        reason: `recovered relation would form a cycle: ${cycle.cyclePath.join(" -> ")}`,
        candidateTargetIds: [candidate.targetFormulaId],
        evidence: { items: candidate.evidence, cyclePath: cycle.cyclePath }
      });
    }
  }

  for (const candidate of [...accepted]) {
    if (currentRevisionIds.has(candidate.revisionId)) continue;
    const analysis = analyzeFormulaDependencyGraph({
      formulaIds,
      edges: [...existingCurrentEdges, candidate]
    });
    const cycle = analysis.issues.find((issue) => issue.code === "FORMULA_DEPENDENCY_CYCLE");
    if (!cycle) continue;
    accepted.splice(accepted.indexOf(candidate), 1);
    queueRepair({
      sourceTable: "formula_revisions",
      sourceKey: candidate.revisionId,
      sourceRow: candidate.sourceRow,
      sourceFormulaId: candidate.sourceFormulaId,
      sourceRevisionId: candidate.revisionId,
      targetReference: candidate.targetFormulaId,
      issueCode: "cycle",
      reason: `historical relation would close a cycle against current graph: ${cycle.cyclePath.join(" -> ")}`,
      candidateTargetIds: [candidate.targetFormulaId],
      evidence: { items: candidate.evidence, cyclePath: cycle.cyclePath }
    });
  }

  const relations = accepted
    .map((candidate) => ({
      revisionId: candidate.revisionId,
      sourceFormulaId: candidate.sourceFormulaId,
      targetFormulaId: candidate.targetFormulaId,
      ordinal: Number(candidate.ordinal),
      provenance: candidate.provenance,
      evidence: candidate.evidence
    }))
    .sort((left, right) =>
      `${left.revisionId}:${String(left.ordinal).padStart(8, "0")}:${left.targetFormulaId}`.localeCompare(
        `${right.revisionId}:${String(right.ordinal).padStart(8, "0")}:${right.targetFormulaId}`
      )
    );
  const repairRows = [...repairs.values()].sort((left, right) =>
    left.repairId.localeCompare(right.repairId)
  );
  const planBody = {
    schemaVersion: "larkix.formula-relation-migration-plan.v1",
    sourceInventory: {
      counts: inventory.counts,
      exactDigest: inventory.exactDigest,
      preservedDigest: inventory.preservedDigest
    },
    relations,
    repairs: repairRows
  };
  return { ...planBody, planDigest: sha256(stableStringify(planBody)) };
}

function dryRunRelationMigration({ db, dbPath, fixtureDir }) {
  assertDisposableFixture(fixtureDir, dbPath);
  const manifest = createRelationBackup({ db, dbPath, fixtureDir });
  const restoreVerification = verifyRelationBackup({ manifest, fixtureDir });
  if (!restoreVerification.passed) {
    throw new Error(`relation backup restore verification failed: ${restoreVerification.mismatches.join("; ")}`);
  }
  const plan = buildRelationMigrationPlan(db);
  const reportBody = {
    schemaVersion: "larkix.formula-relation-migration-report.v1",
    mode: "dry_run",
    plan,
    manifest,
    restoreVerification,
    verification: {
      passed: true,
      insertedRelationCount: 0,
      queuedRepairCount: 0,
      preservedDigestBefore: plan.sourceInventory.preservedDigest,
      preservedDigestAfter: plan.sourceInventory.preservedDigest,
      zeroDeletion: true,
      checks: databaseChecks(db)
    }
  };
  return { ...reportBody, reportDigest: sha256(stableStringify(reportBody)) };
}

function applyDisposableRelationMigration({ db, dbPath, fixtureDir }) {
  const dryRun = dryRunRelationMigration({ db, dbPath, fixtureDir });
  const before = relationInventory(db);
  let insertedRelationCount = 0;
  let queuedRepairCount = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    const insertRelation = db.prepare(
      `INSERT OR IGNORE INTO formula_revision_dependencies
        (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const relation of dryRun.plan.relations) {
      const result = insertRelation.run(
        relation.revisionId,
        relation.sourceFormulaId,
        relation.targetFormulaId,
        relation.ordinal,
        relation.provenance
      );
      insertedRelationCount += Number(result.changes || 0);
    }
    const insertRepair = db.prepare(
      `INSERT OR IGNORE INTO formula_relation_repair_queue
        (repair_id, source_table, source_key, source_digest, source_formula_id,
         source_revision_id, target_reference, issue_code, reason,
         candidate_target_ids_json, evidence_json, plan_digest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const repair of dryRun.plan.repairs) {
      const result = insertRepair.run(
        repair.repairId,
        repair.sourceTable,
        repair.sourceKey,
        repair.sourceDigest,
        repair.sourceFormulaId,
        repair.sourceRevisionId,
        repair.targetReference,
        repair.issueCode,
        repair.reason,
        stableStringify(repair.candidateTargetIds),
        stableStringify(repair.evidence),
        dryRun.plan.planDigest
      );
      queuedRepairCount += Number(result.changes || 0);
    }
    const after = relationInventory(db);
    if (after.preservedDigest !== before.preservedDigest) {
      throw new Error("relation migration changed legacy rows, cards, revisions, or article bindings");
    }
    for (const relation of dryRun.plan.relations) {
      const row = db
        .prepare(
          `SELECT source_formula_id AS sourceFormulaId, ordinal, provenance
           FROM formula_revision_dependencies
           WHERE revision_id = ? AND target_formula_id = ?`
        )
        .get(relation.revisionId, relation.targetFormulaId);
      if (
        !row ||
        row.sourceFormulaId !== relation.sourceFormulaId ||
        Number(row.ordinal) !== Number(relation.ordinal) ||
        row.provenance !== relation.provenance
      ) {
        throw new Error(`relation verification failed: ${relation.revisionId}/${relation.targetFormulaId}`);
      }
    }
    const checks = databaseChecks(db);
    if (!checks.passed) throw new Error("relation migration SQLite checks failed");
    const verification = {
      passed: true,
      insertedRelationCount,
      queuedRepairCount,
      relationCountBefore: before.counts.formulaRevisionDependencies,
      relationCountAfter: after.counts.formulaRevisionDependencies,
      repairCountBefore: before.counts.repairQueue,
      repairCountAfter: after.counts.repairQueue,
      preservedDigestBefore: before.preservedDigest,
      preservedDigestAfter: after.preservedDigest,
      zeroDeletion: true,
      checks
    };
    const reportBody = {
      schemaVersion: "larkix.formula-relation-migration-report.v1",
      mode: "apply_verified",
      plan: dryRun.plan,
      manifest: dryRun.manifest,
      restoreVerification: dryRun.restoreVerification,
      verification
    };
    const report = { ...reportBody, reportDigest: sha256(stableStringify(reportBody)) };
    db.prepare(
      `INSERT OR IGNORE INTO formula_relation_migration_reports
        (report_digest, plan_digest, backup_database_sha256, mode,
         inserted_relation_count, queued_repair_count, report_json)
       VALUES (?, ?, ?, 'apply_verified', ?, ?, ?)`
    ).run(
      report.reportDigest,
      dryRun.plan.planDigest,
      dryRun.manifest.backupDatabaseSha256,
      insertedRelationCount,
      queuedRepairCount,
      stableStringify(report)
    );
    db.exec("COMMIT");
    return report;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original migration failure.
    }
    throw error;
  }
}

module.exports = {
  applyDisposableRelationMigration,
  buildRelationMigrationPlan,
  createRelationBackup,
  dryRunRelationMigration,
  relationInventory,
  verifyRelationBackup
};
