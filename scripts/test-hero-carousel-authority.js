"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function migrationFilesThrough(limit) {
  return fs
    .readdirSync(path.join(ROOT, "migrations"))
    .filter((file) => /^\d+_.+\.js$/.test(file))
    .filter((file) => Number(file.slice(0, 3)) <= limit)
    .sort();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-hero-authority-"));
const dbPath = path.join(tempRoot, "authority.sqlite");
const db = new DatabaseSync(dbPath);

try {
  for (const file of migrationFilesThrough(25)) {
    require(path.join(ROOT, "migrations", file)).up(db);
  }

  const insertPost = db.prepare(`
    INSERT INTO posts
      (id, slug, title, category, category_key, markdown, publish_status, featured, featured_order)
    VALUES (?, ?, ?, 'Power', 'power-electronics', '# fixture', 'published', 1, ?)
  `);
  insertPost.run("legacy-a", "legacy-a", "Legacy A", 0);
  insertPost.run("legacy-b", "legacy-b", "Legacy B", 0);
  insertPost.run("legacy-c", "legacy-c", "Legacy C", 1);

  require(path.join(ROOT, "migrations", "026_hero_carousel_slots.js")).up(db);

  const conflicts = db
    .prepare(
      `SELECT slot, content_id AS contentId, reason_code AS reasonCode
       FROM hero_carousel_slot_conflicts
       ORDER BY content_id`
    )
    .all();
  assert.deepEqual(
    conflicts.map((item) => ({ ...item })),
    [
      { slot: 0, contentId: "legacy-a", reasonCode: "LEGACY_SLOT_COLLISION" },
      { slot: 0, contentId: "legacy-b", reasonCode: "LEGACY_SLOT_COLLISION" }
    ]
  );

  const slots = db
    .prepare("SELECT slot, content_type AS contentType, content_id AS contentId FROM hero_carousel_slots")
    .all();
  assert.deepEqual(slots.map((item) => ({ ...item })), [
    { slot: 1, contentType: "post", contentId: "legacy-c" }
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM posts").get().count, 3);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM posts WHERE publish_status = 'published' AND featured = 1").get().count,
    3
  );

  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO hero_carousel_slots
             (slot, content_type, content_id, content_title)
           VALUES (1, 'project', 'project-collision', 'Collision')`
        )
        .run(),
    /constraint/i,
    "one physical slot cannot be claimed across content types"
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO hero_carousel_slots
             (slot, content_type, content_id, content_title)
           VALUES (2, 'post', 'legacy-c', 'Duplicate assignment')`
        )
        .run(),
    /constraint/i,
    "one content item cannot claim multiple slots"
  );
} finally {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const main = read("main.js");
assert.match(main, /const heroCarousel = window\.LarkixContent\.getHeroCarousel\(\)/);
assert.match(main, /featuredItems = heroCarousel/);
assert.doesNotMatch(main, /focusHeroFallback|eligibleFeaturedItems/);
assert.doesNotMatch(main, /function focusRouteItem/);
assert.match(main, /if \(!featured\)[\s\S]*?hero\.hidden = true/);

const maker = read("maker.html");
assert.match(maker, /id="homeHero"[^>]*hidden/);
assert.match(maker, /id="featuredTitle"><\/h1>/);
assert.doesNotMatch(maker, /id="featuredTitle">[^<]+/);

const contentStore = read("data/content-store.js");
assert.match(contentStore, /function getHeroCarousel\(\)/);
assert.match(contentStore, /LARKIX_SERVER_CONTENT\?\.heroCarousel/);

const server = read("server.js");
assert.match(server, /heroCarousel:\s*publicCarouselItems\(\)/);
assert.match(server, /reasonCode = "CAROUSEL_SLOT_CONFLICT"/);

const adminHtml = read("admin/index.html");
assert.equal((adminHtml.match(/id="focusModeToggle"/g) || []).length, 1);
assert.match(adminHtml, /data-admin-view="layout"[\s\S]*id="focusModeToggle"/);
assert.match(adminHtml, /id="carouselConflictReport"/);

const adminJs = read("admin/admin.js");
assert.doesNotMatch(adminJs, /replace-featured-slot/);
assert.match(adminJs, /serverContent\.carousel\?\.activeItems/);
assert.match(adminJs, /CAROUSEL_SLOT_CONFLICT|reasonCode/);

console.log("Hero carousel authority checks passed.");
