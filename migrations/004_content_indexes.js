module.exports = {
  id: "004_content_indexes",
  name: "Add content lookup indexes",
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_public ON posts(deleted_at, publish_status, date, updated_at);
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
      CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(deleted_at, visibility_status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
  }
};
