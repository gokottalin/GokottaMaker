module.exports = {
  id: "007_content_revisions",
  name: "Create content revision history table",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_type TEXT NOT NULL CHECK (content_type IN ('post', 'project')),
        content_id TEXT NOT NULL,
        content_title TEXT,
        revision_reason TEXT NOT NULL DEFAULT 'save',
        snapshot_json TEXT NOT NULL,
        source_updated_at TEXT,
        actor_user_id INTEGER,
        actor_username TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_content_revisions_content
        ON content_revisions(content_type, content_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_content_revisions_created_at
        ON content_revisions(created_at DESC);
    `);
  }
};
