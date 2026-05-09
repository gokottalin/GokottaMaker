#!/usr/bin/env node
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const dataDir = process.env.DATA_DIR || "/srv/gokottamaker-data";
const dbPath = path.resolve(argValue("--db", process.env.DB_PATH || path.join(dataDir, "database", "gokottamaker.sqlite")));
const db = new DatabaseSync(dbPath, { readOnly: true });

const rows = [
  ...db.prepare(`
    SELECT 'post' AS type, id, title, featured, featured_order AS featuredOrder,
           publish_status AS status, deleted_at AS deletedAt, updated_at AS updatedAt
    FROM posts
    WHERE featured = 1 AND deleted_at IS NULL
  `).all(),
  ...db.prepare(`
    SELECT 'project' AS type, id, title, featured, featured_order AS featuredOrder,
           visibility_status AS status, deleted_at AS deletedAt, updated_at AS updatedAt
    FROM projects
    WHERE featured = 1 AND deleted_at IS NULL
  `).all()
].sort((a, b) => Number(a.featuredOrder || 0) - Number(b.featuredOrder || 0) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));

const bySlot = rows.reduce((map, item) => {
  const slot = String(item.featuredOrder);
  map.set(slot, [...(map.get(slot) || []), item]);
  return map;
}, new Map());
const duplicateSlots = [...bySlot.entries()].filter(([, items]) => items.length > 1).map(([slot]) => slot);
const outOfRange = rows.filter((item) => Number(item.featuredOrder) < 0 || Number(item.featuredOrder) > 3);
const result = {
  ok: rows.length <= 4 && duplicateSlots.length === 0 && outOfRange.length === 0,
  dbPath,
  featuredCount: rows.length,
  duplicateSlots,
  outOfRange: outOfRange.map((item) => `${item.type}:${item.id}:${item.featuredOrder}`),
  items: rows
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 2;
