"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  formulaSelectionIdentity,
  sourceTextHash,
  validateFormulaCardPayload,
  validateFormulaClassificationPayload,
  validateLatexSelection,
  validatePostPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (
    !resolved.startsWith(`${tempRoot}${path.sep}`) ||
    !path.basename(resolved).startsWith("larkix-formula-selection-")
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

function postPayload(id, markdown, publishStatus = "draft") {
  return validatePostPayload({
    id,
    slug: id,
    title: `公式选区测试 ${id}`,
    category: "电力电子",
    excerpt: "S35 隔离验证",
    markdown,
    cover: "./assets/covers/analog-cover.png",
    publishStatus,
    featured: false,
    featuredOrder: 0,
    recommendationPriority: 100,
    tags: "公式测试"
  });
}

function selectionFor(markdown) {
  return validateLatexSelection(markdown, 0, markdown.length);
}

function formulaPayload(selection, displayName, overrides = {}) {
  return validateFormulaCardPayload({
    ...formulaSelectionIdentity({ displayName, latex: selection.latex }),
    displayName,
    moduleKey: "power-electronics",
    categoryPath: "文章公式/功率",
    purpose: "验证完整选区原子建卡",
    tags: ["unit:W"],
    latex: selection.latex,
    revisionReason: "s35-selection-create",
    ...overrides
  });
}

function registerClassification(store, payload) {
  return store.saveFormulaClassification(validateFormulaClassificationPayload(payload));
}

function cardCount(db) {
  return Number(db.prepare("SELECT COUNT(*) AS count FROM formula_cards").get().count || 0);
}

function bindingCount(db) {
  return Number(
    db.prepare("SELECT COUNT(*) AS count FROM article_formula_bindings").get().count || 0
  );
}

function assertSelectionFixtures() {
  const fixtures = [
    { source: "$E=mc^2$", mode: "inline", latex: "E=mc^2" },
    { source: "\\(V_{out}=D V_{in}\\)", mode: "inline", latex: "V_{out}=D V_{in}" },
    {
      source: "\\[\nI_L=\\frac{V}{R}\n\\]",
      mode: "display",
      latex: "I_L=\\frac{V}{R}"
    },
    { source: "$$\nP=V I\n$$", mode: "display", latex: "P=V I" }
  ];
  for (const fixture of fixtures) {
    const selection = selectionFor(fixture.source);
    assert.equal(selection.displayMode, fixture.mode);
    assert.equal(selection.latex, fixture.latex);
    assert.equal(selection.selectedText, fixture.source);
  }

  const rejected = [
    { source: "$E=mc^2$", start: 1, end: 7 },
    { source: "\\(x+y\\)", start: 0, end: 5 },
    { source: "\\[\nx+y\n\\]", start: 2, end: 7 },
    { source: "$x$ $y$", start: 0, end: 7 },
    { source: "正文 $x$", start: 0, end: 5 },
    { source: "$$x$$", start: 1, end: 4 }
  ];
  for (const fixture of rejected) {
    assert.throws(
      () => validateLatexSelection(fixture.source, fixture.start, fixture.end),
      /完整|只包含/
    );
  }
}

function assertStableIdentity() {
  const left = formulaSelectionIdentity({
    displayName: "  BOOST   输出功率 ",
    latex: "P_{out}=V_{out}I_{out}"
  });
  const right = formulaSelectionIdentity({
    displayName: "BOOST 输出功率",
    latex: "P_{out}=V_{out}I_{out}"
  });
  assert.deepEqual(left, right);
  assert.match(left.slug, /^[a-z0-9][a-z0-9-]{1,79}$/);
  assert.match(left.formulaId, /^formula\.user\.[a-z0-9-]+$/);
  assert.notDeepEqual(
    left,
    formulaSelectionIdentity({
      displayName: "BOOST 输出功率",
      latex: "P_{out}=2V_{out}I_{out}"
    })
  );
}

function assertUiContract() {
  const html = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
  const createPane = html.match(
    /<section class="formula-authoring-pane" id="formulaCreatePane"[\s\S]*?<\/section>\s*<\/div>\s*<\/aside>/
  )?.[0];
  assert.ok(createPane, "formula selection create pane must exist");
  assert.match(createPane, /id="formulaCreateModule" list="formulaModuleOptions"/);
  assert.match(createPane, /id="formulaCreateCategory" list="formulaCategoryOptions"/);
  assert.match(createPane, /id="formulaCreateTagPicker" list="formulaTagOptions"/);
  assert.match(createPane, /id="formulaCreateModuleButton"[\s\S]*新增模块/);
  assert.match(createPane, /id="formulaCreateCategoryButton"[\s\S]*新增主分类/);
  assert.match(createPane, /id="formulaCreateTagAddButton"[\s\S]*添加标签/);
  assert.ok(
    (createPane.match(/class="formula-field-help-button"/g) || []).length >= 6,
    "all six required/optional creation fields need keyboard-accessible help"
  );
  assert.match(createPane, /保存草稿公式卡并原子绑定/);
  assert.match(js, /function sha256Text\(value\)/);
  assert.match(js, /baseSourceMarkdown:\s*null/);
  assert.match(js, /baseSourceMarkdown\s*!==\s*null/);
  assert.match(js, /sourceHash,[\s\S]*baseSourceHash/);
  assert.match(js, /function appendFormulaBindingToSelection/);
  assert.match(js, /selectedFormulaCreateModule/);
  assert.match(js, /selectedFormulaCreateCategory/);
  assert.match(js, /formulaCreateTagValues/);
  assert.match(css, /\.formula-authoring-create-fields label,[\s\S]*\.formula-create-latex-field/);
}

function main() {
  assertSelectionFixtures();
  assertStableIdentity();
  assertUiContract();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-selection-"));
  try {
    const { db, store } = openStore(path.join(tempRoot, "data"));
    try {
      const module = registerClassification(store, {
        kind: "module",
        displayName: "Power   Electronics"
      });
      assert.equal(module.classification.slug, "power-electronics");
      const reusedModule = registerClassification(store, {
        kind: "module",
        displayName: " power electronics "
      });
      assert.equal(reusedModule.reused, true);
      registerClassification(store, {
        kind: "category",
        displayName: "文章公式/功率",
        parentSlug: "power-electronics"
      });
      registerClassification(store, {
        kind: "tag",
        displayName: "unit:W"
      });
      const categorySearch = store.listFormulaClassifications({
        kind: "category",
        parentSlug: "power-electronics",
        query: "功率"
      });
      assert.equal(categorySearch.length, 1);

      const delimiterFixtures = [
        { id: "selection-dollar", source: "$P=VI$", name: "行内美元功率" },
        { id: "selection-parenthesis", source: "\\(P=VI\\)", name: "行内括号功率" },
        {
          id: "selection-bracket",
          source: "\\[\nP=VI\n\\]",
          name: "块级方括号功率"
        }
      ];
      for (const fixture of delimiterFixtures) {
        const selection = selectionFor(fixture.source);
        const formula = formulaPayload(selection, fixture.name);
        const created = store.createFormulaFromSelection({
          post: postPayload(fixture.id, fixture.source),
          formula,
          selection,
          sourceHash: sourceTextHash(fixture.source),
          baseSourceHash: ""
        });
        assert.equal(created.card.publishStatus, "draft");
        assert.equal(
          created.post.markdown.slice(0, fixture.source.length),
          fixture.source,
          "selected formula source must remain byte-for-byte unchanged"
        );
        assert.ok(created.post.markdown.includes(created.shortcode));
        assert.equal(created.binding.formulaId, created.card.formulaId);
      }

      const storedSource = "前文\n\n$V=IR$\n\n后文";
      const stored = store.savePost(postPayload("selection-source-hash", storedSource));
      const localSource = stored.markdown.replace("$V=IR$", "$V=IR+V_d$");
      const localStart = localSource.indexOf("$V=IR+V_d$");
      const localSelection = validateLatexSelection(
        localSource,
        localStart,
        localStart + "$V=IR+V_d$".length
      );
      const localFormula = formulaPayload(localSelection, "带压降欧姆定律");
      const beforeStaleCount = cardCount(db);
      assert.throws(
        () =>
          store.createFormulaFromSelection({
            post: postPayload("selection-source-hash", localSource),
            formula: localFormula,
            selection: localSelection,
            sourceHash: sourceTextHash(localSource),
            baseSourceHash: sourceTextHash("过期来源")
          }),
        /其他操作更新/
      );
      assert.equal(cardCount(db), beforeStaleCount);
      assert.equal(store.postById(stored.id).markdown, storedSource);

      const hashProtected = store.createFormulaFromSelection({
        post: postPayload("selection-source-hash", localSource),
        formula: localFormula,
        selection: localSelection,
        sourceHash: sourceTextHash(localSource),
        baseSourceHash: sourceTextHash(storedSource)
      });
      assert.equal(
        hashProtected.post.markdown.slice(localStart, localStart + localSelection.selectedText.length),
        localSelection.selectedText
      );

      const duplicateSource = "$P_{dup}=VI$";
      const duplicateSelection = selectionFor(duplicateSource);
      const duplicateFormula = formulaPayload(duplicateSelection, "稳定重复身份");
      store.createFormulaFromSelection({
        post: postPayload("selection-duplicate-first", duplicateSource),
        formula: duplicateFormula,
        selection: duplicateSelection,
        sourceHash: sourceTextHash(duplicateSource),
        baseSourceHash: ""
      });
      const beforeDuplicateCount = cardCount(db);
      const beforeDuplicateBindings = bindingCount(db);
      assert.throws(
        () =>
          store.createFormulaFromSelection({
            post: postPayload("selection-duplicate-second", duplicateSource),
            formula: duplicateFormula,
            selection: duplicateSelection,
            sourceHash: sourceTextHash(duplicateSource),
            baseSourceHash: ""
          }),
        /已存在/
      );
      assert.equal(cardCount(db), beforeDuplicateCount);
      assert.equal(bindingCount(db), beforeDuplicateBindings);
      assert.equal(store.postById("selection-duplicate-second"), null);

      const publishFailureSource = "\\[\nP_{rollback}=VI\n\\]";
      const publishFailureSelection = selectionFor(publishFailureSource);
      const publishFailureFormula = formulaPayload(
        publishFailureSelection,
        "文章绑定失败回滚"
      );
      const beforePublishFailureCount = cardCount(db);
      const beforePublishFailureBindings = bindingCount(db);
      assert.throws(
        () =>
          store.createFormulaFromSelection({
            post: postPayload(
              "selection-publish-failure",
              publishFailureSource,
              "published"
            ),
            formula: publishFailureFormula,
            selection: publishFailureSelection,
            sourceHash: sourceTextHash(publishFailureSource),
            baseSourceHash: ""
          }),
        /文章不能发布/
      );
      assert.equal(cardCount(db), beforePublishFailureCount);
      assert.equal(bindingCount(db), beforePublishFailureBindings);
      assert.equal(store.adminFormulaCard(publishFailureFormula.formulaId), null);
      assert.equal(store.postById("selection-publish-failure"), null);

      const missingCategorySource = "$Q=CV$";
      const missingCategorySelection = selectionFor(missingCategorySource);
      const missingCategoryFormula = formulaPayload(
        missingCategorySelection,
        "未明确分类不创建",
        { categoryPath: "未登记/分类" }
      );
      const beforeMissingCategory = cardCount(db);
      assert.throws(
        () =>
          store.createFormulaFromSelection({
            post: postPayload("selection-missing-category", missingCategorySource),
            formula: missingCategoryFormula,
            selection: missingCategorySelection,
            sourceHash: sourceTextHash(missingCategorySource),
            baseSourceHash: ""
          }),
        /新增主分类/
      );
      assert.equal(cardCount(db), beforeMissingCategory);
      assert.equal(store.postById("selection-missing-category"), null);
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally {
      db.close();
    }
  } finally {
    safeRemoveTemp(tempRoot);
  }

  console.log(
    "article formula selection create checks passed: delimiters, shared classifications, stable draft identity, source hashes and full rollback"
  );
}

main();
