"use strict";

const REVISION_PRESENTATION_COLUMNS = [
  ["display_name", "TEXT NOT NULL DEFAULT ''"],
  ["module_key", "TEXT NOT NULL DEFAULT ''"],
  ["category_path", "TEXT NOT NULL DEFAULT ''"],
  ["purpose", "TEXT NOT NULL DEFAULT ''"],
  ["tags_json", "TEXT NOT NULL DEFAULT '[]'"]
];

module.exports = {
  id: "022_formula_revision_presentation_snapshot",
  name: "Version formula presentation metadata with immutable revisions",
  up(db) {
    const columns = new Set(
      db.prepare("PRAGMA table_info(formula_revisions)").all().map((column) => column.name)
    );
    for (const [column, definition] of REVISION_PRESENTATION_COLUMNS) {
      if (!columns.has(column)) {
        db.exec(`ALTER TABLE formula_revisions ADD COLUMN ${column} ${definition}`);
      }
    }

    const tagsForFormula = db.prepare(
      `SELECT tag_key AS tagKey
       FROM formula_card_tags
       WHERE formula_id = ?
       ORDER BY tag_key ASC`
    );
    const updateRevision = db.prepare(
      `UPDATE formula_revisions
       SET display_name = ?, module_key = ?, category_path = ?, purpose = ?, tags_json = ?
       WHERE revision_id = ?`
    );
    db.exec("DROP TRIGGER IF EXISTS formula_revisions_immutable_update");
    const revisions = db
      .prepare(
        `SELECT revision.revision_id AS revisionId, revision.formula_id AS formulaId,
                revision.display_name AS displayName,
                card.display_name AS cardDisplayName,
                revision.module_key AS moduleKey,
                card.module_key AS cardModuleKey,
                revision.category_path AS categoryPath,
                card.category_path AS cardCategoryPath,
                revision.purpose, card.purpose AS cardPurpose,
                revision.tags_json AS tagsJson
         FROM formula_revisions revision
         JOIN formula_cards card ON card.formula_id = revision.formula_id
         ORDER BY revision.formula_id ASC, revision.sequence_no ASC`
      )
      .all();
    for (const revision of revisions) {
      const hasSnapshot =
        revision.displayName ||
        revision.moduleKey ||
        revision.categoryPath ||
        revision.purpose ||
        revision.tagsJson !== "[]";
      if (hasSnapshot) continue;
      const tags = tagsForFormula.all(revision.formulaId).map((row) => row.tagKey);
      updateRevision.run(
        revision.cardDisplayName,
        revision.cardModuleKey,
        revision.cardCategoryPath,
        revision.cardPurpose || "",
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
  }
};
