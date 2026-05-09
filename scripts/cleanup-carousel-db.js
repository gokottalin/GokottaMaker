#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function timestamp() {
  return new Date().toISOString().replace(/:/g, "-").replace(/\..+$/, "").replace("T", "_");
}

function copyIfExists(source, targetDir) {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(targetDir, path.basename(source)));
  }
}

function isPublic(item) {
  return item.status === "published" || item.status === "online";
}

const dataDir = process.env.DATA_DIR || "/srv/gokottamaker-data";
const backupRoot = process.env.BACKUP_ROOT || "/srv/gokottamaker-backups";
const dbPath = path.resolve(argValue("--db", process.env.DB_PATH || path.join(dataDir, "database", "gokottamaker.sqlite")));
const apply = hasFlag("--apply");
const db = new DatabaseSync(dbPath);

let backupDir = null;
if (apply) {
  backupDir = path.join(backupRoot, `carousel-cleanup-${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  copyIfExists(dbPath, backupDir);
  copyIfExists(`${dbPath}-wal`, backupDir);
  copyIfExists(`${dbPath}-shm`, backupDir);
}

const items = [
  ...db.prepare(`
    SELECT 'post' AS type, id, title, featured_order AS featuredOrder,
           publish_status AS status, updated_at AS updatedAt
    FROM posts
    WHERE featured = 1 AND deleted_at IS NULL
  `).all(),
  ...db.prepare(`
    SELECT 'project' AS type, id, title, featured_order AS featuredOrder,
           visibility_status AS status, updated_at AS updatedAt
    FROM projects
    WHERE featured = 1 AND deleted_at IS NULL
  `).all()
];

const sorted = [...items].sort((a, b) => {
  const aOrder = Number(a.featuredOrder);
  const bOrder = Number(b.featuredOrder);
  const aValid = aOrder >= 0 && aOrder <= 3;
  const bValid = bOrder >= 0 && bOrder <= 3;
  if (aValid !== bValid) return aValid ? -1 : 1;
  if (aOrder !== bOrder) return aOrder - bOrder;
  if (isPublic(a) !== isPublic(b)) return isPublic(a) ? -1 : 1;
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
});

const usedSlots = new Set();
const keep = [];
const disable = [];

for (const item of sorted) {
  const order = Number(item.featuredOrder);
  const validSlot = order >= 0 && order <= 3;
  if (validSlot && !usedSlots.has(order) && keep.length < 4) {
    keep.push(item);
    usedSlots.add(order);
  } else {
    disable.push(item);
  }
}

const result = {
  apply,
  dbPath,
  backupDir,
  beforeCount: items.length,
  keep: keep.map((item) => ({ type: item.type, id: item.id, title: item.title, featuredOrder: item.featuredOrder, status: item.status })),
  disable: disable.map((item) => ({ type: item.type, id: item.id, title: item.title, featuredOrder: item.featuredOrder, status: item.status }))
};

if (apply && disable.length) {
  db.exec("BEGIN");
  try {
    const disablePost = db.prepare("UPDATE posts SET featured = 0, featured_order = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    const disableProject = db.prepare("UPDATE projects SET featured = 0, featured_order = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const item of disable) {
      if (item.type === "post") disablePost.run(item.id);
      else disableProject.run(item.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

console.log(JSON.stringify(result, null, 2));
