"use strict";

module.exports = {
  id: "014_formula_catalog",
  name: "Create formula catalog, immutable revisions, and namespaced tags",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_cards (
        formula_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        module_key TEXT NOT NULL,
        category_path TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT '',
        current_revision_id TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (length(formula_id) BETWEEN 2 AND 128),
        CHECK (formula_id = lower(formula_id)),
        CHECK (formula_id NOT GLOB '*[^a-z0-9._-]*'),
        CHECK (length(slug) BETWEEN 2 AND 80),
        CHECK (slug = lower(slug)),
        CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(display_name) BETWEEN 1 AND 160),
        CHECK (length(module_key) BETWEEN 2 AND 64),
        CHECK (module_key = lower(module_key)),
        CHECK (module_key NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(category_path) BETWEEN 1 AND 240),
        CHECK (length(purpose) <= 500)
      );

      CREATE TABLE IF NOT EXISTS formula_revisions (
        revision_id TEXT PRIMARY KEY,
        formula_id TEXT NOT NULL,
        sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
        latex TEXT NOT NULL,
        revision_reason TEXT NOT NULL DEFAULT 'save',
        source_book_id TEXT NOT NULL DEFAULT '',
        source_book_revision TEXT NOT NULL DEFAULT '',
        source_formula_id TEXT NOT NULL DEFAULT '',
        actor_user_id INTEGER,
        actor_username TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formula_id) REFERENCES formula_cards(formula_id),
        UNIQUE (formula_id, sequence_no),
        CHECK (length(revision_id) BETWEEN 2 AND 96),
        CHECK (revision_id = lower(revision_id)),
        CHECK (revision_id NOT GLOB '*[^a-z0-9._-]*'),
        CHECK (length(latex) BETWEEN 1 AND 20000),
        CHECK (length(revision_reason) BETWEEN 1 AND 64),
        CHECK (length(source_book_id) <= 128),
        CHECK (length(source_book_revision) <= 128),
        CHECK (length(source_formula_id) <= 128),
        CHECK (length(actor_username) <= 120)
      );

      CREATE TABLE IF NOT EXISTS formula_card_tags (
        formula_id TEXT NOT NULL,
        tag_key TEXT NOT NULL,
        namespace TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (formula_id, tag_key),
        FOREIGN KEY (formula_id) REFERENCES formula_cards(formula_id) ON DELETE CASCADE,
        CHECK (length(tag_key) BETWEEN 3 AND 97),
        CHECK (length(namespace) BETWEEN 1 AND 32),
        CHECK (namespace = lower(namespace)),
        CHECK (namespace NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(value) BETWEEN 1 AND 64)
      );

      CREATE INDEX IF NOT EXISTS idx_formula_cards_catalog
        ON formula_cards(module_key, category_path, archived_at, display_name, formula_id);

      CREATE INDEX IF NOT EXISTS idx_formula_cards_updated
        ON formula_cards(archived_at, updated_at DESC, formula_id);

      CREATE INDEX IF NOT EXISTS idx_formula_revisions_formula
        ON formula_revisions(formula_id, sequence_no DESC);

      CREATE INDEX IF NOT EXISTS idx_formula_revisions_source
        ON formula_revisions(source_book_id, source_book_revision, source_formula_id);

      CREATE INDEX IF NOT EXISTS idx_formula_card_tags_lookup
        ON formula_card_tags(tag_key, formula_id);

      CREATE TRIGGER IF NOT EXISTS formula_cards_identity_immutable
      BEFORE UPDATE OF formula_id ON formula_cards
      BEGIN
        SELECT RAISE(ABORT, 'formula identity is immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_slug_immutable
      BEFORE UPDATE OF slug ON formula_cards
      BEGIN
        SELECT RAISE(ABORT, 'formula route slug is immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revisions_immutable_update
      BEFORE UPDATE ON formula_revisions
      BEGIN
        SELECT RAISE(ABORT, 'formula revisions are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revisions_immutable_delete
      BEFORE DELETE ON formula_revisions
      BEGIN
        SELECT RAISE(ABORT, 'formula revisions are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_current_revision_owner_insert
      BEFORE INSERT ON formula_cards
      WHEN NEW.current_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.current_revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'current formula revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_current_revision_owner_update
      BEFORE UPDATE OF current_revision_id ON formula_cards
      WHEN NEW.current_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.current_revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'current formula revision does not belong to formula')
        END;
      END;
    `);
  }
};
