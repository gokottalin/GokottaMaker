module.exports = {
  id: "006_taxonomy_tables",
  name: "Create category and tag taxonomy tables",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        post_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (project_id, tag_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO categories (name, slug, description) VALUES
        ('模拟电子', 'analog', '模拟电路、信号链、滤波与运放实践'),
        ('STM32', 'stm32', 'STM32 外设、驱动、采样与工程实践'),
        ('ESP32', 'esp32', 'ESP32 联网、低功耗与物联网节点'),
        ('开源项目', 'projects', '开源硬件项目、BOM、固件与复现记录');

      CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
      CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    `);
  }
};
