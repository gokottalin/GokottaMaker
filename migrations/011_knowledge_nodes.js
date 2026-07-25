module.exports = {
  id: "011_knowledge_nodes",
  name: "Create knowledge node content tables",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        node_type TEXT NOT NULL DEFAULT 'derivation'
          CHECK (node_type IN ('derivation', 'concept', 'component', 'formula')),
        symbol TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        markdown TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        accent_color TEXT NOT NULL DEFAULT 'purple'
          CHECK (accent_color IN ('purple', 'blue', 'green', 'amber', 'red', 'neutral')),
        tags TEXT NOT NULL DEFAULT '',
        publish_status TEXT NOT NULL DEFAULT 'draft'
          CHECK (publish_status IN ('draft', 'published', 'archived')),
        visibility_status TEXT NOT NULL DEFAULT 'public'
          CHECK (visibility_status IN ('public', 'unlisted', 'private')),
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        CHECK (length(id) BETWEEN 2 AND 97),
        CHECK (length(slug) BETWEEN 2 AND 80),
        CHECK (slug = lower(slug)),
        CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(symbol) BETWEEN 1 AND 80),
        CHECK (length(title) BETWEEN 1 AND 160),
        CHECK (length(summary) <= 500),
        CHECK (length(cover) <= 512),
        CHECK (length(tags) <= 800)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_public
        ON knowledge_nodes(deleted_at, publish_status, visibility_status, node_type, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_slug_public
        ON knowledge_nodes(slug, deleted_at, publish_status, visibility_status);

      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_symbol
        ON knowledge_nodes(symbol);

      CREATE TABLE IF NOT EXISTS knowledge_node_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        node_slug TEXT NOT NULL,
        node_title TEXT,
        revision_reason TEXT NOT NULL DEFAULT 'save',
        snapshot_json TEXT NOT NULL,
        source_updated_at TEXT,
        actor_user_id INTEGER,
        actor_username TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_node_revisions_node
        ON knowledge_node_revisions(node_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_knowledge_node_revisions_created_at
        ON knowledge_node_revisions(created_at DESC);
    `);
  }
};
