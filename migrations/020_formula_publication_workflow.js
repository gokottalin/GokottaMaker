"use strict";

const crypto = require("crypto");

function normalizedClassificationName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .toLowerCase();
}

function classificationSlug(value) {
  const normalized = normalizedClassificationName(value);
  const ascii = normalized
    .replace(/[·•・:：/／\\_,，、;；]+/g, "-")
    .replace(/['"“”‘’()[\]{}<>《》]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii && ascii.length <= 136 && !/[\u4e00-\u9fff]/u.test(normalized)) return ascii;
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `${ascii.slice(0, 132).replace(/-$/g, "") || "item"}-${digest}`;
}

function classificationId(kind, parentSlug, normalizedName) {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify([kind, parentSlug, normalizedName]))
    .digest("hex")
    .slice(0, 24);
  return `cls.${kind}.${digest}`;
}

module.exports = {
  id: "020_formula_publication_workflow",
  name: "Add formula Markdown revisions, three-state publishing, and classifications",
  up(db) {
    db.exec(`
      ALTER TABLE formula_revisions
        ADD COLUMN markdown_derivation TEXT NOT NULL DEFAULT '';

      ALTER TABLE formula_cards
        ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (publish_status IN ('draft', 'published', 'archived'));

      ALTER TABLE formula_cards
        ADD COLUMN published_revision_id TEXT
        REFERENCES formula_revisions(revision_id);

      ALTER TABLE formula_cards
        ADD COLUMN published_at TEXT;

      UPDATE formula_cards
      SET publish_status = CASE WHEN archived_at IS NULL THEN 'published' ELSE 'archived' END,
          published_revision_id = current_revision_id,
          published_at = CASE WHEN archived_at IS NULL THEN COALESCE(updated_at, CURRENT_TIMESTAMP) ELSE NULL END;

      CREATE TABLE IF NOT EXISTS formula_classifications (
        classification_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        slug TEXT NOT NULL,
        display_name TEXT NOT NULL,
        parent_slug TEXT NOT NULL DEFAULT '',
        normalized_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (kind IN ('module', 'category', 'tag')),
        CHECK (length(slug) BETWEEN 1 AND 160),
        CHECK (slug = lower(slug)),
        CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(display_name) BETWEEN 1 AND 160),
        CHECK (length(parent_slug) <= 160),
        CHECK (length(normalized_name) BETWEEN 1 AND 160),
        UNIQUE (kind, parent_slug, slug),
        UNIQUE (kind, parent_slug, normalized_name)
      );

      CREATE TABLE IF NOT EXISTS formula_revision_publications (
        revision_id TEXT PRIMARY KEY,
        formula_id TEXT NOT NULL,
        actor_user_id INTEGER,
        actor_username TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (revision_id) REFERENCES formula_revisions(revision_id),
        FOREIGN KEY (formula_id) REFERENCES formula_cards(formula_id),
        CHECK (length(actor_username) <= 120)
      );

      INSERT OR IGNORE INTO formula_revision_publications
        (revision_id, formula_id, published_at)
      SELECT published_revision_id, formula_id, COALESCE(published_at, updated_at, CURRENT_TIMESTAMP)
      FROM formula_cards
      WHERE published_revision_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_formula_cards_publication
        ON formula_cards(publish_status, published_revision_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_formula_classifications_lookup
        ON formula_classifications(kind, parent_slug, normalized_name, display_name);

      CREATE INDEX IF NOT EXISTS idx_formula_revision_publications_formula
        ON formula_revision_publications(formula_id, published_at DESC, revision_id);

      CREATE TRIGGER IF NOT EXISTS formula_cards_publish_status_insert
      BEFORE INSERT ON formula_cards
      WHEN NEW.publish_status NOT IN ('draft', 'published', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'invalid formula publish status');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_publish_status_update
      BEFORE UPDATE OF publish_status ON formula_cards
      WHEN NEW.publish_status NOT IN ('draft', 'published', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'invalid formula publish status');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_published_revision_owner
      BEFORE UPDATE OF published_revision_id ON formula_cards
      WHEN NEW.published_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.published_revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'published formula revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_published_state_requires_revision
      BEFORE UPDATE OF publish_status ON formula_cards
      WHEN NEW.publish_status = 'published' AND NEW.published_revision_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'published formula requires a published revision');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revision_publication_owner_insert
      BEFORE INSERT ON formula_revision_publications
      BEGIN
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM formula_revisions
            WHERE revision_id = NEW.revision_id
              AND formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'published formula revision does not belong to formula')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revision_publications_immutable_update
      BEFORE UPDATE ON formula_revision_publications
      BEGIN
        SELECT RAISE(ABORT, 'formula revision publications are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_revision_publications_immutable_delete
      BEFORE DELETE ON formula_revision_publications
      BEGIN
        SELECT RAISE(ABORT, 'formula revision publications are immutable');
      END;
    `);

    const insertClassification = db.prepare(`
      INSERT INTO formula_classifications
        (classification_id, kind, slug, display_name, parent_slug, normalized_name)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `);
    const register = (kind, displayName, parentSlug = "") => {
      const normalizedName = normalizedClassificationName(displayName);
      insertClassification.run(
        classificationId(kind, parentSlug, normalizedName),
        kind,
        classificationSlug(displayName),
        displayName,
        parentSlug,
        normalizedName
      );
    };

    for (const row of db.prepare("SELECT DISTINCT module_key AS moduleKey FROM formula_cards").all()) {
      register("module", row.moduleKey);
    }
    for (const row of db
      .prepare("SELECT DISTINCT module_key AS moduleKey, category_path AS categoryPath FROM formula_cards")
      .all()) {
      register("category", row.categoryPath, row.moduleKey);
    }
    for (const row of db.prepare("SELECT DISTINCT tag_key AS tagKey FROM formula_card_tags").all()) {
      register("tag", row.tagKey);
    }
  }
};
