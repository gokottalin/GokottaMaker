module.exports = {
  id: "001_initial_schema",
  name: "Initial admin, session, post, and project tables",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        csrf_token TEXT,
        FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        category_key TEXT NOT NULL,
        excerpt TEXT,
        cover TEXT,
        markdown TEXT NOT NULL,
        read_time TEXT,
        date TEXT,
        publish_status TEXT NOT NULL DEFAULT 'published',
        featured INTEGER NOT NULL DEFAULT 0,
        featured_order INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        tags TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        status_key TEXT NOT NULL,
        summary TEXT,
        cover TEXT,
        markdown TEXT NOT NULL,
        license TEXT,
        stars INTEGER NOT NULL DEFAULT 0,
        date TEXT,
        visibility_status TEXT NOT NULL DEFAULT 'published',
        featured INTEGER NOT NULL DEFAULT 0,
        featured_order INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        tags TEXT,
        repo_url TEXT,
        bom_url TEXT,
        docs_url TEXT,
        version TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};
