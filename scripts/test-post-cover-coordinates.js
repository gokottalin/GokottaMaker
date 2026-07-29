const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { createContentStore } = require("../lib/content");
const { validateCoverCrop, validatePostPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-post-cover-"));
const dataDir = path.join(tempRoot, "data");
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
let db;

function runMigrations(db) {
  const files = fs
    .readdirSync(path.join(ROOT, "migrations"))
    .filter((file) => /^\d+_.+\.js$/.test(file))
    .sort();
  for (const file of files) require(path.join(ROOT, "migrations", file)).up(db);
}

function postPayload(overrides = {}) {
  return {
    id: "cover-coordinate-post",
    slug: "cover-coordinate-post",
    title: "封面坐标测试",
    category: "电力电子",
    excerpt: "验证封面坐标",
    cover: "./uploads/original-cover.png",
    coverCrop: null,
    markdown: "# Test",
    publishStatus: "draft",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 1,
    tags: "test",
    ...overrides
  };
}

function expectValidationFailure(value, pattern) {
  assert.throws(() => validateCoverCrop(value), pattern);
}

function assertPublicCropLayout(media, crop, viewportWidth, viewportHeight) {
  const layout = media.cropLayout(crop, viewportWidth, viewportHeight);
  assert.ok(layout.width > 0 && layout.height > 0);
  assert.ok(Math.abs(layout.width / layout.height - crop.sourceWidth / crop.sourceHeight) < 1e-9);
  const selectedLeft = layout.left + crop.x * layout.width;
  const selectedTop = layout.top + crop.y * layout.height;
  const selectedRight = selectedLeft + crop.width * layout.width;
  const selectedBottom = selectedTop + crop.height * layout.height;
  assert.ok(selectedLeft <= 0.000001);
  assert.ok(selectedTop <= 0.000001);
  assert.ok(selectedRight >= viewportWidth - 0.000001);
  assert.ok(selectedBottom >= viewportHeight - 0.000001);
}

try {
  db = new DatabaseSync(path.join(dataDir, "content.sqlite"));
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  const store = createContentStore(db);
  const crop = {
    x: 0.125,
    y: 0.25,
    width: 0.75,
    height: 0.421875,
    sourceWidth: 1920,
    sourceHeight: 1920
  };

  assert.deepEqual(validateCoverCrop(crop), crop);
  assert.equal(validateCoverCrop(null), null);
  expectValidationFailure({ ...crop, sourceHeight: null }, /同时包含/);
  expectValidationFailure({ ...crop, x: Number.NaN }, /有限数值/);
  expectValidationFailure({ ...crop, x: 0.5, width: 0.75 }, /边界/);
  expectValidationFailure({ ...crop, height: 0.5 }, /16:9/);

  const saved = store.savePost(validatePostPayload(postPayload({ coverCrop: crop })));
  assert.deepEqual(saved.coverCrop, crop);
  assert.equal(saved.cover, "./uploads/original-cover.png");

  const oldPost = store.savePost(validatePostPayload(postPayload({
    id: "old-post",
    slug: "old-post",
    cover: "./uploads/old-original.png",
    coverCrop: null
  })));
  assert.equal(oldPost.coverCrop, null);

  const revisions = store.listRevisions("post", saved.id);
  assert.equal(revisions.length, 0);
  const adjusted = { ...crop, x: 0.2, width: 0.6, height: 0.3375 };
  store.savePost(validatePostPayload(postPayload({ coverCrop: adjusted })));
  const previous = store.listRevisions("post", saved.id)[0];
  assert.deepEqual(previous.snapshot.coverCrop, crop);
  store.restoreRevision("post", saved.id, previous.id);
  assert.deepEqual(store.postById(saved.id).coverCrop, crop);
  assert.equal(store.postById(saved.id).cover, "./uploads/original-cover.png");

  const reset = store.savePost(validatePostPayload(postPayload({ coverCrop: null })));
  assert.equal(reset.coverCrop, null);
  assert.equal(reset.cover, "./uploads/original-cover.png");

  const invalidInsert = db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, cover_crop_x)
     VALUES ('invalid-crop', 'invalid-crop', 'Invalid', '电力电子', 'power-electronics', '#', 0.1)`
  );
  assert.throws(() => invalidInsert.run(), /invalid post cover crop coordinates/);
  const cropColumns = db
    .prepare("PRAGMA table_info(posts)")
    .all()
    .filter((column) => column.name.startsWith("cover_crop_"));
  assert.equal(cropColumns.length, 6);

  const adminSource = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
  const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
  const mediaSource = fs.readFileSync(path.join(ROOT, "data", "media.js"), "utf8");
  assert.doesNotMatch(adminSource, /canvas\.toDataURL|toDataURL\s*\(/);
  assert.doesNotMatch(adminSource, /-cover\.jpg|uploadCroppedCover/);
  assert.match(adminSource, /coverCrop:\s*currentCoverCrop/);
  assert.match(adminSource, /coverCrop:\s*item\.coverCrop/);
  assert.match(adminSource, /crop:\s*snapshot\.coverCrop/);
  assert.match(adminSource, /pointerdown/);
  assert.match(adminSource, /pointercancel/);
  assert.match(adminSource, /ArrowLeft/);
  assert.match(adminSource, /event\.key === "Escape"/);
  assert.equal((adminHtml.match(/data-crop-corner=/g) || []).length, 4);
  assert.doesNotMatch(adminHtml, /coverCropCanvas|coverCropZoom|coverCropX|coverCropY/);

  const mediaSandbox = { window: {} };
  vm.createContext(mediaSandbox);
  vm.runInContext(mediaSource, mediaSandbox);
  const media = mediaSandbox.window.LarkixMedia;
  const fixtures = [
    { x: 0, y: 0, width: 1, height: 1, sourceWidth: 1920, sourceHeight: 1080 },
    { x: 0, y: 0.341796875, width: 1, height: 0.31640625, sourceWidth: 1080, sourceHeight: 1920 },
    { x: 0, y: 0.21875, width: 1, height: 0.5625, sourceWidth: 1200, sourceHeight: 1200 },
    { x: 0.25, y: 0, width: 0.5, height: 1, sourceWidth: 3840, sourceHeight: 1080 }
  ];
  fixtures.forEach((fixture) => {
    assert.deepEqual(JSON.parse(JSON.stringify(media.normalizeCrop(fixture))), fixture);
    assertPublicCropLayout(media, fixture, 1280, 720);
    assertPublicCropLayout(media, fixture, 640, 360);
    assertPublicCropLayout(media, fixture, 360, 240);
  });
  const optimizedCrop = { x: 0, y: 0.078125, width: 1, height: 0.84375, sourceWidth: 768, sourceHeight: 512 };
  const optimizedMarkup = media.image("./assets/covers/analog-cover.png", "测试封面", { crop: optimizedCrop });
  assert.match(optimizedMarkup, /class="larkix-cover-crop"/);
  assert.match(optimizedMarkup, /<source type="image\/webp"/);
  assert.match(optimizedMarkup, /data-cover-source-width="768"/);
  assert.doesNotMatch(media.image("./uploads/original.png", "旧文章", { crop: null }), /data-cover-crop/);

  for (const file of ["main.js", "category-page.js", "post.js"]) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(source, /crop:\s*(?:post|featured|item)\.coverCrop/);
  }
  db.close();
  db = null;
  console.log("post cover coordinate data contract: ok");
} finally {
  if (db) db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}
