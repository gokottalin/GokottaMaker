"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createContentStore, formulaBindingShortcode } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  validateFormulaCardPayload,
  validateFormulaClassificationPayload,
  validatePostPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-formula-publication-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function formulaPayload(overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: "formula.publication.workflow",
    slug: "publication-workflow",
    displayName: "发布工作流公式",
    moduleKey: "power-electronics",
    categoryPath: "发布测试/主功率",
    purpose: "验证公式发布隔离",
    tags: ["module:power-electronics", "unit:V"],
    latex: "V_{out}=1",
    markdownDerivation: "## 推导\n\n其中 $V_{out}$ 为输出电压。\n",
    revisionReason: "publication-test",
    ...overrides
  });
}

function postPayload(id, markdown, publishStatus = "draft") {
  return validatePostPayload({
    id,
    slug: id,
    title: `公式发布测试 ${id}`,
    category: "模拟电子",
    excerpt: "隔离公式发布测试",
    markdown,
    cover: "./assets/covers/analog-cover.png",
    publishStatus,
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 100,
    tags: "公式发布"
  });
}

function expectFailure(work, pattern, reasonCode) {
  let caught = null;
  try {
    work();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "expected operation to fail");
  assert.match(caught.message, pattern);
  if (reasonCode) assert.equal(caught.reasonCode, reasonCode);
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-publication-"));
  const dbDir = path.join(tempRoot, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir: tempRoot,
    dbDir,
    dbPath: path.join(dbDir, "gokottamaker.sqlite"),
    uploadDir: path.join(tempRoot, "uploads")
  });
  const store = createContentStore(db);

  try {
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.ok(db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = '020_formula_publication_workflow'").get()?.ok);
    assert.ok(db.prepare("SELECT 1 AS ok FROM formula_revision_publications LIMIT 1").get() === undefined);

    const sourcePayload = formulaPayload();
    const created = store.saveFormulaCard(sourcePayload);
    assert.equal(created.card.publishStatus, "draft");
    assert.equal(created.card.publishedRevisionId, null);
    assert.equal(created.card.markdownDerivation, sourcePayload.markdownDerivation);
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug), null);

    const originalRevisionId = created.card.currentRevisionId;
    const binding = formulaBindingShortcode({
      bindingId: "bind.publication-draft",
      formulaId: created.card.formulaId,
      revisionId: originalRevisionId,
      displayMode: "display"
    });
    const draftPost = store.savePost(postPayload("publication-draft-post", `${binding}\n`, "draft"));
    assert.equal(draftPost.formulaBindings[0].revisionId, originalRevisionId);
    expectFailure(
      () => store.savePost(postPayload("publication-draft-post", `${binding}\n`, "published")),
      /草稿公式卡.*尚未发布/u,
      "ARTICLE_DRAFT_FORMULA_BLOCKED"
    );

    const firstPublication = store.publishFormulaCard(created.card.formulaId, { id: 24, username: "Agent24" });
    assert.equal(firstPublication.card.publishStatus, "published");
    assert.equal(firstPublication.card.publishedRevisionId, originalRevisionId);
    assert.equal(firstPublication.card.pendingPublication, false);
    const publishedPost = store.savePost(postPayload("publication-draft-post", `${binding}\n`, "published"));
    assert.equal(publishedPost.publishStatus, "published");

    const firstPublic = store.publicFormulaCardBySlug(sourcePayload.slug);
    assert.equal(firstPublic.currentRevisionId, originalRevisionId);
    assert.equal(firstPublic.latex, sourcePayload.latex);
    assert.equal(firstPublic.markdownDerivation, sourcePayload.markdownDerivation);

    const pendingPayload = formulaPayload({
      latex: "V_{out}=2",
      markdownDerivation: "## 推导\n\n我计算得到 $V_{out}=2$。\n",
      revisionReason: "pending-publication-test"
    });
    const pending = store.saveFormulaCard(pendingPayload);
    assert.equal(pending.card.publishStatus, "published");
    assert.equal(pending.card.pendingPublication, true);
    assert.notEqual(pending.card.currentRevisionId, pending.card.publishedRevisionId);
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug).latex, sourcePayload.latex);
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug).markdownDerivation, sourcePayload.markdownDerivation);

    const pendingBinding = formulaBindingShortcode({
      bindingId: "bind.pending-revision",
      formulaId: pending.card.formulaId,
      revisionId: pending.card.currentRevisionId,
      displayMode: "inline"
    });
    expectFailure(
      () => store.savePost(postPayload("pending-revision-post", `待发布 ${pendingBinding}`, "published")),
      /待发布修订/u,
      "ARTICLE_UNPUBLISHED_FORMULA_REVISION_BLOCKED"
    );

    const republished = store.publishFormulaCard(pending.card.formulaId, { id: 24, username: "Agent24" });
    assert.equal(republished.card.pendingPublication, false);
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug).latex, pendingPayload.latex);
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug).markdownDerivation, pendingPayload.markdownDerivation);
    assert.equal(store.postById("publication-draft-post").formulaBindings[0].revisionId, originalRevisionId);
    store.savePost(postPayload("pending-revision-post", `待发布 ${pendingBinding}`, "published"));

    const archived = store.archiveFormulaCard(pending.card.formulaId, { id: 24, username: "Agent24" });
    assert.equal(archived.publishStatus, "archived");
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug), null);
    assert.equal(store.postById("publication-draft-post").formulaBindings[0].revisionId, originalRevisionId);
    store.savePost(postPayload("publication-draft-post", `${binding}\n`, "published"));
    expectFailure(
      () =>
        store.savePost(
          postPayload(
            "archived-new-binding",
            formulaBindingShortcode({
              bindingId: "bind.archived-new",
              formulaId: archived.formulaId,
              revisionId: archived.publishedRevisionId,
              displayMode: "inline"
            }),
            "draft"
          )
        ),
      /已归档公式卡不能建立新文章绑定/u
    );

    const restored = store.restoreFormulaCard(archived.formulaId);
    assert.equal(restored.publishStatus, "published");
    assert.equal(store.publicFormulaCardBySlug(sourcePayload.slug).latex, pendingPayload.latex);

    const classification = validateFormulaClassificationPayload({
      kind: "category",
      name: "主功率级",
      parentSlug: "power-electronics"
    });
    const classificationCreated = store.saveFormulaClassification(classification);
    assert.equal(classificationCreated.reused, false);
    assert.match(classificationCreated.classification.slug, /^[a-z0-9-]+$/);
    assert.equal(store.saveFormulaClassification(classification).reused, true);
    expectFailure(
      () =>
        store.saveFormulaClassification(
          validateFormulaClassificationPayload({
            kind: "category",
            name: "主 功率级",
            parentSlug: "power-electronics"
          })
        ),
      /可能重复/u
    );

    const revisionCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM formula_revisions WHERE formula_id = ?").get(created.card.formulaId).count
    );
    assert.equal(revisionCount, 2);
    expectFailure(
      () =>
        db
          .prepare("UPDATE formula_revision_publications SET actor_username = 'changed' WHERE revision_id = ?")
          .run(republished.card.publishedRevisionId),
      /immutable/u
    );

    const exported = store.exportFormulaCatalog();
    const exportedCard = exported.cards.find((card) => card.formulaId === created.card.formulaId);
    assert.equal(exportedCard.publishStatus, "published");
    assert.equal(exportedCard.publishedRevisionIds.length, 2);
    assert.equal(exportedCard.revisions.at(-1).markdownDerivation, pendingPayload.markdownDerivation);

    console.log("Formula publication workflow core checks passed.");
  } finally {
    db.close();
    safeRemoveTemp(tempRoot);
  }
}

main();
