"use strict";

module.exports = {
  id: "016_formula_reference_decisions",
  name: "Create per-article formula reference decisions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_reference_decisions (
        decision_id TEXT PRIMARY KEY,
        binding_id TEXT NOT NULL,
        post_id TEXT NOT NULL,
        formula_id TEXT NOT NULL,
        bound_revision_id TEXT NOT NULL,
        target_revision_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        resolved_formula_id TEXT,
        resolved_revision_id TEXT,
        actor_user_id INTEGER,
        actor_username TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (bound_revision_id) REFERENCES formula_revisions(revision_id),
        FOREIGN KEY (target_revision_id) REFERENCES formula_revisions(revision_id),
        FOREIGN KEY (resolved_formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (resolved_revision_id) REFERENCES formula_revisions(revision_id),
        CHECK (length(decision_id) BETWEEN 2 AND 96),
        CHECK (decision_id = lower(decision_id)),
        CHECK (decision_id NOT GLOB '*[^a-z0-9._-]*'),
        CHECK (event_type IN ('revision_update', 'card_archive')),
        CHECK (status IN ('pending', 'kept', 'adopted', 'cloned', 'superseded')),
        CHECK (
          (status IN ('pending', 'superseded') AND resolved_at IS NULL) OR
          (status IN ('kept', 'adopted', 'cloned') AND resolved_at IS NOT NULL)
        ),
        CHECK (length(actor_username) <= 120)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_formula_reference_decisions_pending
        ON formula_reference_decisions(binding_id)
        WHERE status = 'pending';

      CREATE INDEX IF NOT EXISTS idx_formula_reference_decisions_post
        ON formula_reference_decisions(post_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_formula_reference_decisions_formula
        ON formula_reference_decisions(formula_id, status, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS formula_reference_decision_revision_owner_insert
      BEFORE INSERT ON formula_reference_decisions
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revisions
            WHERE revision_id = NEW.bound_revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'bound decision revision does not belong to formula')
        END;
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revisions
            WHERE revision_id = NEW.target_revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'target decision revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_reference_decision_resolved_owner_update
      BEFORE UPDATE OF resolved_formula_id, resolved_revision_id ON formula_reference_decisions
      WHEN NEW.resolved_formula_id IS NOT NULL OR NEW.resolved_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NEW.resolved_formula_id IS NULL
            OR NEW.resolved_revision_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM formula_revisions
              WHERE revision_id = NEW.resolved_revision_id
                AND formula_id = NEW.resolved_formula_id
            )
          THEN RAISE(ABORT, 'resolved decision revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_reference_decision_identity_immutable
      BEFORE UPDATE OF decision_id, binding_id, post_id, formula_id,
        bound_revision_id, target_revision_id, event_type, created_at
      ON formula_reference_decisions
      BEGIN
        SELECT RAISE(ABORT, 'formula reference decision identity is immutable');
      END;
    `);
  }
};
