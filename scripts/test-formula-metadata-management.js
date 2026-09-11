"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const {
  validateFormulaCardPayload,
  validateFormulaClassificationPayload,
  validateFormulaMetadataOperationPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function formula(id, overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: `formula.metadata.${id}`,
    slug: `metadata-${id}`,
    displayName: `元数据测试 ${id}`,
    moduleKey: "power-electronics",
    categoryPath: "反激/主设计",
    purpose: "隔离元数据生命周期验证",
    tags: ["topic:反激", "unit:V"],
    latex: `V_{${id}}=1`,
    markdownDerivation: "",
    revisionReason: "初始说明",
    ...overrides
  });
}

function expectFailure(work, pattern) {
  assert.throws(work, pattern);
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-metadata-"));
  const dbDir = path.join(tempRoot, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir: tempRoot,
    dbDir,
    dbPath: path.join(dbDir, "isolated.sqlite"),
    uploadDir: path.join(tempRoot, "uploads")
  });
  const store = createContentStore(db);
  try {
    expectFailure(() => formula("deep", { categoryPath: "反激/主设计/器件" }), /最多两级/u);
    expectFailure(() => formula("level", { categoryPath: "反激/L2" }), /动态推导层级/u);

    const first = store.saveFormulaCard(formula("a"));
    const second = store.saveFormulaCard(formula("a", { latex: "V_a=2", revisionReason: "修正匝比" }));
    const third = store.saveFormulaCard(formula("a", { latex: "V_a=3", revisionReason: "补充边界" }));
    assert.notEqual(first.currentRevisionId, second.currentRevisionId);
    assert.notEqual(second.currentRevisionId, third.currentRevisionId);
    assert.deepEqual(store.adminFormulaCard(first.card.formulaId).revisions.map((item) => item.revisionReason), [
      "补充边界", "修正匝比", "初始说明"
    ]);

    const category = store.listFormulaClassifications({ kind: "category", parentSlug: "power-electronics" })
      .find((item) => item.displayName === "反激/主设计");
    const preview = store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "preview", kind: "category", classificationId: category.classificationId
    }));
    assert.equal(preview.impact.cardCount, 1);
    store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "rename", kind: "category", classificationId: category.classificationId, displayName: "反激/稳态设计"
    }));
    assert.equal(store.adminFormulaCard(first.card.formulaId).categoryPath, "反激/稳态设计");

    store.saveFormulaClassification(validateFormulaClassificationPayload({
      kind: "category", parentSlug: "power-electronics", displayName: "反激/工程延伸", confirmCreate: true
    }));
    store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "migrate", kind: "card", formulaIds: [first.card.formulaId],
      targetModuleKey: "power-electronics", targetCategoryPath: "反激/工程延伸"
    }));
    assert.equal(store.adminFormulaCard(first.card.formulaId).categoryPath, "反激/工程延伸");

    const target = store.saveFormulaCard(formula("target", { categoryPath: "反激/工程延伸" }));
    store.saveFormulaCard(formula("source", {
      categoryPath: "反激/工程延伸",
      markdownDerivation: `{{formula-ref:${target.card.formulaId}}}`
    }));
    const protectedPreview = store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "preview", kind: "card", formulaIds: [target.card.formulaId]
    }));
    assert.equal(protectedPreview.impact.protectedCount, 1);
    expectFailure(() => store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "delete", kind: "card", formulaIds: [target.card.formulaId], backupConfirmed: true,
      confirmText: "PERMANENTLY DELETE"
    })), /永久删除已阻止/u);

    const disposable = store.saveFormulaCard(formula("disposable", { categoryPath: "反激/工程延伸" }));
    store.operateFormulaMetadata(validateFormulaMetadataOperationPayload({
      action: "delete", kind: "card", formulaIds: [disposable.card.formulaId], backupConfirmed: true,
      confirmText: "PERMANENTLY DELETE"
    }));
    assert.equal(store.adminFormulaCard(disposable.card.formulaId), null);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    console.log("formula metadata management verification passed");
  } finally {
    db.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
