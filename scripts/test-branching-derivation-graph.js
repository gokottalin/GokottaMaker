"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const {
  extractFormulaDependencyReferences,
  validateFormulaCatalogPackage,
  validateFormulaCardPayload
} = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function loadMarkdownRenderer() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, "data", "markdown-renderer.js"), "utf8"),
    sandbox
  );
  return sandbox.window.LarkixMarkdown;
}

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (
    !resolved.startsWith(`${tempRoot}${path.sep}`) ||
    !path.basename(resolved).startsWith("larkix-branching-graph-")
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
    moduleKey: options.moduleKey || "electronics-basics",
    categoryPath: options.categoryPath || "推导关系/分支测试",
    purpose: options.purpose || "验证 revision-aware 分支推导依赖",
    tags: options.tags || ["module:electronics-basics", "relation:branching"],
    latex: options.latex || `${slug.replaceAll("-", "_")}=1`,
    markdownDerivation: options.markdownDerivation || "",
    revisionReason: options.revisionReason || "branching-graph-test"
  });
}

function save(store, formulaId, dependencyIds = [], options = {}) {
  const markdown = [
    options.body || `## ${options.displayName || formulaId}`,
    ...dependencyIds.map((dependencyId) => `{{formula-ref:${dependencyId}}}`)
  ].join("\n\n");
  return store.saveFormulaCard(
    formulaPayload(formulaId, {
      ...options,
      markdownDerivation: markdown
    })
  ).card;
}

function publish(store, card) {
  return store.publishFormulaCard(card.formulaId, {
    id: 26,
    username: "BranchingGraphTester"
  }).card;
}

function currentDependencies(db, formulaId) {
  return db
    .prepare(
      `SELECT dependency.target_formula_id AS targetFormulaId
       FROM formula_cards card
       JOIN formula_revision_dependencies dependency
         ON dependency.revision_id = card.current_revision_id
       WHERE card.formula_id = ?
       ORDER BY dependency.ordinal ASC`
    )
    .all(formulaId)
    .map((row) => row.targetFormulaId);
}

function rejectionIsAtomic(store, db, formulaId, operation, pattern) {
  const before = store.adminFormulaCard(formulaId);
  const beforeCount = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM formula_revision_dependencies
         WHERE source_formula_id = ?`
      )
      .get(formulaId).count
  );
  assert.throws(operation, pattern);
  const after = store.adminFormulaCard(formulaId);
  assert.equal(after.currentRevisionId, before.currentRevisionId);
  assert.deepEqual(
    after.derivation.dependencies.map((dependency) => dependency.formulaId),
    before.derivation.dependencies.map((dependency) => dependency.formulaId)
  );
  assert.equal(
    Number(
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM formula_revision_dependencies
           WHERE source_formula_id = ?`
        )
        .get(formulaId).count
    ),
    beforeCount
  );
}

function applyMigrationsThrough020(db) {
  const files = fs
    .readdirSync(path.join(ROOT, "migrations"))
    .filter((file) => /^\d+_.+\.js$/.test(file) && Number(file.slice(0, 3)) <= 20)
    .sort();
  for (const file of files) {
    db.exec("BEGIN");
    try {
      require(path.join(ROOT, "migrations", file)).up(db);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function insertPublishedLegacyCard(db, formulaId, slug, revisionId) {
  db.prepare(
    `INSERT INTO formula_cards
      (formula_id, slug, display_name, module_key, category_path, purpose,
       current_revision_id, publish_status, published_revision_id)
     VALUES (?, ?, ?, 'electronics-basics', '兼容迁移', '', NULL, 'draft', NULL)`
  ).run(formulaId, slug, formulaId);
  db.prepare(
    `INSERT INTO formula_revisions
      (revision_id, formula_id, sequence_no, latex, markdown_derivation, revision_reason)
     VALUES (?, ?, 1, ?, '', 'legacy-fixture')`
  ).run(revisionId, formulaId, `${slug}=1`);
  db.prepare(
    `UPDATE formula_cards
     SET current_revision_id = ?, publish_status = 'published',
         published_revision_id = ?, published_at = CURRENT_TIMESTAMP
     WHERE formula_id = ?`
  ).run(revisionId, revisionId, formulaId);
  db.prepare(
    `INSERT INTO formula_revision_publications
      (revision_id, formula_id, actor_username)
     VALUES (?, ?, 'LegacyFixture')`
  ).run(revisionId, formulaId);
}

function legacyMigrationChecks(tempRoot) {
  const dbPath = path.join(tempRoot, "legacy.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    applyMigrationsThrough020(db);
    insertPublishedLegacyCard(
      db,
      "formula.legacy.parent",
      "legacy-parent",
      "rev.legacy-parent"
    );
    insertPublishedLegacyCard(
      db,
      "formula.legacy.child",
      "legacy-child",
      "rev.legacy-child"
    );
    insertPublishedLegacyCard(
      db,
      "formula.legacy.replacement",
      "legacy-replacement",
      "rev.legacy-replacement"
    );
    db.prepare(
      `INSERT INTO formula_derivation_edges
        (source_formula_id, target_formula_id, actor_username)
       VALUES (?, ?, 'LegacyFixture')`
    ).run("formula.legacy.parent", "formula.legacy.child");

    require("../migrations/021_branching_derivation_graph").up(db);
    require("../migrations/028_formula_content_bindings").up(db);
    const imported = db
      .prepare(
        `SELECT target_formula_id AS targetFormulaId, provenance
         FROM formula_revision_dependencies
         WHERE revision_id = 'rev.legacy-parent'`
      )
      .get();
    assert.equal(imported.targetFormulaId, "formula.legacy.child");
    assert.equal(imported.provenance, "legacy_linear");

    const store = createContentStore(db);
    const parent = store.adminFormulaCard("formula.legacy.parent");
    assert.equal(parent.derivation.dependencies[0].formulaId, "formula.legacy.child");
    assert.equal(parent.derivation.dependencies[0].provenance, "legacy_linear");
    const oldRevisionId = parent.currentRevisionId;
    const removed = store.saveFormulaDerivation(parent.formulaId, { action: "remove" });
    assert.equal(removed.changed, true);
    assert.notEqual(removed.source.currentRevisionId, oldRevisionId);
    assert.deepEqual(removed.source.derivation.dependencies, []);
    assert.equal(
      db
        .prepare(
          `SELECT provenance
           FROM formula_revision_dependencies
           WHERE revision_id = ? AND target_formula_id = ?`
        )
        .get(oldRevisionId, "formula.legacy.child").provenance,
      "legacy_linear"
    );
    assert.equal(
      store.publicFormulaCardBySlug(parent.slug).publishedRevisionId,
      oldRevisionId
    );
    assert.equal(
      store.publicFormulaCardBySlug(parent.slug).derivation.next.formulaId,
      "formula.legacy.child"
    );

    const set = store.saveFormulaDerivation(parent.formulaId, {
      action: "set",
      targetFormulaId: "formula.legacy.child",
      replace: false
    });
    assert.match(
      set.source.markdownDerivation,
      /\{\{formula-ref:formula\.legacy\.child\}\}/
    );
    assert.equal(set.source.derivation.dependencies[0].provenance, "markdown");
    assert.throws(
      () =>
        store.saveFormulaDerivation(parent.formulaId, {
          action: "set",
          targetFormulaId: "formula.legacy.replacement",
          replace: false
        }),
      /明确|替换|分叉/
    );
    const replaced = store.saveFormulaDerivation(parent.formulaId, {
      action: "set",
      targetFormulaId: "formula.legacy.replacement",
      replace: true
    });
    assert.equal(replaced.replaced, true);
    assert.deepEqual(
      replaced.source.derivation.dependencies.map((item) => item.formulaId),
      ["formula.legacy.replacement"]
    );
    assert.doesNotMatch(
      replaced.source.markdownDerivation,
      /\{\{formula-ref:formula\.legacy\.child\}\}/
    );
    assert.match(
      replaced.source.markdownDerivation,
      /\{\{formula-ref:formula\.legacy\.replacement\}\}/
    );
    const published = store.publishFormulaCard(parent.formulaId).card;
    assert.equal(
      store.publicFormulaCardBySlug(published.slug).derivation.next.formulaId,
      "formula.legacy.replacement"
    );
    assert.equal(
      db
        .prepare(
          `SELECT provenance
           FROM formula_revision_dependencies
           WHERE revision_id = ? AND target_formula_id = ?`
        )
        .get(oldRevisionId, "formula.legacy.child").provenance,
      "legacy_linear"
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM formula_derivation_edges").get().count,
      1
    );
  } finally {
    db.close();
  }
}

function revisionPresentationUpgradeChecks(tempRoot) {
  const dbPath = path.join(tempRoot, "revision-presentation-upgrade.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    applyMigrationsThrough020(db);
    insertPublishedLegacyCard(
      db,
      "formula.legacy.presentation",
      "legacy-presentation",
      "rev.legacy-presentation"
    );
    db.prepare(
      `INSERT INTO formula_card_tags (formula_id, tag_key, namespace, value)
       VALUES (?, ?, ?, ?)`
    ).run("formula.legacy.presentation", "scope:legacy", "scope", "legacy");
    require("../migrations/022_formula_revision_presentation_snapshot").up(db);
    const revision = db
      .prepare(
        `SELECT display_name AS displayName, module_key AS moduleKey,
                category_path AS categoryPath, tags_json AS tagsJson
         FROM formula_revisions
         WHERE revision_id = 'rev.legacy-presentation'`
      )
      .get();
    assert.equal(revision.displayName, "formula.legacy.presentation");
    assert.equal(revision.moduleKey, "electronics-basics");
    assert.equal(revision.categoryPath, "兼容迁移");
    assert.deepEqual(JSON.parse(revision.tagsJson), ["scope:legacy"]);
  } finally {
    db.close();
  }
}

function catalogImportChecks(tempRoot) {
  const source = openStore(path.join(tempRoot, "catalog-source"));
  let catalog;
  try {
    let dependency = save(source.store, "formula.import.z-dependency");
    let parent = save(source.store, "formula.import.a-parent", [dependency.formulaId]);
    dependency = publish(source.store, dependency);
    parent = publish(source.store, parent);
    catalog = validateFormulaCatalogPackage(source.store.exportFormulaCatalog());
    assert.equal(catalog.cards[0].formulaId, parent.formulaId);
  } finally {
    source.db.close();
  }

  const destination = openStore(path.join(tempRoot, "catalog-destination"));
  try {
    const imported = destination.store.importFormulaCatalog(catalog, {
      actor: { id: 26, username: "BranchingGraphTester" }
    });
    assert.equal(imported.importedCards, 2);
    assert.equal(imported.dependenciesCreated, 1);
    const publicParent = destination.store.publicFormulaCardBySlug("import-a-parent");
    assert.deepEqual(
      publicParent.derivation.dependencies.map((item) => item.formulaId),
      ["formula.import.z-dependency"]
    );
    const second = destination.store.importFormulaCatalog(catalog, {
      actor: { id: 26, username: "BranchingGraphTester" }
    });
    assert.equal(Number(second.dependenciesCreated || 0), 0);
    assert.equal(destination.db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  } finally {
    destination.db.close();
  }
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-branching-graph-"));
  try {
    const { db, store } = openStore(path.join(tempRoot, "direct-data"));
    try {
      assert.ok(
        db
          .prepare(
            "SELECT 1 AS ok FROM schema_migrations WHERE id = '021_branching_derivation_graph'"
          )
          .get()?.ok
      );
      assert.ok(
        db
          .prepare(
            "SELECT 1 AS ok FROM schema_migrations WHERE id = '022_formula_revision_presentation_snapshot'"
          )
          .get()?.ok
      );
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");

      let shared = save(store, "formula.branch.shared");
      let middleA = save(store, "formula.branch.middle-a", [shared.formulaId]);
      let middleB = save(store, "formula.branch.middle-b", [shared.formulaId]);
      let root = save(store, "formula.branch.root", [
        middleA.formulaId,
        middleB.formulaId
      ]);
      shared = publish(store, shared);
      middleA = publish(store, middleA);
      middleB = publish(store, middleB);
      root = publish(store, root);

      assert.deepEqual(currentDependencies(db, root.formulaId), [
        middleA.formulaId,
        middleB.formulaId
      ]);
      assert.deepEqual(
        store
          .adminFormulaCard(shared.formulaId)
          .derivation.incoming.map((item) => item.formulaId)
          .sort(),
        [middleA.formulaId, middleB.formulaId].sort()
      );
      assert.deepEqual(
        store
          .publicFormulaCardBySlug(root.slug)
          .derivation.dependencies.map((item) => item.formulaId),
        [middleA.formulaId, middleB.formulaId]
      );
      const adminRootGraph = store.adminFormulaCard(root.formulaId).graph;
      assert.equal(adminRootGraph.mode, "current");
      assert.equal(adminRootGraph.currentNodeId, root.formulaId);
      assert.equal(
        adminRootGraph.nodes.find((node) => node.id === root.formulaId).rank,
        0
      );
      assert.ok(
        adminRootGraph.nodes.find((node) => node.id === shared.formulaId).rank > 0
      );
      const publicRootGraph = store.publicFormulaCardBySlug(root.slug).graph;
      assert.equal(publicRootGraph.mode, "published");
      assert.equal(publicRootGraph.currentNodeId, root.slug);
      assert.ok(
        publicRootGraph.nodes.every(
          (node) =>
            !Object.hasOwn(node, "formulaId") &&
            !Object.hasOwn(node, "revisionId") &&
            !Object.hasOwn(node, "publishStatus")
        )
      );
      assert.ok(
        publicRootGraph.edges.every(
          (edge) => !Object.hasOwn(edge, "provenance")
        )
      );

      const markdownRenderer = loadMarkdownRenderer();
      const dependencyHtml = markdownRenderer.render(
        `依赖 {{formula-ref:${middleA.slug}}}`,
        {
          formulaDependencies: [
            {
              referenceKey: middleA.slug,
              slug: middleA.slug,
              displayName: "分支 A",
              latex: middleA.latex,
              available: true
            }
          ],
          formulaDependencyMode: "public"
        }
      ).html;
      assert.match(dependencyHtml, /class="formula-dependency-ref"/);
      assert.match(
        dependencyHtml,
        new RegExp(`derive\\.html\\?formula=${middleA.slug}`)
      );
      assert.match(dependencyHtml, /分支 A/);
      assert.doesNotMatch(dependencyHtml, /formula\.branch\.middle-a/);
      assert.doesNotMatch(dependencyHtml, /\{\{formula-ref:/);
      const adminDependencyHtml = markdownRenderer.render(
        `依赖 {{formula-ref:${middleA.formulaId}}}`,
        {
          formulaDependencies: [
            {
              formulaId: middleA.formulaId,
              slug: middleA.slug,
              displayName: middleA.displayName,
              latex: middleA.latex,
              available: true
            }
          ],
          formulaDependencyMode: "admin"
        }
      ).html;
      assert.match(adminDependencyHtml, /formula\.branch\.middle-a/);
      const unavailableHtml = markdownRenderer.render(
        "{{formula-ref-unavailable}}",
        { formulaDependencyMode: "public" }
      ).html;
      assert.match(unavailableHtml, /依赖公式暂不可用/);
      assert.doesNotMatch(unavailableHtml, /formula\./);
      const rootBeforeLegacyRemove = store.adminFormulaCard(root.formulaId);
      assert.throws(
        () => store.saveFormulaDerivation(root.formulaId, { action: "remove" }),
        /多个分支|逐项编辑/
      );
      assert.equal(
        store.adminFormulaCard(root.formulaId).currentRevisionId,
        rootBeforeLegacyRemove.currentRevisionId
      );

      let removalTarget = save(store, "formula.remove.target");
      let removalSource = save(store, "formula.remove.source", [removalTarget.formulaId]);
      removalTarget = publish(store, removalTarget);
      removalSource = publish(store, removalSource);
      const removalRevisionId = removalSource.currentRevisionId;
      const removedNormal = store.saveFormulaDerivation(removalSource.formulaId, {
        action: "remove"
      });
      assert.notEqual(removedNormal.source.currentRevisionId, removalRevisionId);
      assert.deepEqual(removedNormal.source.derivation.dependencies, []);
      assert.equal(
        db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM formula_revision_dependencies
             WHERE revision_id = ?`
          )
          .get(removalRevisionId).count,
        1
      );
      assert.equal(
        store.publicFormulaCardBySlug(removalSource.slug).derivation.next.formulaId,
        removalTarget.formulaId
      );
      removalSource = publish(store, removedNormal.source);
      assert.equal(
        store.publicFormulaCardBySlug(removalSource.slug).derivation.next,
        null
      );

      const selfCard = save(store, "formula.reject.self");
      rejectionIsAtomic(
        store,
        db,
        selfCard.formulaId,
        () => save(store, selfCard.formulaId, [selfCard.formulaId]),
        /自身|self/i
      );

      const duplicateTarget = save(store, "formula.reject.duplicate-target");
      const duplicateCard = save(store, "formula.reject.duplicate");
      rejectionIsAtomic(
        store,
        db,
        duplicateCard.formulaId,
        () =>
          store.saveFormulaCard(
            formulaPayload(duplicateCard.formulaId, {
              markdownDerivation:
                "{{formula-ref:formula.reject.duplicate-target}}\n{{formula-ref:formula.reject.duplicate-target}}"
            })
          ),
        /重复|duplicate/i
      );

      const danglingCard = save(store, "formula.reject.dangling");
      rejectionIsAtomic(
        store,
        db,
        danglingCard.formulaId,
        () => save(store, danglingCard.formulaId, ["formula.reject.missing"]),
        /不存在|missing/i
      );

      let directA = save(store, "formula.reject.direct-a");
      let directB = save(store, "formula.reject.direct-b");
      directA = save(store, directA.formulaId, [directB.formulaId]);
      rejectionIsAtomic(
        store,
        db,
        directB.formulaId,
        () => save(store, directB.formulaId, [directA.formulaId]),
        /循环|cycle/i
      );

      const deepCycle = [];
      for (let index = 0; index < 9; index += 1) {
        deepCycle.push(save(store, `formula.reject.deep-${index}`));
      }
      for (let index = 0; index < deepCycle.length - 1; index += 1) {
        deepCycle[index] = save(store, deepCycle[index].formulaId, [deepCycle[index + 1].formulaId]);
      }
      rejectionIsAtomic(
        store,
        db,
        deepCycle.at(-1).formulaId,
        () => save(store, deepCycle.at(-1).formulaId, [deepCycle[0].formulaId]),
        /循环|cycle/i
      );

      let multiA = save(store, "formula.reject.multi-a");
      let multiB = save(store, "formula.reject.multi-b");
      let multiC = save(store, "formula.reject.multi-c");
      multiA = save(store, multiA.formulaId, [multiB.formulaId]);
      multiB = save(store, multiB.formulaId, [multiC.formulaId]);
      rejectionIsAtomic(
        store,
        db,
        multiC.formulaId,
        () => save(store, multiC.formulaId, [multiA.formulaId]),
        /循环|cycle/i
      );

      let pendingTarget = save(store, "formula.branch.pending-target", [], {
        latex: "draft_value=1"
      });
      const publishedBefore = store.publicFormulaCardBySlug(root.slug);
      root = save(store, root.formulaId, [middleA.formulaId, pendingTarget.formulaId], {
        latex: "root_pending=2",
        body: "## 待发布分支"
      });
      const currentRoot = store.adminFormulaCard(root.formulaId);
      assert.equal(currentRoot.pendingPublication, true);
      assert.deepEqual(
        currentRoot.derivation.dependencies.map((item) => item.formulaId),
        [middleA.formulaId, pendingTarget.formulaId]
      );
      assert.deepEqual(
        currentRoot.publishedDerivation.dependencies.map((item) => item.formulaId),
        [middleA.formulaId, middleB.formulaId]
      );
      const publicWhilePending = store.publicFormulaCardBySlug(root.slug);
      assert.equal(publicWhilePending.latex, publishedBefore.latex);
      assert.doesNotMatch(publicWhilePending.markdownDerivation, /待发布分支/);
      assert.deepEqual(
        publicWhilePending.derivation.dependencies.map((item) => item.formulaId),
        [middleA.formulaId, middleB.formulaId]
      );
      assert.ok(
        currentRoot.graph.nodes.some(
          (node) =>
            node.formulaId === pendingTarget.formulaId &&
            node.publishStatus === "draft"
        )
      );
      assert.equal(
        publicWhilePending.graph.nodes.some(
          (node) =>
            node.slug === pendingTarget.slug ||
            node.displayName === pendingTarget.displayName ||
            node.latex === pendingTarget.latex
        ),
        false
      );
      assert.throws(
        () => publish(store, root),
        /尚未发布|已归档|不能发布/
      );
      assert.equal(
        store.publicFormulaCardBySlug(root.slug).publishedRevisionId,
        publishedBefore.publishedRevisionId
      );

      pendingTarget = publish(store, pendingTarget);
      root = publish(store, root);
      assert.equal(store.publicFormulaCardBySlug(root.slug).latex, "root_pending=2");
      assert.deepEqual(
        store
          .publicFormulaCardBySlug(root.slug)
          .derivation.dependencies.map((item) => item.formulaId),
        [middleA.formulaId, pendingTarget.formulaId]
      );

      let archivedTarget = save(store, "formula.boundary.archived-target");
      let archivedSource = save(store, "formula.boundary.archived-source", [
        archivedTarget.formulaId
      ]);
      archivedTarget = publish(store, archivedTarget);
      archivedSource = publish(store, archivedSource);
      store.archiveFormulaCard(archivedTarget.formulaId, {
        id: 26,
        username: "BranchingGraphTester"
      });
      assert.equal(store.publicFormulaCardBySlug(archivedTarget.slug), null);
      const publicArchivedBoundary = store.publicFormulaCardBySlug(archivedSource.slug);
      assert.deepEqual(publicArchivedBoundary.derivation.dependencies, []);
      assert.equal(publicArchivedBoundary.derivation.unavailableDependencyCount, 1);
      assert.equal(
        publicArchivedBoundary.graph.nodes.some((node) => node.slug === archivedTarget.slug),
        false
      );

      let presentation = save(store, "formula.presentation.snapshot", [], {
        displayName: "已发布展示名称",
        body: "## 固定推导正文",
        latex: "presentation=1",
        purpose: "已发布用途",
        tags: ["state:published"]
      });
      presentation = publish(store, presentation);
      const publishedPresentationRevision = presentation.publishedRevisionId;
      presentation = save(store, presentation.formulaId, [], {
        displayName: "待发布展示名称 SECRET-PRESENTATION",
        body: "## 固定推导正文",
        latex: "presentation=1",
        purpose: "待发布用途",
        tags: ["state:pending"]
      });
      assert.notEqual(presentation.currentRevisionId, publishedPresentationRevision);
      assert.equal(presentation.pendingPublication, true);
      assert.equal(presentation.displayName, "待发布展示名称 SECRET-PRESENTATION");
      assert.deepEqual(presentation.tags, ["state:pending"]);
      const publicPresentationPending = store.publicFormulaCardBySlug(presentation.slug);
      assert.equal(publicPresentationPending.displayName, "已发布展示名称");
      assert.equal(publicPresentationPending.purpose, "已发布用途");
      assert.deepEqual(publicPresentationPending.tags, ["state:published"]);
      presentation = publish(store, presentation);
      const publicPresentationPublished = store.publicFormulaCardBySlug(presentation.slug);
      assert.equal(
        publicPresentationPublished.displayName,
        "待发布展示名称 SECRET-PRESENTATION"
      );
      assert.equal(publicPresentationPublished.purpose, "待发布用途");
      assert.deepEqual(publicPresentationPublished.tags, ["state:pending"]);

      assert.deepEqual(
        extractFormulaDependencyReferences(
          "`{{formula-ref:formula.ignored.code}}`\n$ {{formula-ref:formula.ignored.math}} $\n{{formula-ref:formula.branch.shared}}"
        ),
        ["formula.branch.shared"]
      );

      let largeTail = save(store, "formula.large.node-35");
      for (let index = 34; index >= 0; index -= 1) {
        largeTail = save(
          store,
          `formula.large.node-${String(index).padStart(2, "0")}`,
          [largeTail.formulaId]
        );
      }
      const largeGraph = store.adminFormulaCard(largeTail.formulaId).graph;
      assert.equal(largeGraph.nodes.length, 36);
      assert.equal(largeGraph.initialNodeIds.length, 24);
      assert.equal(largeGraph.limits.initialNodes, 24);
      assert.equal(largeGraph.limits.payloadNodes, 240);
      assert.equal(largeGraph.hiddenNodeCount, 12);
      assert.ok(largeGraph.expandableNodeIds.length > 0);
    } finally {
      db.close();
    }

    legacyMigrationChecks(tempRoot);
    revisionPresentationUpgradeChecks(tempRoot);
    catalogImportChecks(tempRoot);
    const postSource = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
    const deriveSource = fs.readFileSync(path.join(ROOT, "derive.html"), "utf8");
    const adminSource = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
    const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
    const graphSource = fs.readFileSync(path.join(ROOT, "formula-graph.js"), "utf8");
    const cytoscapeSource = fs.readFileSync(
      path.join(ROOT, "assets", "vendor", "cytoscape.min.js"),
      "utf8"
    );
    const cytoscapeLicense = fs.readFileSync(
      path.join(ROOT, "assets", "vendor", "cytoscape.LICENSE.txt"),
      "utf8"
    );
    assert.ok(
      postSource.indexOf("${renderFormulaGraphSection(card)}") <
        postSource.indexOf("${formulaRendered.html}")
    );
    assert.doesNotMatch(postSource, /\$\{renderFormulaDerivationSection\(card\)\}/);
    assert.match(deriveSource, /assets\/vendor\/cytoscape\.min\.js/);
    assert.match(deriveSource, /formula-graph\.js/);
    assert.match(serverSource, /"\/formula-graph\.js"/);
    assert.match(serverSource, /dependencySlugByFormulaId/);
    assert.match(serverSource, /referenceKey: reference\.slug/);
    assert.match(adminSource, /insertFormulaDependencyShortcode/);
    assert.match(adminSource, /formulaDependencyPreview/);
    assert.match(graphSource, /name: "breadthfirst"/);
    assert.match(graphSource, /visibleNodeCount/);
    assert.match(graphSource, /button\("collapse"/);
    assert.ok(cytoscapeSource.length > 400000);
    assert.match(cytoscapeLicense, /The Cytoscape Consortium/);
    assert.match(cytoscapeLicense, /Permission is hereby granted, free of charge/);
    console.log(
      "branching derivation graph checks passed: branches, merges, deep cycles, boundaries, reverse-topological import, and legacy promotion"
    );
  } finally {
    safeRemoveTemp(tempRoot);
  }
}

main();
