"use strict";

const CONTENT_TABLES = ["posts", "projects", "knowledge_nodes", "formula_cards"];

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumn(db, table, name, definition) {
  if (!columns(db, table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function installIntegerTriggers(db, table, column, minimum, maximum, message) {
  const insertName = `${table}_${column}_validate_insert`;
  const updateName = `${table}_${column}_validate_update`;
  db.exec(`
    DROP TRIGGER IF EXISTS ${insertName};
    DROP TRIGGER IF EXISTS ${updateName};
    CREATE TRIGGER ${insertName}
    BEFORE INSERT ON ${table}
    WHEN NEW.${column} IS NOT NULL AND (
      TYPEOF(NEW.${column}) != 'integer' OR NEW.${column} NOT BETWEEN ${minimum} AND ${maximum}
    )
    BEGIN
      SELECT RAISE(ABORT, '${message}');
    END;
    CREATE TRIGGER ${updateName}
    BEFORE UPDATE OF ${column} ON ${table}
    WHEN NEW.${column} IS NOT NULL AND (
      TYPEOF(NEW.${column}) != 'integer' OR NEW.${column} NOT BETWEEN ${minimum} AND ${maximum}
    )
    BEGIN
      SELECT RAISE(ABORT, '${message}');
    END;
  `);
}

module.exports = {
  id: "029_cross_content_discovery_authority",
  name: "Add cross-content discovery ranking, views, focus slots, and miniapp metadata",
  up(db) {
    for (const table of CONTENT_TABLES) {
      addColumn(db, table, "common_level", "INTEGER DEFAULT 5");
      addColumn(db, table, "view_count", "INTEGER NOT NULL DEFAULT 0");
      installIntegerTriggers(db, table, "common_level", 1, 10, "invalid common level");
      installIntegerTriggers(db, table, "view_count", 0, 9223372036854775807, "invalid view count");
    }
    addColumn(db, "projects", "reading_minutes", "INTEGER");
    installIntegerTriggers(db, "projects", "reading_minutes", 1, 9999, "invalid project reading minutes");

    db.exec(`
      CREATE TABLE IF NOT EXISTS discovery_aux_content (
        content_type TEXT NOT NULL CHECK (content_type IN ('miniapp')),
        content_id TEXT NOT NULL,
        common_level INTEGER DEFAULT 5,
        view_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (content_type, content_id),
        CHECK (common_level IS NULL OR (TYPEOF(common_level) = 'integer' AND common_level BETWEEN 1 AND 10)),
        CHECK (TYPEOF(view_count) = 'integer' AND view_count >= 0)
      );

      CREATE TABLE IF NOT EXISTS homepage_focus_slots (
        slot TEXT PRIMARY KEY CHECK (slot IN ('large', 'small-1', 'small-2')),
        post_id TEXT NOT NULL UNIQUE,
        common_level INTEGER DEFAULT 5,
        assigned_by_user_id INTEGER,
        assigned_by_username TEXT NOT NULL DEFAULT '',
        assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (common_level IS NULL OR (TYPEOF(common_level) = 'integer' AND common_level BETWEEN 1 AND 10))
      );

      INSERT OR IGNORE INTO discovery_aux_content (content_type, content_id, common_level, view_count)
      VALUES ('miniapp', 'md2file', 5, 0);

      CREATE INDEX IF NOT EXISTS idx_posts_discovery
        ON posts(publish_status, deleted_at, common_level DESC, view_count DESC, published_at DESC, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_projects_discovery
        ON projects(visibility_status, deleted_at, common_level DESC, view_count DESC, published_at DESC, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_discovery
        ON knowledge_nodes(publish_status, visibility_status, deleted_at, common_level DESC, view_count DESC, published_at DESC, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_formula_cards_discovery
        ON formula_cards(publish_status, archived_at, common_level DESC, view_count DESC, published_at DESC, formula_id);
      CREATE INDEX IF NOT EXISTS idx_homepage_focus_slots_post
        ON homepage_focus_slots(post_id, slot);
    `);
  }
};
