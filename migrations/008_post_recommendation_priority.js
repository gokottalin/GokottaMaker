function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumn(db, table, name, definition) {
  if (!columnNames(db, table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

module.exports = {
  id: "008_post_recommendation_priority",
  name: "Add post recommendation priority",
  up(db) {
    addColumn(db, "posts", "recommendation_priority", "INTEGER NOT NULL DEFAULT 100");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_recommendation_priority ON posts(category_key, recommendation_priority, date)");
  }
};
