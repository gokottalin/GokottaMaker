"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createContentStore, formulaBindingShortcode } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const { validateFormulaCardPayload, validatePostPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (
    !resolved.startsWith(`${tempRoot}${path.sep}`) ||
    !path.basename(resolved).startsWith("larkix-formula-projection-")
  ) {
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

function formulaPayload(formulaId, options = {}) {
  const slug = formulaId.replace(/^formula\./, "").replaceAll(".", "-");
  return validateFormulaCardPayload({
    formulaId,
    slug,
    displayName: options.displayName || formulaId,
    moduleKey: "electronics-basics",
    categoryPath: "公式关系/投影验收",
    purpose: "验证统一关系权威的管理端和公开端投影",
    tags: ["module:electronics-basics", "relation:projection"],
    latex: options.latex || "x=1",
    markdownDerivation: options.markdownDerivation || "",
    revisionReason: "relationship-projection-test"
  });
}

function postPayload(id, title, markdown, options = {}) {
  return validatePostPayload({
    id,
    slug: id,
    title,
    category: options.category || "电子基础",
    excerpt: "公式关系投影验收",
    markdown,
    cover: "./assets/covers/analog-cover.png",
    publishStatus: options.publishStatus || "published",
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 100,
    tags: options.tags || "module:electronics-basics"
  });
}

function shortcode(id, card) {
  return formulaBindingShortcode({
    bindingId: id,
    formulaId: card.formulaId,
    revisionId: card.publishedRevisionId,
    displayMode: "inline"
  });
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
    if (child.exitCode !== null) throw new Error(`projection server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("projection server did not become healthy");
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

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-projection-"));
  const dataDir = path.join(tempRoot, "data");
  let target;
  try {
    const { db, store } = openStore(dataDir);
    try {
      target = store.saveFormulaCard(
        formulaPayload("formula.s48.target", { displayName: "S48 目标公式" })
      ).card;
      target = store.publishFormulaCard(target.formulaId).card;
      let parent = store.saveFormulaCard(
        formulaPayload("formula.s48.parent", {
          displayName: "S48 上级推导",
          markdownDerivation: `## 推导\n\n{{formula-ref:${target.formulaId}}}`
        })
      ).card;
      parent = store.publishFormulaCard(parent.formulaId).card;

      const references = {
        visible: shortcode("bind.s48.visible", target),
        draft: shortcode("bind.s48.draft", target),
        derivedScope: shortcode("bind.s48.derived-scope", target),
        removed: shortcode("bind.s48.removed", target),
        deleted: shortcode("bind.s48.deleted", target)
      };
      store.savePost(postPayload("s48-visible", "S48 公开可见文章", `正文 ${references.visible}`));
      store.savePost(
        postPayload("s48-draft", "S48 草稿文章秘密", `正文 ${references.draft}`, {
          publishStatus: "draft"
        })
      );
      store.savePost(
        postPayload("s48-derived-scope", "S48 公式范围文章", `正文 ${references.derivedScope}`, {
          category: "模拟电子",
          tags: "scope:outside"
        })
      );
      store.savePost(postPayload("s48-removed", "S48 已解绑文章", `正文 ${references.removed}`));
      store.savePost(postPayload("s48-removed", "S48 已解绑文章", "正文已移除公式引用"));
      store.savePost(postPayload("s48-deleted", "S48 已删除文章", `正文 ${references.deleted}`));
      store.hardDeletePost("s48-deleted");

      const adminCard = store.adminFormulaCard(target.formulaId);
      assert.deepEqual(
        adminCard.derivation.incoming.map((item) => item.formulaId),
        [parent.formulaId]
      );
      const adminArticles = adminCard.graph.nodes
        .filter((node) => node.nodeType === "article")
        .map((node) => node.displayName)
        .sort();
      assert.deepEqual(adminArticles, [
        "S48 公开可见文章",
        "S48 公式范围文章",
        "S48 草稿文章秘密"
      ]);
      assert.equal(
        adminCard.graph.nodes.find((node) => node.displayName === "S48 草稿文章秘密").lifecycleState,
        "draft"
      );
      assert.equal(
        adminCard.graph.edges.filter((edge) => edge.edgeType === "article_reference").length,
        3
      );
      assert.equal(
        store
          .formulaContentBindingsForSource("article", "s48-removed", { includeRetired: true })
          .every((binding) => binding.lifecycleStatus === "retired"),
        true
      );
      assert.equal(
        store
          .formulaContentBindingsForSource("article", "s48-deleted", { includeRetired: true })
          .every((binding) => binding.lifecycleStatus === "retired"),
        true
      );
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally {
      db.close();
    }

    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
      cwd: ROOT,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: dataDir,
        FORMULA_BACKUP_DIR: path.join(tempRoot, "backups"),
        ALLOW_LEGACY_CMS_LOOPBACK: "true"
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
    try {
      await waitForServer(baseUrl, child);
      const response = await fetch(`${baseUrl}/api/formulas/${encodeURIComponent(target.slug)}`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      const articleNodes = payload.card.graph.nodes.filter((node) => node.nodeType === "article");
      assert.deepEqual(articleNodes.map((node) => node.displayName).sort(), [
        "S48 公开可见文章",
        "S48 公式范围文章"
      ]);
      assert.deepEqual(
        payload.card.derivation.articleReferrers.map((article) => article.title).sort(),
        ["S48 公开可见文章", "S48 公式范围文章"]
      );
      assert.ok(payload.card.graph.nodes.some((node) => node.slug === "s48-parent"));
      assert.ok(
        payload.card.graph.edges.some((edge) => edge.edgeType === "formula_dependency")
      );
      const serialized = JSON.stringify(payload);
      assert.doesNotMatch(serialized, /S48 草稿文章秘密/);
      assert.doesNotMatch(serialized, /bind\.s48\.|"bindingId"|"publishStatus"|"lifecycleState"/);
    } catch (error) {
      error.message = `${error.message}\nserver output:\n${output}`;
      throw error;
    } finally {
      await stopChild(child);
    }

    console.log(
      "Formula relationship projection checks passed: authority sync, lifecycle, admin state, public focus filtering, and API redaction."
    );
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main();
