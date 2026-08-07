"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "CarouselBufferTester";
const PASSWORD = "carousel-buffer-test-password";

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-carousel-buffer-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
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
      ADMIN_USERNAME: USERNAME,
      ADMIN_PASSWORD: PASSWORD
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

async function waitForServer(baseUrl, child, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early\n${output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`server did not start\n${output()}`);
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

function postFixture(id, category, publishStatus, featuredOrder) {
  return {
    id,
    slug: id,
    type: "post",
    title: `Carousel buffer fixture ${id}`,
    category,
    excerpt: `Persistent buffer fixture ${id}`,
    cover: "./assets/covers/analog-cover.png",
    markdown: `# ${id}\n\nCarousel focus buffer preservation fixture.`,
    readTime: "3 分钟阅读",
    date: "2026-07-27",
    publishStatus,
    featured: true,
    featuredOrder,
    recommendationPriority: 10,
    tags: "fixture, carousel-buffer"
  };
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-carousel-buffer-"));
  const dataDir = path.join(tempRoot, "data");
  const dbPath = path.join(dataDir, "database", "gokottamaker.sqlite");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let runtime = null;
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

  async function login() {
    cookie = "";
    csrfToken = "";
    const result = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    assert.equal(result.response.status, 200);
    csrfToken = result.payload.csrfToken;
  }

  async function restart() {
    await stopServer(runtime?.child);
    runtime = startServer({ port, dataDir });
    await waitForServer(baseUrl, runtime.child, runtime.output);
    cookie = "";
    csrfToken = "";
  }

  try {
    await restart();
    await login();

    const fresh = await request("/api/admin/content");
    assert.equal(fresh.response.status, 200);
    assert.equal(fresh.payload.publicFocusMode.enabled, true);
    assert.equal(fresh.payload.carousel.summary.activeCount, 1);
    assert.equal(fresh.payload.carousel.summary.bufferedCount, 3);
    assert.ok(fresh.payload.carousel.buffered.every((item) => item.bufferedReason === "CAROUSEL_FOCUS_SCOPE_OUTSIDE"));
    const seedBuffers = fresh.payload.carousel.buffered.map((item) => ({ ...item }));

    const disabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.payload.carousel.summary.bufferedCount, 3);
    assert.equal(disabled.payload.carousel.summary.activeCount, 1);

    const allowed = postFixture("carousel-allowed-published", "电子基础", "published", 0);
    const outsidePublished = postFixture("carousel-outside-published", "模拟电子", "published", 1);
    const outsideDraft = postFixture("carousel-outside-draft", "STM32", "draft", 2);
    for (const fixture of [allowed, outsidePublished, outsideDraft]) {
      const saved = await request("/api/posts", { method: "POST", body: JSON.stringify(fixture) });
      assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
    }

    const enabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: true })
    });
    assert.equal(enabled.response.status, 200);
    assert.equal(enabled.payload.carouselReconciliation.bufferedNow, 2);
    assert.equal(enabled.payload.carousel.summary.activeCount, 2);
    assert.equal(enabled.payload.carousel.summary.bufferedCount, 5);
    const publishedBuffer = enabled.payload.carousel.buffered.find((item) => item.contentId === outsidePublished.id);
    const draftBuffer = enabled.payload.carousel.buffered.find((item) => item.contentId === outsideDraft.id);
    assert.ok(publishedBuffer);
    assert.ok(draftBuffer);
    assert.equal(publishedBuffer.contentSlug, outsidePublished.slug);
    assert.equal(publishedBuffer.imageReference, outsidePublished.cover);
    assert.equal(publishedBuffer.originalSlot, 1);
    assert.equal(publishedBuffer.currentPublishStatus, "published");
    assert.equal(draftBuffer.originalSlot, 2);
    assert.equal(draftBuffer.currentPublishStatus, "draft");
    assert.ok(publishedBuffer.bufferedAt);
    assert.ok(publishedBuffer.updatedAt);

    const idempotent = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: true })
    });
    assert.equal(idempotent.response.status, 200);
    assert.equal(idempotent.payload.carouselReconciliation.bufferedNow, 0);
    assert.equal(idempotent.payload.carousel.summary.bufferedCount, 5);

    const blocked = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(publishedBuffer.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 1 }) }
    );
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.payload.reasonCode, "CAROUSEL_RESTORE_BLOCKED_FOCUS_SCOPE_OUTSIDE");

    const disabledAgain = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(disabledAgain.response.status, 200);
    assert.equal(disabledAgain.payload.carousel.summary.activeCount, 2);
    assert.equal(disabledAgain.payload.carousel.summary.bufferedCount, 5);

    const conflict = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(publishedBuffer.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 0 }) }
    );
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.payload.reasonCode, "CAROUSEL_SLOT_CONFLICT");

    const restoredPublished = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(publishedBuffer.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 1 }) }
    );
    assert.equal(restoredPublished.response.status, 200);
    assert.equal(restoredPublished.payload.reasonCode, "CAROUSEL_BUFFER_RESTORED");
    assert.equal(restoredPublished.payload.restored.publishStatus, "published");
    assert.equal(restoredPublished.payload.restored.featuredOrder, 1);

    const restoredDraft = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(draftBuffer.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 2 }) }
    );
    assert.equal(restoredDraft.response.status, 200);
    assert.equal(restoredDraft.payload.restored.publishStatus, "draft");
    const publicAfterRestore = await request("/api/content");
    assert.ok(publicAfterRestore.payload.posts.some((item) => item.id === outsidePublished.id && item.featured));
    assert.ok(Array.isArray(publicAfterRestore.payload.heroCarousel));
    assert.ok(publicAfterRestore.payload.heroCarousel.some((item) => item.id === outsidePublished.id));
    assert.equal(new Set(publicAfterRestore.payload.heroCarousel.map((item) => item.slot)).size, publicAfterRestore.payload.heroCarousel.length);
    assert.equal(publicAfterRestore.payload.posts.some((item) => item.id === outsideDraft.id), false);

    const reenabled = await request("/api/admin/focus-mode", {
      method: "POST",
      body: JSON.stringify({ enabled: true })
    });
    assert.equal(reenabled.response.status, 200);
    assert.equal(reenabled.payload.carouselReconciliation.bufferedNow, 2);
    assert.equal(reenabled.payload.carousel.summary.bufferedCount, 5);

    await stopServer(runtime.child);
    runtime = null;
    const brokenDb = new DatabaseSync(dbPath);
    try {
      brokenDb.exec("PRAGMA foreign_keys = OFF");
      brokenDb.prepare("DELETE FROM posts WHERE id = ?").run(seedBuffers[0].contentId);
      brokenDb.prepare("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(seedBuffers[1].contentId);
    } finally {
      brokenDb.close();
    }

    await restart();
    await login();
    const brokenState = await request("/api/admin/carousel-buffer");
    const missing = brokenState.payload.carousel.buffered.find((item) => item.bufferId === seedBuffers[0].bufferId);
    const archived = brokenState.payload.carousel.buffered.find((item) => item.bufferId === seedBuffers[1].bufferId);
    assert.equal(missing.referenceStatus, "missing");
    assert.equal(missing.restoreReasonCode, "CAROUSEL_REFERENCE_MISSING");
    assert.equal(archived.referenceStatus, "archived");
    assert.equal(archived.restoreReasonCode, "CAROUSEL_REFERENCE_ARCHIVED");

    const missingRestore = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(missing.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 1 }) }
    );
    assert.equal(missingRestore.response.status, 409);
    assert.equal(missingRestore.payload.reasonCode, "CAROUSEL_REFERENCE_MISSING");
    const archivedRestore = await request(
      `/api/admin/carousel-buffer/${encodeURIComponent(archived.bufferId)}/restore`,
      { method: "POST", body: JSON.stringify({ slot: 1 }) }
    );
    assert.equal(archivedRestore.response.status, 409);
    assert.equal(archivedRestore.payload.reasonCode, "CAROUSEL_REFERENCE_ARCHIVED");

    const removed = await request(`/api/admin/carousel-buffer/${encodeURIComponent(missing.bufferId)}`, {
      method: "DELETE"
    });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.payload.reasonCode, "CAROUSEL_BUFFER_REMOVED");

    await stopServer(runtime.child);
    runtime = null;
    const carouselCheck = spawnSync(
      process.execPath,
      ["--experimental-sqlite", path.join(ROOT, "scripts", "check-carousel-db.js"), "--db", dbPath],
      { cwd: ROOT, encoding: "utf8", windowsHide: true }
    );
    assert.equal(carouselCheck.status, 0, carouselCheck.stderr || carouselCheck.stdout);
    const carouselCheckPayload = JSON.parse(carouselCheck.stdout);
    assert.equal(carouselCheckPayload.bufferTablePresent, true);
    assert.equal(carouselCheckPayload.activeBufferCollisions.length, 0);
    assert.equal(carouselCheckPayload.invalidBufferRows.length, 0);
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const preserved = db
        .prepare(
          `SELECT id, title, category, cover, markdown, publish_status AS publishStatus,
                  featured, featured_order AS featuredOrder
           FROM posts WHERE id IN (?, ?, ?)`
        )
        .all(allowed.id, outsidePublished.id, outsideDraft.id);
      assert.equal(preserved.length, 3);
      assert.equal(preserved.find((item) => item.id === outsidePublished.id).publishStatus, "published");
      assert.equal(preserved.find((item) => item.id === outsideDraft.id).publishStatus, "draft");
      assert.equal(preserved.find((item) => item.id === outsidePublished.id).markdown, outsidePublished.markdown);
      assert.equal(preserved.find((item) => item.id === outsidePublished.id).cover, outsidePublished.cover);
      assert.equal(preserved.find((item) => item.id === outsidePublished.id).featured, 0);
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM carousel_focus_buffer
             WHERE content_type = 'post' AND content_id = ?`
          )
          .get(outsidePublished.id).count,
        1
      );
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE id = '019_carousel_focus_buffer'").get().count,
        1
      );
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally {
      db.close();
    }

    const adminHtml = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
    const adminCss = fs.readFileSync(path.join(ROOT, "admin", "admin.css"), "utf8");
    assert.equal((adminHtml.match(/id="carouselBufferList"/g) || []).length, 1);
    assert.match(adminHtml, /关闭聚焦不会自动恢复/);
    assert.match(adminJs, /\/api\/admin\/carousel-buffer\/\$\{encodeURIComponent\(bufferId\)\}\/restore/);
    assert.match(adminJs, /CAROUSEL_FOCUS_SCOPE_OUTSIDE/);
    assert.match(adminJs, /restoreReasonCode/);
    assert.match(adminCss, /@media \(max-width: 720px\)[\s\S]*?\.carousel-buffer-card/);

    console.log(
      "carousel focus buffer checks passed: selective/idempotent buffer, no auto-restore, focused rejection, explicit-slot restore, conflict, broken reference, removal, uniqueness and publication preservation"
    );
  } catch (error) {
    if (runtime) error.message = `${error.message}\nserver output:\n${runtime.output()}`;
    throw error;
  } finally {
    await stopServer(runtime?.child);
    safeRemoveTemp(tempRoot);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
