"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const {
  validateFormulaCardPayload,
  validateKnowledgeNodePayload,
  validatePostPayload,
  validateProjectPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "DiscoveryAuthorityTester";
const PASSWORD = "discovery-authority-test-password";
const PRIVATE_PATH = `Discovery_${crypto.randomBytes(36).toString("base64url")}`;

function removeTemp(target) {
  const resolved = path.resolve(target);
  assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`));
  assert.ok(path.basename(resolved).startsWith("larkix-discovery-authority-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startServer(dataDir, port) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_USERNAME: USERNAME,
      ADMIN_PASSWORD: PASSWORD,
      PRIVATE_CMS_PATH: PRIVATE_PATH,
      ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  return { child, output: () => output };
}

async function waitForServer(base, handle) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (handle.child.exitCode !== null) throw new Error(handle.output());
    try {
      if ((await fetch(`${base}/healthz`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${handle.output()}`);
}

async function stopServer(handle) {
  if (!handle || handle.child.exitCode !== null) return;
  handle.child.kill();
  await new Promise((resolve) => {
    handle.child.once("exit", resolve);
    setTimeout(resolve, 2000).unref();
  });
}

function post(id, title, overrides = {}) {
  return validatePostPayload({
    id,
    slug: id,
    title,
    category: "电子基础",
    excerpt: `${title} 摘要`,
    markdown: `# ${title}\n\n公开正文。`,
    cover: "./assets/covers/analog-cover.png",
    readingMinutes: 10,
    date: "2026-09-13",
    publishStatus: "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 50,
    commonLevel: 5,
    tags: "module:power-electronics, keyword:alpha",
    ...overrides
  });
}

function project(id, title, overrides = {}) {
  return validateProjectPayload({
    id,
    slug: id,
    title,
    statusKey: "online",
    summary: `${title} 摘要`,
    cover: "./assets/covers/project-cover.png",
    markdown: `# ${title}`,
    readingMinutes: 30,
    date: "2026-09-13",
    visibilityStatus: "published",
    featured: false,
    featuredOrder: 0,
    commonLevel: 5,
    tags: "category:tool, module:maker",
    ...overrides
  });
}

function node(id, title, overrides = {}) {
  return validateKnowledgeNodePayload({
    id,
    slug: id,
    nodeType: "derivation",
    symbol: `S_${id}`,
    title,
    summary: `${title} 摘要`,
    markdown: `# ${title}\n\n推导正文。`,
    cover: "",
    accentColor: "purple",
    tags: "module:power-electronics, keyword:derive",
    publishStatus: "published",
    visibilityStatus: "public",
    commonLevel: 5,
    ...overrides
  });
}

function formula(id, overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: `formula.discovery.${id}`,
    slug: `discovery-${id}`,
    displayName: `公式 ${id}`,
    moduleKey: "power-electronics",
    categoryPath: "变换器/基础",
    purpose: "公开发现验收",
    tags: ["scope:discovery", `keyword:${id}`],
    latex: `V_{${id}}=1`,
    markdownDerivation: "",
    revisionReason: "discovery-authority-test",
    commonLevel: 5,
    ...overrides
  });
}

async function responseJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { text }; }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-discovery-authority-"));
  const dbDir = path.join(tempRoot, "database");
  const uploadDir = path.join(tempRoot, "uploads");
  let handle;
  try {
    const db = createDatabase({
      root: ROOT,
      dataDir: tempRoot,
      dbDir,
      dbPath: path.join(dbDir, "gokottamaker.sqlite"),
      uploadDir
    });
    const store = createContentStore(db);
    store.savePost(post("article-a", "Alpha Article", { commonLevel: 9, readingMinutes: 8 }));
    store.savePost(post("article-b", "Beta Article", { commonLevel: 9, readingMinutes: 20 }));
    store.savePost(post("article-c", "Gamma Article", { commonLevel: 4, readingMinutes: 40 }));
    store.savePost(post("article-secret", "Secret Draft", { publishStatus: "draft", commonLevel: 10 }));
    store.saveProject(project("project-public", "Public Maker Project", { commonLevel: 8 }));
    store.saveProject(project("project-secret", "Secret Draft Project", { visibilityStatus: "draft", commonLevel: 10 }));
    store.saveKnowledgeNode(node("derivation-public", "Public Derivation", { cover: "/uploads/public.png", commonLevel: 7 }));
    store.saveKnowledgeNode(node("derivation-secret", "Secret Draft Derivation", { cover: "/uploads/draft.png", publishStatus: "draft", commonLevel: 10 }));
    const publicFormula = store.saveFormulaCard(formula("public", { commonLevel: 6 }));
    store.publishFormulaCard(publicFormula.card.formulaId);
    store.saveFormulaCard(formula("public", { displayName: "Pending Secret Name", latex: "V_{pending}=2", commonLevel: 6 }));
    const draftFormula = store.saveFormulaCard(formula("draft", { displayName: "Secret Draft Formula", commonLevel: 10 }));
    assert.ok(draftFormula.card.formulaId);
    for (let index = 0; index < 9; index += 1) {
      const saved = store.saveFormulaCard(formula(`latest-${index}`, { displayName: `Latest ${index}` }));
      store.publishFormulaCard(saved.card.formulaId);
    }
    const continuationCards = [];
    let continuationTarget = "";
    for (let index = 244; index >= 0; index -= 1) {
      const saved = store.saveFormulaCard(formula(`continuation-${String(index).padStart(3, "0")}`, {
        markdownDerivation: continuationTarget ? `{{formula-ref:${continuationTarget}}}` : ""
      }));
      continuationCards.push(saved.card);
      continuationTarget = saved.card.formulaId;
    }
    for (const card of continuationCards) {
      store.publishFormulaCard(card.formulaId);
    }
    db.prepare("UPDATE posts SET published_at = '2026-09-10T00:00:00Z', updated_at = '2026-09-10T00:00:00Z' WHERE id = 'article-a'").run();
    db.prepare("UPDATE posts SET published_at = '2026-09-12T00:00:00Z', updated_at = '2026-09-12T00:00:00Z' WHERE id = 'article-b'").run();
    db.prepare("UPDATE posts SET published_at = '2026-09-13T00:00:00Z', updated_at = '2026-09-13T00:00:00Z' WHERE id = 'article-c'").run();
    fs.writeFileSync(path.join(uploadDir, "public.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    fs.writeFileSync(path.join(uploadDir, "draft.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    fs.writeFileSync(path.join(uploadDir, "replacement.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    db.close();

    const port = await availablePort();
    const base = `http://127.0.0.1:${port}`;
    handle = startServer(tempRoot, port);
    await waitForServer(base, handle);

    const search = async (query) => {
      const response = await fetch(`${base}/api/public/search?${query}`);
      const payload = await responseJson(response);
      assert.equal(response.status, 200, JSON.stringify(payload));
      assert.doesNotMatch(JSON.stringify(payload), /commonLevel|common_level|Secret Draft|Pending Secret/);
      return payload;
    };
    const articles = await search("type=article&sort=comprehensive&pageSize=2&page=1");
    assert.deepEqual(articles.items.map((item) => item.id), ["article-b", "article-a"]);
    assert.equal(articles.pagination.total, 3);
    const articlePage2 = await search("type=article&sort=comprehensive&pageSize=2&page=2");
    assert.deepEqual(articlePage2.items.map((item) => item.id), ["article-c"]);
    for (const page of [1, 2]) {
      const fractionalPageSize = await fetch(`${base}/api/public/search?type=article&pageSize=1.5&page=${page}`);
      assert.equal(fractionalPageSize.status, 400);
    }
    assert.deepEqual((await search("type=article&q=A")).items.map((item) => item.id), ["article-b", "article-a", "article-c"]);
    assert.deepEqual((await search("type=article&durationMin=9&durationMax=25")).items.map((item) => item.id), ["article-b"]);
    assert.equal((await search("type=project&q=maker")).items.length, 1);
    assert.equal((await search("type=derivation&q=derive")).items.length, 1);
    const formulaById = await search("type=formula&q=formula.discovery.public");
    assert.equal(formulaById.items[0].formulaId, "formula.discovery.public");
    assert.equal(formulaById.items[0].formulaRef, "{{formula-ref:formula.discovery.public}}");
    assert.equal(formulaById.items[0].name, "公式 public");
    assert.equal("markdownDerivation" in formulaById.items[0], false);
    assert.equal((await search("type=miniapp&q=md2")).items[0].id, "md2file");
    const invalidDuration = await fetch(`${base}/api/public/search?type=formula&durationMin=1`);
    assert.equal(invalidDuration.status, 400);

    const firstFormulaOpen = await fetch(`${base}/api/formulas/discovery-continuation-000`);
    const firstFormulaPayload = await responseJson(firstFormulaOpen);
    assert.equal(firstFormulaOpen.status, 200, JSON.stringify(firstFormulaPayload));
    assert.equal(firstFormulaPayload.card.viewCount, 1);
    assert.equal(firstFormulaPayload.card.graph.truncated, true);
    assert.ok(firstFormulaPayload.card.graph.continuation?.cursor);
    const continuationOpen = await fetch(`${base}/api/formulas/discovery-continuation-000?cursor=${encodeURIComponent(firstFormulaPayload.card.graph.continuation.cursor)}`);
    const continuationPayload = await responseJson(continuationOpen);
    assert.equal(continuationOpen.status, 200, JSON.stringify(continuationPayload));
    assert.equal(continuationPayload.card.viewCount, 1);
    const refreshedFormulaPayload = await responseJson(await fetch(`${base}/api/formulas/discovery-continuation-000`));
    assert.equal(refreshedFormulaPayload.card.viewCount, 2);

    const concurrent = await Promise.all(Array.from({ length: 24 }, () => fetch(`${base}/api/public/posts/article-a`).then(responseJson)));
    assert.equal(Math.max(...concurrent.map((payload) => payload.post.viewCount)), 24);
    assert.equal((await responseJson(await fetch(`${base}/api/public/posts/article-a`, { headers: { "X-Larkix-Automation": "1" } }))).post.viewCount, 24);
    assert.equal((await responseJson(await fetch(`${base}/api/public/posts/article-a?preview=1`))).post.viewCount, 24);
    assert.equal((await fetch(`${base}/api/public/posts/article-secret`)).status, 404);
    for (const route of [
      "/api/public/projects/project-public",
      "/api/knowledge-nodes/derivation-public",
      "/api/formulas/discovery-public",
      "/api/public/miniapps/md2file"
    ]) {
      const response = await fetch(`${base}${route}`);
      const payload = await responseJson(response);
      assert.equal(response.status, 200, JSON.stringify(payload));
      assert.doesNotMatch(JSON.stringify(payload), /commonLevel|common_level/);
    }

    assert.equal((await fetch(`${base}/uploads/public.png`)).status, 200);
    assert.equal((await fetch(`${base}/uploads/draft.png`)).status, 404);
    assert.equal((await fetch(`${base}/uploads/replacement.png`)).status, 404);

    const session = {};
    const cms = async (route, options = {}) => {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      if (session.cookie) headers.Cookie = session.cookie;
      if (session.csrf && !["GET", "HEAD"].includes(options.method || "GET")) headers["X-CSRF-Token"] = session.csrf;
      const response = await fetch(`${base}/${PRIVATE_PATH}${route}`, { ...options, headers });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) session.cookie = setCookie.split(";")[0];
      const payload = await responseJson(response);
      return { response, payload };
    };
    const login = await cms("/api/login", { method: "POST", body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
    assert.equal(login.response.status, 200);
    session.csrf = login.payload.csrfToken;
    const privateReplacementPreview = await fetch(`${base}/${PRIVATE_PATH}/uploads/replacement.png`, {
      headers: { Cookie: session.cookie }
    });
    assert.equal(privateReplacementPreview.status, 200);
    const replaceCover = await cms("/api/admin/knowledge-nodes", {
      method: "POST",
      body: JSON.stringify(node("derivation-public", "Public Derivation", { cover: "/uploads/replacement.png", commonLevel: 7 }))
    });
    assert.equal(replaceCover.response.status, 200, JSON.stringify(replaceCover.payload));
    assert.equal((await fetch(`${base}/uploads/replacement.png`)).status, 200);
    assert.equal((await fetch(`${base}/uploads/public.png`)).status, 404);
    const removeCover = await cms("/api/admin/knowledge-nodes", {
      method: "POST",
      body: JSON.stringify(node("derivation-public", "Public Derivation", { cover: "", commonLevel: 7 }))
    });
    assert.equal(removeCover.response.status, 200, JSON.stringify(removeCover.payload));
    assert.equal((await fetch(`${base}/uploads/replacement.png`)).status, 404);
    const focus = await cms("/api/admin/homepage-focus", {
      method: "POST",
      body: JSON.stringify({ slots: [
        { slot: "large", postId: "article-a" },
        { slot: "small-1", postId: "article-b", commonLevel: 8 },
        { slot: "small-2", postId: "article-c", commonLevel: null }
      ] })
    });
    assert.equal(focus.response.status, 200, JSON.stringify(focus.payload));
    assert.equal(focus.payload.homepageFocus.complete, true);
    assert.deepEqual(focus.payload.homepageFocus.slots.map((item) => item.commonLevel), [5, 8, 1]);
    for (const [contentType, contentId, commonLevel] of [
      ["article", "article-a", 10],
      ["project", "project-public", 9],
      ["derivation", "derivation-public", 8],
      ["formula", "formula.discovery.public", 7],
      ["miniapp", "md2file", 6],
      ["focus", "large", 4]
    ]) {
      const saved = await cms("/api/admin/discovery/common-level", {
        method: "POST",
        body: JSON.stringify({ contentType, contentId, commonLevel })
      });
      assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
      assert.equal(saved.payload.commonLevel, commonLevel);
    }
    const adminDiscovery = await cms("/api/admin/discovery");
    assert.equal(adminDiscovery.response.status, 200);
    assert.equal(adminDiscovery.payload.posts.find((item) => item.id === "article-a").commonLevel, 10);
    assert.equal(adminDiscovery.payload.formulas.find((item) => item.formulaId === "formula.discovery.public").commonLevel, 7);
    assert.equal(adminDiscovery.payload.miniapps.find((item) => item.id === "md2file").commonLevel, 6);

    const privateDetail = await cms("/api/public/posts/article-a");
    assert.equal(privateDetail.payload.post.viewCount, 24);
    const home = await responseJson(await fetch(`${base}/api/public/home-discovery`));
    assert.equal(home.latestFormulas.length, 8);
    assert.equal(home.focusedArticles.length, 3);
    assert.doesNotMatch(JSON.stringify(home), /commonLevel|Pending Secret|Secret Draft/);

    const liveDb = createDatabase({
      root: ROOT,
      dataDir: tempRoot,
      dbDir,
      dbPath: path.join(dbDir, "gokottamaker.sqlite"),
      uploadDir
    });
    liveDb.prepare("UPDATE posts SET publish_status = 'draft' WHERE id = 'article-b'").run();
    liveDb.close();
    const changedHome = await responseJson(await fetch(`${base}/api/public/home-discovery`));
    assert.equal(changedHome.focusedArticles.some((item) => item.postId === "article-b"), false);
    const changedAdmin = await cms("/api/admin/homepage-focus");
    assert.equal(changedAdmin.payload.homepageFocus.complete, false);
    assert.deepEqual(changedAdmin.payload.homepageFocus.missingSlots, ["small-1"]);
    assert.equal((await fetch(`${base}/uploads/draft.png`)).status, 404);

    console.log("cross-content discovery authority checks passed: public-first search/ranking/pagination/privacy, five-type atomic views, six-type CMS levels, formula projection, focus slots, homepage and upload boundary");
  } finally {
    await stopServer(handle);
    removeTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
