"use strict";

const crypto = require("node:crypto");

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function formulaBindingId(sourceKind, sourceId, targetFormulaId) {
  const key = JSON.stringify([sourceKind, sourceId, targetFormulaId]);
  return `fbind.${crypto.createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

module.exports = {
  id: "028_formula_content_bindings",
  name: "Unify article and formula derivation bindings",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_content_bindings (
        binding_id TEXT PRIMARY KEY,
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_formula_id TEXT NOT NULL DEFAULT '',
        target_formula_id TEXT NOT NULL,
        target_revision_id TEXT,
        display_mode TEXT NOT NULL DEFAULT 'display',
        ordinal INTEGER NOT NULL DEFAULT 0,
        location_json TEXT NOT NULL DEFAULT '{}',
        lifecycle_status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (target_revision_id) REFERENCES formula_revisions(revision_id),
        CHECK (binding_id GLOB 'fbind.*'),
        CHECK (source_kind IN ('article', 'formula_revision')),
        CHECK (
          (source_kind = 'article' AND source_formula_id = '') OR
          (source_kind = 'formula_revision' AND length(source_formula_id) > 0)
        ),
        CHECK (source_formula_id = '' OR source_formula_id <> target_formula_id),
        CHECK (display_mode IN ('inline', 'display')),
        CHECK (ordinal >= 0),
        CHECK (json_valid(location_json)),
        CHECK (lifecycle_status IN ('active', 'retired')),
        UNIQUE (source_kind, source_id, target_formula_id)
      );

      CREATE INDEX IF NOT EXISTS idx_formula_content_bindings_source
        ON formula_content_bindings(source_kind, source_id, ordinal, binding_id);

      CREATE INDEX IF NOT EXISTS idx_formula_content_bindings_target
        ON formula_content_bindings(target_formula_id, source_kind, lifecycle_status, binding_id);

      CREATE TABLE IF NOT EXISTS formula_content_binding_sources (
        source_table TEXT NOT NULL,
        source_key TEXT NOT NULL,
        binding_id TEXT NOT NULL,
        source_digest TEXT NOT NULL,
        provenance TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_table, source_key),
        FOREIGN KEY (binding_id) REFERENCES formula_content_bindings(binding_id),
        CHECK (source_table IN (
          'article_formula_bindings',
          'formula_revision_dependencies',
          'formula_derivation_edges'
        )),
        CHECK (source_digest GLOB 'sha256:*'),
        CHECK (provenance IN ('article_shortcode', 'formula_revision', 'legacy_edge'))
      );

      CREATE INDEX IF NOT EXISTS idx_formula_content_binding_sources_binding
        ON formula_content_binding_sources(binding_id, source_table, source_key);

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_target_revision_insert
      BEFORE INSERT ON formula_content_bindings
      WHEN NEW.target_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revisions
            WHERE revision_id = NEW.target_revision_id
              AND formula_id = NEW.target_formula_id
          )
          THEN RAISE(ABORT, 'binding target revision does not belong to target formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_article_source_insert
      BEFORE INSERT ON formula_content_bindings
      WHEN NEW.source_kind = 'article'
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (SELECT 1 FROM posts WHERE id = NEW.source_id)
          THEN RAISE(ABORT, 'binding source article is missing')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_target_revision_update
      BEFORE UPDATE OF target_revision_id ON formula_content_bindings
      WHEN NEW.target_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revisions
            WHERE revision_id = NEW.target_revision_id
              AND formula_id = NEW.target_formula_id
          )
          THEN RAISE(ABORT, 'binding target revision does not belong to target formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_source_revision_insert
      BEFORE INSERT ON formula_content_bindings
      WHEN NEW.source_kind = 'formula_revision'
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revisions
            WHERE revision_id = NEW.source_id
              AND formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'binding source revision does not belong to source formula')
        END;
        SELECT CASE
          WHEN NEW.source_formula_id = NEW.target_formula_id
          THEN RAISE(ABORT, 'formula binding self-reference is not allowed')
        END;
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT NEW.target_formula_id
              UNION
              SELECT relation.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_content_bindings relation
                ON relation.source_kind = 'formula_revision'
               AND relation.source_id = card.current_revision_id
               AND relation.lifecycle_status = 'active'
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'formula binding cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_formula_reactivate
      BEFORE UPDATE OF lifecycle_status ON formula_content_bindings
      WHEN OLD.lifecycle_status = 'retired'
       AND NEW.lifecycle_status = 'active'
       AND NEW.source_kind = 'formula_revision'
      BEGIN
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT NEW.target_formula_id
              UNION
              SELECT relation.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_content_bindings relation
                ON relation.source_kind = 'formula_revision'
               AND relation.source_id = card.current_revision_id
               AND relation.lifecycle_status = 'active'
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'formula binding cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_current_content_binding_cycle
      BEFORE UPDATE OF current_revision_id ON formula_cards
      WHEN NEW.current_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT target_formula_id
              FROM formula_content_bindings
              WHERE source_kind = 'formula_revision'
                AND source_id = NEW.current_revision_id
                AND lifecycle_status = 'active'
              UNION
              SELECT relation.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_content_bindings relation
                ON relation.source_kind = 'formula_revision'
               AND relation.source_id = CASE
                 WHEN card.formula_id = NEW.formula_id THEN NEW.current_revision_id
                 ELSE card.current_revision_id
               END
               AND relation.lifecycle_status = 'active'
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'formula binding cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_bindings_identity_immutable
      BEFORE UPDATE OF binding_id, source_kind, source_id, source_formula_id, target_formula_id
      ON formula_content_bindings
      BEGIN
        SELECT RAISE(ABORT, 'formula content binding identity is immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_bindings_no_delete
      BEFORE DELETE ON formula_content_bindings
      BEGIN
        SELECT RAISE(ABORT, 'formula content bindings must be retired instead of deleted');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_sources_immutable_update
      BEFORE UPDATE ON formula_content_binding_sources
      BEGIN
        SELECT RAISE(ABORT, 'formula content binding source evidence is immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_content_binding_sources_immutable_delete
      BEFORE DELETE ON formula_content_binding_sources
      BEGIN
        SELECT RAISE(ABORT, 'formula content binding source evidence is immutable');
      END;
    `);

    const insertBinding = db.prepare(`
      INSERT INTO formula_content_bindings
        (binding_id, source_kind, source_id, source_formula_id, target_formula_id,
         target_revision_id, display_mode, ordinal, location_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_kind, source_id, target_formula_id) DO NOTHING
    `);
    const bindingBySemanticKey = db.prepare(`
      SELECT binding_id AS bindingId
      FROM formula_content_bindings
      WHERE source_kind = ? AND source_id = ? AND target_formula_id = ?
    `);
    const insertSource = db.prepare(`
      INSERT INTO formula_content_binding_sources
        (source_table, source_key, binding_id, source_digest, provenance)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_table, source_key) DO NOTHING
    `);
    const persist = (binding, evidence) => {
      insertBinding.run(
        binding.bindingId,
        binding.sourceKind,
        binding.sourceId,
        binding.sourceFormulaId,
        binding.targetFormulaId,
        binding.targetRevisionId,
        binding.displayMode,
        binding.ordinal,
        JSON.stringify(binding.location)
      );
      const authoritative = bindingBySemanticKey.get(
        binding.sourceKind,
        binding.sourceId,
        binding.targetFormulaId
      );
      insertSource.run(
        evidence.sourceTable,
        evidence.sourceKey,
        authoritative.bindingId,
        digest(evidence.digestInput),
        evidence.provenance
      );
    };

    const articleLocations = new Map();
    const articleRows = db.prepare(`
      SELECT binding_id AS legacyBindingId, post_id AS postId,
             formula_id AS formulaId, revision_id AS revisionId,
             display_mode AS displayMode, ordinal
      FROM article_formula_bindings
      ORDER BY post_id, ordinal, binding_id
    `).all();
    for (const row of articleRows) {
      const key = `${row.postId}\u0000${row.formulaId}`;
      if (!articleLocations.has(key)) articleLocations.set(key, []);
      articleLocations.get(key).push({
        legacyBindingId: row.legacyBindingId,
        revisionId: row.revisionId,
        displayMode: row.displayMode,
        ordinal: Number(row.ordinal)
      });
    }
    for (const row of articleRows) {
      const key = `${row.postId}\u0000${row.formulaId}`;
      const locations = articleLocations.get(key);
      const revisionIds = [...new Set(locations.map((item) => item.revisionId))];
      persist(
        {
          bindingId: formulaBindingId("article", row.postId, row.formulaId),
          sourceKind: "article",
          sourceId: row.postId,
          sourceFormulaId: "",
          targetFormulaId: row.formulaId,
          targetRevisionId: revisionIds.length === 1 ? revisionIds[0] : null,
          displayMode: locations[0].displayMode,
          ordinal: locations[0].ordinal,
          location: { references: locations }
        },
        {
          sourceTable: "article_formula_bindings",
          sourceKey: row.legacyBindingId,
          digestInput: JSON.stringify(row),
          provenance: "article_shortcode"
        }
      );
    }

    for (const row of db.prepare(`
      SELECT revision_id AS revisionId, source_formula_id AS sourceFormulaId,
             target_formula_id AS targetFormulaId, ordinal, provenance
      FROM formula_revision_dependencies
      ORDER BY revision_id, ordinal, target_formula_id
    `).all()) {
      const sourceKey = `${row.revisionId}:${row.targetFormulaId}`;
      persist(
        {
          bindingId: formulaBindingId("formula_revision", row.revisionId, row.targetFormulaId),
          sourceKind: "formula_revision",
          sourceId: row.revisionId,
          sourceFormulaId: row.sourceFormulaId,
          targetFormulaId: row.targetFormulaId,
          targetRevisionId: null,
          displayMode: "display",
          ordinal: Number(row.ordinal),
          location: { provenance: row.provenance }
        },
        {
          sourceTable: "formula_revision_dependencies",
          sourceKey,
          digestInput: JSON.stringify(row),
          provenance: "formula_revision"
        }
      );
    }

    for (const row of db.prepare(`
      SELECT edge.source_formula_id AS sourceFormulaId,
             edge.target_formula_id AS targetFormulaId,
             card.current_revision_id AS sourceRevisionId
      FROM formula_derivation_edges edge
      JOIN formula_cards card ON card.formula_id = edge.source_formula_id
      WHERE card.current_revision_id IS NOT NULL
      ORDER BY edge.source_formula_id, edge.target_formula_id
    `).all()) {
      const sourceKey = `${row.sourceFormulaId}:${row.targetFormulaId}`;
      persist(
        {
          bindingId: formulaBindingId("formula_revision", row.sourceRevisionId, row.targetFormulaId),
          sourceKind: "formula_revision",
          sourceId: row.sourceRevisionId,
          sourceFormulaId: row.sourceFormulaId,
          targetFormulaId: row.targetFormulaId,
          targetRevisionId: null,
          displayMode: "display",
          ordinal: 0,
          location: { legacyEdge: true }
        },
        {
          sourceTable: "formula_derivation_edges",
          sourceKey,
          digestInput: JSON.stringify(row),
          provenance: "legacy_edge"
        }
      );
    }
  },
  formulaBindingId
};
