module.exports = {
  id: "012_knowledge_links",
  name: "Create knowledge graph link table",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL
          CHECK (source_type IN ('post', 'project', 'knowledge_node')),
        source_id TEXT NOT NULL,
        source_slug TEXT NOT NULL DEFAULT '',
        target_slug TEXT NOT NULL,
        label TEXT NOT NULL,
        color_token TEXT NOT NULL DEFAULT 'purple'
          CHECK (color_token IN ('purple', 'blue', 'green', 'amber', 'red', 'neutral')),
        link_kind TEXT NOT NULL DEFAULT 'derive'
          CHECK (link_kind IN ('derive', 'reference', 'depends_on')),
        ordinal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (length(source_id) BETWEEN 1 AND 120),
        CHECK (length(source_slug) <= 120),
        CHECK (length(target_slug) BETWEEN 2 AND 80),
        CHECK (target_slug = lower(target_slug)),
        CHECK (target_slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(label) BETWEEN 1 AND 80)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_links_unique_edge
        ON knowledge_links(source_type, source_id, target_slug, link_kind);

      CREATE INDEX IF NOT EXISTS idx_knowledge_links_source
        ON knowledge_links(source_type, source_id, ordinal);

      CREATE INDEX IF NOT EXISTS idx_knowledge_links_target
        ON knowledge_links(target_slug, link_kind);
    `);
  }
};
