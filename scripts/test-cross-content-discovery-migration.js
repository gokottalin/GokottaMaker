"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { commonLevelValue } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function removeTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  assert.ok(resolved.startsWith(`${tempRoot}${path.sep}`));
  assert.ok(path.basename(resolved).startsWith("larkix-discovery-migration-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function runLegacyUpgrade(tempRoot) {
  const dbPath = path.join(tempRoot, "legacy.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  const migrations = fs.readdirSync(path.join(ROOT, "migrations"))
    .filter((file) => /^\d+_.+\.js$/.test(file) && !file.startsWith("029_"))
    .sort()
    .map((file) => require(path.join(ROOT, "migrations", file)));
  for (const migration of migrations) migration.up(db);
  db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, publish_status, featured, featured_order)
     VALUES ('legacy-post', 'legacy-post', 'Legacy', '电子基础', 'electronics-basics', '# legacy', 'published', 0, 0)`
  ).run();
  const migration = require("../migrations/029_cross_content_discovery_authority");
  migration.up(db);
  migration.up(db);
  assert.equal(db.prepare("SELECT common_level AS level, view_count AS views FROM posts WHERE id = 'legacy-post'").get().level, 5);
  assert.equal(db.prepare("SELECT common_level AS level, view_count AS views FROM posts WHERE id = 'legacy-post'").get().views, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM homepage_focus_slots").get().count, 0);
  assert.equal(db.prepare("SELECT common_level AS level FROM discovery_aux_content WHERE content_id = 'md2file'").get().level, 5);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  db.close();
}

function runEmptyAndNullCompatibility(tempRoot) {
  const dataDir = path.join(tempRoot, "empty");
  const dbDir = path.join(dataDir, "database");
  const dbPath = path.join(dbDir, "gokottamaker.sqlite");
  const options = { root: ROOT, dataDir, dbDir, dbPath, uploadDir: path.join(dataDir, "uploads") };
  let db = createDatabase(options);
  db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, publish_status, featured, featured_order, common_level)
     VALUES ('null-level', 'null-level', 'Null level', '电子基础', 'electronics-basics', '# null', 'published', 0, 0, NULL)`
  ).run();
  const store = createContentStore(db);
  assert.equal(store.postById("null-level").commonLevel, 5);
  assert.equal(commonLevelValue(null), 1);
  assert.equal(commonLevelValue(undefined), undefined);
  store.setCommonLevel("article", "null-level", commonLevelValue(null));
  assert.equal(store.postById("null-level").commonLevel, 1);
  db.close();
  db = createDatabase(options);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE id = '029_cross_content_discovery_authority'").get().count, 1);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  db.close();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-discovery-migration-"));
try {
  runLegacyUpgrade(tempRoot);
  runEmptyAndNullCompatibility(tempRoot);
  console.log("cross-content discovery migration checks passed: legacy/empty/idempotent/default/null-clear/integrity");
} finally {
  removeTemp(tempRoot);
}
