function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumn(db, table, name, definition) {
  if (!columnNames(db, table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

module.exports = {
  id: "005_content_time_fields",
  name: "Add created and published timestamps to content tables",
  up(db) {
    addColumn(db, "posts", "created_at", "TEXT");
    addColumn(db, "posts", "published_at", "TEXT");
    addColumn(db, "projects", "created_at", "TEXT");
    addColumn(db, "projects", "published_at", "TEXT");

    db.exec(`
      UPDATE posts
      SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
          published_at = CASE
            WHEN publish_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP)
            ELSE published_at
          END;

      UPDATE projects
      SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
          published_at = CASE
            WHEN visibility_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP)
            ELSE published_at
          END;
    `);
  }
};
