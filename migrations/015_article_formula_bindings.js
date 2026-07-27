"use strict";

module.exports = {
  id: "015_article_formula_bindings",
  name: "Create stable article bindings to immutable formula revisions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS article_formula_bindings (
        binding_id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        formula_id TEXT NOT NULL,
        revision_id TEXT NOT NULL,
        display_mode TEXT NOT NULL DEFAULT 'inline',
        ordinal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (formula_id) REFERENCES formula_cards(formula_id),
        FOREIGN KEY (revision_id) REFERENCES formula_revisions(revision_id),
        CHECK (length(binding_id) BETWEEN 2 AND 96),
        CHECK (binding_id = lower(binding_id)),
        CHECK (binding_id NOT GLOB '*[^a-z0-9._-]*'),
        CHECK (display_mode IN ('inline', 'display')),
        CHECK (ordinal >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_article_formula_bindings_post
        ON article_formula_bindings(post_id, ordinal, binding_id);

      CREATE INDEX IF NOT EXISTS idx_article_formula_bindings_formula
        ON article_formula_bindings(formula_id, revision_id, post_id);

      CREATE TRIGGER IF NOT EXISTS article_formula_binding_revision_owner_insert
      BEFORE INSERT ON article_formula_bindings
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'bound formula revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS article_formula_binding_revision_owner_update
      BEFORE UPDATE OF formula_id, revision_id ON article_formula_bindings
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'bound formula revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS article_formula_binding_identity_immutable
      BEFORE UPDATE OF binding_id, post_id, formula_id, revision_id ON article_formula_bindings
      BEGIN
        SELECT RAISE(ABORT, 'article formula binding identity is immutable');
      END;
    `);
  }
};
