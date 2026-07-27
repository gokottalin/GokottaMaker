"use strict";

module.exports = {
  id: "017_linear_derivation_graph",
  name: "Create convergent non-branching formula derivation graph",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_derivation_edges (
        source_formula_id TEXT PRIMARY KEY,
        target_formula_id TEXT NOT NULL,
        actor_user_id INTEGER,
        actor_username TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (target_formula_id) REFERENCES formula_cards(formula_id),
        CHECK (source_formula_id <> target_formula_id),
        CHECK (length(actor_username) <= 120)
      );

      CREATE INDEX IF NOT EXISTS idx_formula_derivation_edges_target
        ON formula_derivation_edges(target_formula_id, source_formula_id);

      CREATE TRIGGER IF NOT EXISTS formula_derivation_edge_validate_insert
      BEFORE INSERT ON formula_derivation_edges
      BEGIN
        SELECT CASE
          WHEN NEW.source_formula_id = NEW.target_formula_id
          THEN RAISE(ABORT, 'formula derivation self-link is not allowed')
        END;
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_cards WHERE formula_id = NEW.source_formula_id
          ) OR NOT EXISTS (
            SELECT 1 FROM formula_cards WHERE formula_id = NEW.target_formula_id
          )
          THEN RAISE(ABORT, 'formula derivation target is missing')
        END;
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE next_chain(formula_id) AS (
              SELECT NEW.target_formula_id
              UNION
              SELECT e.target_formula_id
              FROM formula_derivation_edges e
              JOIN next_chain c ON e.source_formula_id = c.formula_id
            )
            SELECT 1 FROM next_chain WHERE formula_id = NEW.source_formula_id
          )
          THEN RAISE(ABORT, 'formula derivation cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_derivation_edge_identity_immutable
      BEFORE UPDATE OF source_formula_id, target_formula_id
      ON formula_derivation_edges
      BEGIN
        SELECT RAISE(ABORT, 'formula derivation edge replacement must be explicit');
      END;
    `);
  }
};
