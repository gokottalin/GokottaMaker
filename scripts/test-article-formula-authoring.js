"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { createContentStore, formulaBindingShortcode } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  validateFormulaCardPayload,
  validateFormulaReferenceShortcodes,
  validateLatexSelection,
  validatePostPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-article-formula-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function openStore(dataDir) {
  const dbDir = path.join(dataDir, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir,
    dbDir,
    dbPath: path.join(dbDir, "gokottamaker.sqlite"),
    uploadDir: path.join(dataDir, "uploads")
  });
  return { db, store: createContentStore(db) };
}

function postPayload(overrides = {}) {
  return validatePostPayload({
    id: "article-formula-test",
    slug: "article-formula-test",
    title: "文章公式绑定测试",
    category: "模拟电子",
    excerpt: "隔离验证",
    markdown: "普通行内公式 $V_{out}=12\\,\\mathrm{V}$ 与块级公式：\n\n$$\nI=\\frac{V}{R}\n$$",
    cover: "./assets/covers/analog-cover.png",
    publishStatus: "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 100,
    tags: "公式测试",
    ...overrides
  });
}

function cardPayload(overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: "formula.test.output-voltage",
    slug: "test-output-voltage",
    displayName: "测试输出电压",
    moduleKey: "power-electronics",
    categoryPath: "文章公式/测试",
    purpose: "验证文章公式绑定",
    tags: ["module:power-electronics", "unit:V"],
    latex: "V_{out}=12\\,\\mathrm{V}",
    revisionReason: "article-test",
    ...overrides
  });
}

function loadRenderer() {
  const source = fs.readFileSync(path.join(ROOT, "data/markdown-renderer.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LarkixMarkdown;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`article formula server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("article formula server did not become healthy");
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

async function apiChecks(tempRoot) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = path.join(tempRoot, "api-data");
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      FORMULA_BACKUP_DIR: path.join(tempRoot, "api-backups"),
      ADMIN_USERNAME: "ArticleFormulaTester",
      ADMIN_PASSWORD: "article-formula-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });

  let cookie = "";
  let csrfToken = "";
  async function request(route, options = {}) {
    const method = options.method || "GET";
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (!["GET", "HEAD"].includes(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    await waitForServer(baseUrl, child);
    const login = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "ArticleFormulaTester", password: "article-formula-test-password" })
    });
    assert.equal(login.response.status, 200);
    csrfToken = login.payload.csrfToken;

    const card = cardPayload();
    const createdCard = await request("/api/admin/formulas", { method: "POST", body: JSON.stringify(card) });
    assert.equal(createdCard.response.status, 200);
    const currentRevisionId = createdCard.payload.card.currentRevisionId;
    const publishedCard = await request(`/api/admin/formulas/${encodeURIComponent(card.formulaId)}/publish`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(publishedCard.response.status, 200);

    const globalSearch = await request("/api/admin/formulas?authoring=1&q=output-voltage&pageSize=6");
    assert.equal(globalSearch.response.status, 200);
    assert.equal(globalSearch.payload.items.length, 1);
    assert.equal(globalSearch.payload.items[0].formulaId, card.formulaId);
    const tagSearch = await request("/api/admin/formulas?authoring=1&tag=unit%3AV&pageSize=6");
    assert.equal(tagSearch.payload.items.length, 1);

    const unbound = postPayload({ id: "api-unbound-formula", slug: "api-unbound-formula" });
    const savedUnbound = await request("/api/posts", { method: "POST", body: JSON.stringify(unbound) });
    assert.equal(savedUnbound.response.status, 200);
    const unboundSavedPost = savedUnbound.payload.posts.find((post) => post.id === unbound.id);
    assert.equal(unboundSavedPost.markdown, unbound.markdown);
    assert.deepEqual(unboundSavedPost.formulaBindings, []);

    const existingBinding = {
      bindingId: "bind.api-existing",
      formulaId: card.formulaId,
      revisionId: currentRevisionId,
      displayMode: "inline"
    };
    const existingShortcode = formulaBindingShortcode(existingBinding);
    const boundPost = postPayload({
      id: "api-existing-binding",
      slug: "api-existing-binding",
      markdown: `已有公式：${existingShortcode}`
    });
    const savedBound = await request("/api/posts", { method: "POST", body: JSON.stringify(boundPost) });
    assert.equal(savedBound.response.status, 200);
    const savedBoundPost = savedBound.payload.posts.find((post) => post.id === boundPost.id);
    assert.equal(savedBoundPost.formulaBindings.length, 1);
    assert.equal(savedBoundPost.formulaBindings[0].revisionId, currentRevisionId);

    const selectionMarkdown = "前文保持。\n\n$$\nP=V I\n$$\n\n后文保持。";
    const selectedText = "$$\nP=V I\n$$";
    const selectionStart = selectionMarkdown.indexOf(selectedText);
    const atomicPost = postPayload({
      id: "api-atomic-formula",
      slug: "api-atomic-formula",
      markdown: selectionMarkdown,
      publishStatus: "draft"
    });
    const atomic = await request("/api/admin/formulas/from-selection", {
      method: "POST",
      body: JSON.stringify({
        post: atomicPost,
        selectionStart,
        selectionEnd: selectionStart + selectedText.length,
        formula: {
          displayName: "文章功率公式",
          moduleKey: "power-electronics",
          categoryPath: "文章公式/功率",
          purpose: "",
          tags: []
        }
      })
    });
    assert.equal(atomic.response.status, 200);
    assert.match(atomic.payload.shortcode, /^\{\{formula:bind\./);
    assert.equal(atomic.payload.binding.formulaId, atomic.payload.card.formulaId);
    assert.equal(atomic.payload.binding.revisionId, atomic.payload.card.currentRevisionId);
    assert.equal(atomic.payload.binding.displayMode, "display");
    assert.equal(atomic.payload.post.markdown, selectionMarkdown.replace(selectedText, atomic.payload.shortcode));

    const beforeFailure = (await request("/api/admin/formulas/export")).payload.cards.length;
    const invalidSelection = await request("/api/admin/formulas/from-selection", {
      method: "POST",
      body: JSON.stringify({
        post: postPayload({
          id: "api-invalid-selection",
          slug: "api-invalid-selection",
          markdown: "正文和 $x$ 混合选区"
        }),
        selectionStart: 0,
        selectionEnd: 8,
        formula: {
          displayName: "不应创建",
          moduleKey: "power-electronics",
          categoryPath: "文章公式/错误"
        }
      })
    });
    assert.equal(invalidSelection.response.status, 400);
    assert.equal((await request("/api/admin/formulas/export")).payload.cards.length, beforeFailure);

    const malformed = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(
        {
          ...postPayload({
            id: "api-malformed-binding",
            slug: "api-malformed-binding"
          }),
          markdown: "{{formula:broken}}"
        }
      )
    });
    assert.equal(malformed.response.status, 400);
  } catch (error) {
    error.message = `${error.message}\nserver output:\n${serverOutput}`;
    throw error;
  } finally {
    await stopChild(child);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-article-formula-"));
  try {
    const opened = openStore(path.join(tempRoot, "direct-data"));
    const { db, store } = opened;
    try {
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
      assert.ok(db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = '015_article_formula_bindings'").get()?.ok);

      const createdCard = store.saveFormulaCard(cardPayload());
      store.publishFormulaCard(createdCard.card.formulaId);
      const unbound = postPayload();
      const savedUnbound = store.savePost(unbound);
      assert.equal(savedUnbound.markdown, unbound.markdown);
      assert.deepEqual(savedUnbound.formulaBindings, []);

      const binding = {
        bindingId: "bind.direct-existing",
        formulaId: createdCard.card.formulaId,
        revisionId: createdCard.card.currentRevisionId,
        displayMode: "inline"
      };
      const shortcode = formulaBindingShortcode(binding);
      const savedBound = store.savePost(postPayload({ markdown: `普通 $x$；绑定 ${shortcode}。` }));
      assert.equal(savedBound.formulaBindings.length, 1);
      assert.equal(savedBound.formulaBindings[0].formulaId, binding.formulaId);
      assert.equal(savedBound.formulaBindings[0].revisionId, binding.revisionId);
      assert.equal(savedBound.formulaBindings[0].latex, cardPayload().latex);

      const globalSearch = store.listFormulaCards({ query: "output-voltage", allowGlobalSearch: true });
      assert.equal(globalSearch.items.length, 1);
      assert.equal(globalSearch.requiresCategory, true);
      const tagSearch = store.listFormulaCards({ tag: "unit:V", allowGlobalSearch: true });
      assert.equal(tagSearch.items.length, 1);

      assert.throws(
        () => validateFormulaReferenceShortcodes(`${shortcode}\n${shortcode}`),
        /bindingId 重复/
      );
      assert.throws(() => validateLatexSelection("正文 $x$ 尾部", 0, 6), /完整/);
      const displaySource = "前文。\n\n$$\nP=V I\n$$\n\n后文。";
      const selectedText = "$$\nP=V I\n$$";
      const selectionStart = displaySource.indexOf(selectedText);
      const selection = validateLatexSelection(displaySource, selectionStart, selectionStart + selectedText.length);
      const atomicPost = postPayload({
        id: "atomic-direct",
        slug: "atomic-direct",
        markdown: displaySource,
        publishStatus: "draft"
      });
      const atomicFormula = cardPayload({
        formulaId: "formula.user.atomic-direct",
        slug: "user-formula-atomic-direct",
        displayName: "文章功率公式",
        categoryPath: "文章公式/功率",
        tags: [],
        latex: selection.latex
      });
      const atomic = store.createFormulaFromSelection({ post: atomicPost, formula: atomicFormula, selection });
      assert.equal(atomic.binding.formulaId, atomicFormula.formulaId);
      assert.equal(atomic.binding.revisionId, atomic.card.currentRevisionId);
      assert.equal(atomic.binding.displayMode, "display");
      assert.equal(atomic.post.markdown, displaySource.replace(selectedText, atomic.shortcode));
      assert.equal(atomic.post.formulaBindings.length, 1);

      const beforeImmutableFailure = store.postById(savedBound.id);
      const replacementCard = store.saveFormulaCard(
        cardPayload({
          formulaId: "formula.test.replacement",
          slug: "test-replacement",
          displayName: "替换卡",
          latex: "x=2"
        })
      );
      store.publishFormulaCard(replacementCard.card.formulaId);
      const rewritten = formulaBindingShortcode({
        ...binding,
        formulaId: replacementCard.card.formulaId,
        revisionId: replacementCard.card.currentRevisionId
      });
      assert.throws(
        () => store.savePost(postPayload({ markdown: `普通 $x$；绑定 ${rewritten}。` })),
        /身份不可改写/
      );
      assert.equal(store.postById(savedBound.id).markdown, beforeImmutableFailure.markdown);

      const removed = store.savePost(postPayload({ markdown: "绑定已由作者显式移除；普通 $x$ 保留。" }));
      assert.deepEqual(removed.formulaBindings, []);
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM article_formula_bindings WHERE post_id = ?").get(removed.id).count,
        0
      );
    } finally {
      db.close();
    }

    const renderer = loadRenderer();
    const renderedUnbound = renderer.render("普通 $x_i^2$ 与 $$y=1$$");
    assert.match(renderedUnbound.html, /markdown-math-inline/);
    const renderedBinding = renderer.render("绑定 {{formula:bind.render|formula.test.output-voltage|rev.render|inline}}", {
      formulaBindings: [
        {
          bindingId: "bind.render",
          formulaId: "formula.test.output-voltage",
          revisionId: "rev.render",
          displayMode: "inline",
          slug: "test-output-voltage",
          displayName: "测试输出电压",
          latex: "V_{out}=12\\,\\mathrm{V}",
          archiveState: "active"
        }
      ]
    });
    assert.match(renderedBinding.html, /data-formula-binding-id="bind\.render"/);
    assert.match(renderedBinding.html, /derive\.html\?formula=test-output-voltage/);
    assert.match(renderedBinding.html, /markdown-math-inline/);

    await apiChecks(tempRoot);

    const adminHtml = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
    const adminCss = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
    assert.match(adminHtml, /id="formulaAuthoringPopover"/);
    assert.match(adminHtml, /id="openFormulaAuthoringButton"/);
    assert.match(adminJs, /contextmenu/);
    assert.match(adminJs, /from-selection/);
    assert.match(adminJs, /Shift \+ 右键/);
    assert.match(adminHtml, /id="formulaAuthoringQuickPreview"/);
    assert.match(adminHtml, /id="formulaAuthoringWorkbenchButton"/);
    assert.match(adminJs, /captureFormulaEditorState/);
    assert.match(adminJs, /renderFormulaAuthoringQuickPreview/);
    assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*formula-authoring-drawer/);
    console.log("article formula authoring checks passed: unbound LaTeX, existing binding, atomic create, rollback, immutable identity, drawer, renderer and API");
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
