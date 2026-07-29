"use strict";

const FORMULA_DEPENDENCY_PATTERN =
  /\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g;

function markdownDependencies(markdown) {
  const source = String(markdown || "")
    .replace(/```[\s\S]*?```/g, (match) => " ".repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => " ".repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => " ".repeat(match.length))
    .replace(/\$[^$\n]*\$/g, (match) => " ".repeat(match.length));
  return [...source.matchAll(FORMULA_DEPENDENCY_PATTERN)].map((match) => match[1]);
}

module.exports = {
  id: "021_branching_derivation_graph",
  name: "Add revision-aware branching formula dependencies",
  up(db) {
    const revisionColumns = new Set(
      db.prepare("PRAGMA table_info(formula_revisions)").all().map((column) => column.name)
    );
    const revisionMetadataColumns = [
      ["display_name", "TEXT NOT NULL DEFAULT ''"],
      ["module_key", "TEXT NOT NULL DEFAULT ''"],
      ["category_path", "TEXT NOT NULL DEFAULT ''"],
      ["purpose", "TEXT NOT NULL DEFAULT ''"],
      ["tags_json", "TEXT NOT NULL DEFAULT '[]'"]
    ];
    for (const [column, definition] of revisionMetadataColumns) {
      if (!revisionColumns.has(column)) {
        db.exec(`ALTER TABLE formula_revisions ADD COLUMN ${column} ${definition}`);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_revision_dependencies (
        revision_id TEXT NOT NULL,
        source_formula_id TEXT NOT NULL,
        target_formula_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'markdown',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (revision_id, target_formula_id),
        UNIQUE (revision_id, ordinal),
        FOREIGN KEY (revision_id) REFERENCES formula_revisions(revision_id),
        FOREIGN KEY (source_formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (target_formula_id) REFERENCES formula_cards(formula_id),
        CHECK (source_formula_id <> target_formula_id),
        CHECK (ordinal >= 0),
        CHECK (provenance IN ('markdown', 'legacy_linear'))
      );

      CREATE INDEX IF NOT EXISTS idx_formula_revision_dependencies_source
        ON formula_revision_dependencies(source_formula_id, revision_id, ordinal);

      CREATE INDEX IF NOT EXISTS idx_formula_revision_dependencies_target
        ON formula_revision_dependencies(target_formula_id, source_formula_id, revision_id);

      CREATE TRIGGER IF NOT EXISTS formula_revision_dependency_validate_insert
      BEFORE INSERT ON formula_revision_dependencies
      BEGIN
        SELECT CASE
          WHEN NEW.source_formula_id = NEW.target_formula_id
          THEN RAISE(ABORT, 'formula dependency self-reference is not allowed')
        END;
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.revision_id
              AND formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'formula dependency revision owner is invalid')
        END;
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_cards WHERE formula_id = NEW.target_formula_id
          )
          THEN RAISE(ABORT, 'formula dependency target is missing')
        END;
        SELECT CASE
          WHEN EXISTS (
            SELECT 1
            FROM formula_revision_dependencies
            WHERE revision_id = NEW.revision_id
              AND target_formula_id = NEW.target_formula_id
          )
          THEN RAISE(ABORT, 'formula dependency duplicate is not allowed')
        END;
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT NEW.target_formula_id
              UNION
              SELECT dependency.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_revision_dependencies dependency
                ON dependency.revision_id = card.current_revision_id
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'formula dependency cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revision_dependencies_immutable_update
      BEFORE UPDATE ON formula_revision_dependencies
      BEGIN
        SELECT RAISE(ABORT, 'formula revision dependencies are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revision_dependencies_immutable_delete
      BEFORE DELETE ON formula_revision_dependencies
      BEGIN
        SELECT RAISE(ABORT, 'formula revision dependencies are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_current_dependency_cycle
      BEFORE UPDATE OF current_revision_id ON formula_cards
      WHEN NEW.current_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT target_formula_id
              FROM formula_revision_dependencies
              WHERE revision_id = NEW.current_revision_id
              UNION
              SELECT dependency.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_revision_dependencies dependency
                ON dependency.revision_id = CASE
                  WHEN card.formula_id = NEW.formula_id THEN NEW.current_revision_id
                  ELSE card.current_revision_id
                END
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'formula dependency cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_published_dependency_gate
      BEFORE UPDATE OF published_revision_id ON formula_cards
      WHEN NEW.published_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN EXISTS (
            SELECT 1
            FROM formula_revision_dependencies dependency
            LEFT JOIN formula_cards target
              ON target.formula_id = dependency.target_formula_id
            WHERE dependency.revision_id = NEW.published_revision_id
              AND (
                target.formula_id IS NULL
                OR target.publish_status <> 'published'
                OR target.published_revision_id IS NULL
              )
          )
          THEN RAISE(ABORT, 'formula dependency is not eligible for publication')
        END;
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT target_formula_id
              FROM formula_revision_dependencies
              WHERE revision_id = NEW.published_revision_id
              UNION
              SELECT dependency.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_revision_dependencies dependency
                ON dependency.revision_id = CASE
                  WHEN card.formula_id = NEW.formula_id THEN NEW.published_revision_id
                  ELSE card.published_revision_id
                END
              WHERE CASE
                WHEN card.formula_id = NEW.formula_id THEN NEW.publish_status
                ELSE card.publish_status
              END = 'published'
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'published formula dependency cycle is not allowed')
        END;
      END;
    `);

    const revisionMetadata = db
      .prepare(
        `SELECT revision.revision_id AS revisionId,
                card.display_name AS displayName, card.module_key AS moduleKey,
                card.category_path AS categoryPath, card.purpose
         FROM formula_revisions revision
         JOIN formula_cards card ON card.formula_id = revision.formula_id
         ORDER BY revision.formula_id ASC, revision.sequence_no ASC`
      )
      .all();
    db.exec("DROP TRIGGER IF EXISTS formula_revisions_immutable_update");
    const tagLookup = db.prepare(
      `SELECT tag_key AS tagKey
       FROM formula_card_tags
       WHERE formula_id = (
         SELECT formula_id FROM formula_revisions WHERE revision_id = ?
       )
       ORDER BY tag_key ASC`
    );
    const backfillRevisionMetadata = db.prepare(
      `UPDATE formula_revisions
       SET display_name = ?, module_key = ?, category_path = ?, purpose = ?, tags_json = ?
       WHERE revision_id = ? AND display_name = ''`
    );
    for (const revision of revisionMetadata) {
      const tags = tagLookup.all(revision.revisionId).map((row) => row.tagKey);
      backfillRevisionMetadata.run(
        revision.displayName,
        revision.moduleKey,
        revision.categoryPath,
        revision.purpose || "",
        JSON.stringify(tags),
        revision.revisionId
      );
    }
    db.exec(`
      CREATE TRIGGER formula_revisions_immutable_update
      BEFORE UPDATE ON formula_revisions
      BEGIN
        SELECT RAISE(ABORT, 'formula revisions are immutable');
      END;
    `);

    const cardIds = new Set(
      db.prepare("SELECT formula_id AS formulaId FROM formula_cards").all().map((row) => row.formulaId)
    );
    const insert = db.prepare(`
      INSERT OR IGNORE INTO formula_revision_dependencies
        (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
      VALUES (?, ?, ?, ?, ?)
    `);
    const nextOrdinal = db.prepare(`
      SELECT COALESCE(MAX(ordinal), -1) + 1 AS ordinal
      FROM formula_revision_dependencies
      WHERE revision_id = ?
    `);

    for (const revision of db
      .prepare(
        `SELECT revision_id AS revisionId, formula_id AS formulaId,
                markdown_derivation AS markdownDerivation
         FROM formula_revisions
         ORDER BY formula_id ASC, sequence_no ASC`
      )
      .all()) {
      const seen = new Set();
      markdownDependencies(revision.markdownDerivation).forEach((targetFormulaId, ordinal) => {
        if (seen.has(targetFormulaId)) {
          throw new Error(`duplicate formula dependency in revision ${revision.revisionId}: ${targetFormulaId}`);
        }
        if (!cardIds.has(targetFormulaId)) {
          throw new Error(`missing formula dependency in revision ${revision.revisionId}: ${targetFormulaId}`);
        }
        seen.add(targetFormulaId);
        insert.run(revision.revisionId, revision.formulaId, targetFormulaId, ordinal, "markdown");
      });
    }

    const legacyEdges = db
      .prepare(
        `SELECT edge.source_formula_id AS sourceFormulaId,
                edge.target_formula_id AS targetFormulaId,
                card.current_revision_id AS currentRevisionId,
                card.published_revision_id AS publishedRevisionId
         FROM formula_derivation_edges edge
         JOIN formula_cards card ON card.formula_id = edge.source_formula_id
         ORDER BY edge.source_formula_id ASC, edge.target_formula_id ASC`
      )
      .all();
    for (const edge of legacyEdges) {
      const revisionIds = [...new Set([edge.currentRevisionId, edge.publishedRevisionId].filter(Boolean))];
      for (const revisionId of revisionIds) {
        insert.run(
          revisionId,
          edge.sourceFormulaId,
          edge.targetFormulaId,
          Number(nextOrdinal.get(revisionId).ordinal),
          "legacy_linear"
        );
      }
    }
  }
};
