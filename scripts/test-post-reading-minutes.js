"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { createContentStore } = require("../lib/content");
const { validatePostPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const MAX_READING_MINUTES = 9999;

function migrationFiles() {
  return fs
    .readdirSync(path.join(ROOT, "migrations"))
    .filter((file) => /^\d+_.+\.js$/.test(file))
    .sort();
}

function runMigrations(db, predicate = () => true) {
  for (const file of migrationFiles().filter(predicate)) {
    require(path.join(ROOT, "migrations", file)).up(db);
  }
}

function postPayload(overrides = {}) {
  return {
    id: "reading-minutes-post",
    slug: "reading-minutes-post",
    title: "建议阅读时间测试",
    category: "电子基础",
    excerpt: "验证建议阅读时间",
    cover: "./assets/covers/analog-cover.png",
    coverCrop: null,
    markdown: "# Reading minutes",
    readingMinutes: null,
    date: "2026-07-29",
    publishStatus: "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 1,
    tags: "reading-minutes",
    ...overrides
  };
}

async function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-reading-minutes-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.promises.rm(resolved, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function startServer({ port, dataDir }) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USERNAME: "ReadingMinutesTester",
      ADMIN_PASSWORD: "reading-minutes-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  return { child, output: () => output };
}

async function waitForServer(baseUrl, runtime) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (runtime.child.exitCode !== null) throw new Error(`server exited early\n${runtime.output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`server did not start\n${runtime.output()}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function assertMigrationAndStore(tempRoot) {
  const legacyDb = new DatabaseSync(path.join(tempRoot, "legacy.sqlite"));
  runMigrations(legacyDb, (file) => file < "025_post_reading_minutes.js");
  legacyDb.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, read_time, publish_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "legacy-null-post",
    "legacy-null-post",
    "Legacy null post",
    "电子基础",
    "electronics-basics",
    "# Legacy",
    "10 分钟阅读",
    "published"
  );
  require(path.join(ROOT, "migrations", "025_post_reading_minutes.js")).up(legacyDb);
  const legacyRow = legacyDb
    .prepare("SELECT reading_minutes AS readingMinutes, read_time AS readTime FROM posts WHERE id = ?")
    .get("legacy-null-post");
  assert.equal(legacyRow.readingMinutes, null);
  assert.equal(legacyRow.readTime, "10 分钟阅读");
  legacyDb.close();

  const db = new DatabaseSync(path.join(tempRoot, "contract.sqlite"));
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  const store = createContentStore(db);

  for (const value of [undefined, null, ""]) {
    assert.equal(validatePostPayload(postPayload({ readingMinutes: value })).readingMinutes, null);
  }
  for (const value of [1, 6, MAX_READING_MINUTES, "25"]) {
    assert.equal(validatePostPayload(postPayload({ readingMinutes: value })).readingMinutes, Number(value));
  }
  for (const value of [
    0,
    -1,
    1.5,
    MAX_READING_MINUTES + 1,
    "0",
    "-1",
    "1.5",
    "01",
    "1e2",
    "10 分钟",
    "10min",
    "10abc",
    true,
    false,
    [],
    [10],
    {}
  ]) {
    assert.throws(
      () => validatePostPayload(postPayload({ readingMinutes: value })),
      /建议阅读时间必须是 1-9999 的正整数分钟或留空/
    );
  }

  const first = store.savePost(validatePostPayload(postPayload({ readingMinutes: 6 })));
  assert.equal(first.readingMinutes, 6);
  assert.equal(Object.hasOwn(first, "readTime"), false);
  assert.equal(store.allPosts(true).find((post) => post.id === first.id).readingMinutes, 6);
  assert.equal(store.allPosts(false).find((post) => post.id === first.id).readingMinutes, 6);

  store.savePost(validatePostPayload(postPayload({ readingMinutes: 25 })));
  const prior = store.listRevisions("post", first.id).find((revision) => revision.snapshot.readingMinutes === 6);
  assert.ok(prior);
  const restored = store.restoreRevision("post", first.id, prior.id);
  assert.equal(restored.readingMinutes, 6);
  const cleared = store.savePost(validatePostPayload(postPayload({ readingMinutes: null })));
  assert.equal(cleared.readingMinutes, null);

  db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, read_time, publish_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "fresh-seed-compat",
    "fresh-seed-compat",
    "Fresh seed compatibility",
    "电子基础",
    "electronics-basics",
    "# Seed",
    "12 分钟阅读",
    "published"
  );
  const compatible = db
    .prepare("SELECT reading_minutes AS readingMinutes, read_time AS readTime FROM posts WHERE id = ?")
    .get("fresh-seed-compat");
  assert.equal(compatible.readingMinutes, 12);
  assert.equal(compatible.readTime, null);

  const invalidInsert = db.prepare(
    `INSERT INTO posts
      (id, slug, title, category, category_key, markdown, reading_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const value of [0, -1, 1.5, MAX_READING_MINUTES + 1]) {
    assert.throws(
      () => invalidInsert.run(`invalid-${String(value).replace(/\W/g, "-")}`, `invalid-${String(value).replace(/\W/g, "-")}`, "Invalid", "电子基础", "electronics-basics", "#", value),
      /invalid post reading minutes/
    );
  }

  db.close();
}

function assertStaticContracts() {
  const postsSource = fs.readFileSync(path.join(ROOT, "data", "posts.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(postsSource, sandbox);
  const seedPosts = sandbox.window.LARKIX_POSTS;
  assert.ok(seedPosts.every((post) => Number.isInteger(post.readingMinutes) && post.readingMinutes > 0));
  assert.ok(seedPosts.every((post) => post.readTime === post.readingMinutes));
  assert.ok(seedPosts.every((post) => !Object.keys(post).includes("readTime")));
  assert.doesNotMatch(postsSource, /readTime:\s*["']/);

  const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
  const adminSource = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
  const makerHtml = fs.readFileSync(path.join(ROOT, "maker.html"), "utf8");
  const mainSource = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  const categorySource = fs.readFileSync(path.join(ROOT, "category-page.js"), "utf8");
  const postSource = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");

  assert.match(adminHtml, /name="readingMinutes"[\s\S]*min="1"[\s\S]*max="9999"[\s\S]*step="1"/);
  assert.match(adminHtml, /id="readingMinutesHelp">选填，仅接受 1-9999 的正整数/);
  assert.match(adminSource, /setFieldVisible\(readingMinutesField,\s*type === "post"\)/);
  assert.match(adminSource, /readingMinutes:\s*data\.get\("readingMinutes"\)/);
  assert.match(adminSource, /contentForm\.readingMinutes\.value = snapshot\.readingMinutes \?\? ""/);
  assert.match(adminSource, /readingMinutes:\s*rawReadingMinutes \? Number\(rawReadingMinutes\) : null/);
  assert.match(makerHtml, /id="featuredReadTime" hidden><\/span>/);
  assert.match(mainSource, /featuredReadTime\.hidden = !readTime/);
  assert.match(mainSource, /readingMinutesLabel\(post\.readingMinutes\)/);
  assert.match(categorySource, /readingMinutesMeta\(post\)/);
  assert.match(postSource, /primaryMeta\(item\)/);

  for (const source of [adminSource, mainSource, categorySource, postSource, makerHtml]) {
    assert.doesNotMatch(source, /10\s*分钟阅读/);
  }
}

async function assertApiRoundTrip(tempRoot) {
  const dataDir = path.join(tempRoot, "api-data");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtime = startServer({ port, dataDir });
  let cookie = "";
  let csrfToken = "";

  async function request(route, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("json") ? await response.json() : await response.text();
    return { response, payload };
  }

  try {
    await waitForServer(baseUrl, runtime);
    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "ReadingMinutesTester", password: "reading-minutes-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const seededAdmin = await request("/api/admin/content");
    assert.equal(seededAdmin.response.status, 200);
    assert.ok(seededAdmin.payload.posts.every((post) => Object.hasOwn(post, "readingMinutes")));
    assert.ok(seededAdmin.payload.posts.every((post) => !Object.hasOwn(post, "readTime")));

    const fixture = postPayload({ id: "api-reading-minutes", slug: "api-reading-minutes", readingMinutes: 8 });
    const created = await request("/api/posts", { method: "POST", body: JSON.stringify(fixture) });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.posts.find((post) => post.id === fixture.id).readingMinutes, 8);

    const publicSet = await request(`/api/public/posts/${fixture.id}`);
    assert.equal(publicSet.response.status, 200);
    assert.equal(publicSet.payload.post.readingMinutes, 8);
    assert.equal(Object.hasOwn(publicSet.payload.post, "readTime"), false);

    const updated = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({ ...fixture, readingMinutes: 21 })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.posts.find((post) => post.id === fixture.id).readingMinutes, 21);

    const revisions = await request(`/api/posts/${fixture.id}/revisions`);
    assert.equal(revisions.response.status, 200);
    const revision = revisions.payload.revisions.find((entry) => entry.snapshot.readingMinutes === 8);
    assert.ok(revision);
    const restored = await request(`/api/posts/${fixture.id}/revisions/${revision.id}/restore`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.payload.posts.find((post) => post.id === fixture.id).readingMinutes, 8);

    const cleared = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({ ...fixture, readingMinutes: null })
    });
    assert.equal(cleared.response.status, 200);
    assert.equal(cleared.payload.posts.find((post) => post.id === fixture.id).readingMinutes, null);
    const publicCleared = await request(`/api/public/posts/${fixture.id}`);
    assert.equal(publicCleared.payload.post.readingMinutes, null);

    const exported = await request("/api/admin/export");
    assert.equal(exported.response.status, 200);
    assert.equal(exported.payload.posts.find((post) => post.id === fixture.id).readingMinutes, null);

    for (const value of [0, -1, 1.5, "10 分钟", true, [], MAX_READING_MINUTES + 1]) {
      const rejected = await request("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          ...fixture,
          id: `api-invalid-${String(value).replace(/\W/g, "-") || "value"}`,
          slug: `api-invalid-${String(value).replace(/\W/g, "-") || "value"}`,
          readingMinutes: value
        })
      });
      assert.equal(rejected.response.status, 400);
      assert.match(rejected.payload.error, /建议阅读时间必须是 1-9999 的正整数分钟或留空/);
    }
  } finally {
    await stopServer(runtime.child);
  }
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-reading-minutes-"));
  let failure = null;
  try {
    assertMigrationAndStore(tempRoot);
    assertStaticContracts();
    await assertApiRoundTrip(tempRoot);
    console.log("post reading minutes migration, validation, DTO, revision, API, and rendering contracts: ok");
  } catch (error) {
    failure = error;
  } finally {
    try {
      await safeRemoveTemp(tempRoot);
    } catch (cleanupError) {
      if (!failure) throw cleanupError;
    }
  }
  if (failure) throw failure;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
