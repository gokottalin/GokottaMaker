function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumn(db, table, name, definition) {
  if (!columnNames(db, table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

module.exports = {
  id: "002_content_management_fields",
  name: "Backfill content management and CSRF columns",
  up(db) {
    addColumn(db, "sessions", "csrf_token", "TEXT");

    addColumn(db, "posts", "publish_status", "TEXT NOT NULL DEFAULT 'published'");
    addColumn(db, "posts", "featured", "INTEGER NOT NULL DEFAULT 0");
    addColumn(db, "posts", "featured_order", "INTEGER NOT NULL DEFAULT 0");
    addColumn(db, "posts", "deleted_at", "TEXT");
    addColumn(db, "posts", "tags", "TEXT");

    addColumn(db, "projects", "visibility_status", "TEXT NOT NULL DEFAULT 'published'");
    addColumn(db, "projects", "featured", "INTEGER NOT NULL DEFAULT 0");
    addColumn(db, "projects", "featured_order", "INTEGER NOT NULL DEFAULT 0");
    addColumn(db, "projects", "deleted_at", "TEXT");
    addColumn(db, "projects", "tags", "TEXT");
    addColumn(db, "projects", "repo_url", "TEXT");
    addColumn(db, "projects", "bom_url", "TEXT");
    addColumn(db, "projects", "docs_url", "TEXT");
    addColumn(db, "projects", "version", "TEXT");
    addColumn(db, "projects", "progress", "INTEGER NOT NULL DEFAULT 0");
  }
};
