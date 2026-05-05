const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function loadMigrations(root) {
  const migrationsDir = path.join(root, "migrations");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.js$/.test(file))
    .sort()
    .map((file) => require(path.join(migrationsDir, file)));
}

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function runMigrations(db, root) {
  ensureMigrationTable(db);
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
  const migrations = loadMigrations(root);

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    try {
      db.exec("BEGIN");
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(migration.id, migration.name);
      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // The original migration error is more useful than a rollback failure.
      }
      error.message = `Migration ${migration.id} failed: ${error.message}`;
      throw error;
    }
  }
}

function createDatabase({ root, dataDir, dbDir, dbPath, uploadDir }) {
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  runMigrations(db, root);
  return db;
}

module.exports = {
  createDatabase,
  runMigrations
};
