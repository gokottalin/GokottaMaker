"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createContentStore } = require("../lib/content");
const { createDatabase, runMigrations } = require("../lib/db");
const { validateFormulaContentBindingPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");

function openFixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-binding-authority-"));
  const dbDir = path.join(dataDir, "database");
  const dbPath = path.join(dbDir, "fixture.sqlite");
  const db = createDatabase({
    root: ROOT,
    dataDir,
    dbDir,
    dbPath,
    uploadDir: path.join(dataDir, "uploads")
  });
  return { dataDir, dbPath, db };
}

function removeFixture(dataDir) {
  const resolved = path.resolve(dataDir);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolved), /^larkix-formula-binding-authority-/);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}

function seedFormula(db, formulaId, revisionId) {
  const slug = formulaId.replace(/^formula\./, "").replaceAll(".", "-");
  db.prepare(`
    INSERT INTO formula_cards
      (formula_id, slug, display_name, module_key, category_path, purpose,
       publish_status, current_revision_id, published_revision_id)
    VALUES (?, ?, ?, 'power-electronics', 'S47/fixture', '', 'draft', NULL, NULL)
  `).run(formulaId, slug, formulaId);
  db.prepare(`
    INSERT INTO formula_revisions
      (revision_id, formula_id, sequence_no, latex, markdown_derivation,
       display_name, module_key, category_path, purpose, tags_json,
       revision_reason, actor_username)
    VALUES (?, ?, 1, ?, '', ?, 'power-electronics', 'S47/fixture', '', '[]',
            's47-fixture', 'S47Fixture')
  `).run(revisionId, formulaId, `${slug}=1`, formulaId);
  db.prepare("UPDATE formula_cards SET current_revision_id = ? WHERE formula_id = ?")
    .run(revisionId, formulaId);
}

function seedPost(db, id) {
  db.prepare(`
    INSERT INTO posts
      (id, slug, title, category, category_key, excerpt, cover, markdown,
       read_time, date, publish_status, featured, featured_order, tags)
    VALUES (?, ?, ?, '电源设计', 'power-electronics', '', '', '', '1 分钟',
            '2026-08-13', 'draft', 0, 0, '')
  `).run(id, id, id);
}

function tableCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}

function freshSchemaChecks() {
  const fixture = openFixture();
  try {
    assert.ok(dbHasMigration(fixture.db, "028_formula_content_bindings"));
    assert.equal(tableCount(fixture.db, "formula_content_bindings"), 0);
    assert.equal(tableCount(fixture.db, "formula_content_binding_sources"), 0);
  } finally {
    fixture.db.close();
    removeFixture(fixture.dataDir);
  }
}

function dbHasMigration(db, id) {
  return Boolean(db.prepare("SELECT 1 AS present FROM schema_migrations WHERE id = ?").get(id));
}

function legacyAndAuthorityChecks() {
  const fixture = openFixture();
  try {
    const { db } = fixture;
    seedFormula(db, "formula.s47.source", "rev.s47.source.1");
    seedFormula(db, "formula.s47.target", "rev.s47.target.1");
    seedFormula(db, "formula.s47.leaf", "rev.s47.leaf.1");
    seedPost(db, "post-s47-a");
    seedPost(db, "post-s47-b");

    db.prepare(`
      INSERT INTO article_formula_bindings
        (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
      VALUES (?, ?, 'formula.s47.target', 'rev.s47.target.1', 'display', 0)
    `).run("binding.s47.a", "post-s47-a");
    db.prepare(`
      INSERT INTO article_formula_bindings
        (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
      VALUES (?, ?, 'formula.s47.target', 'rev.s47.target.1', 'inline', 0)
    `).run("binding.s47.b", "post-s47-b");
    db.prepare(`
      INSERT INTO article_formula_bindings
        (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
      VALUES ('binding.s47.a.second', 'post-s47-a', 'formula.s47.target',
              'rev.s47.target.1', 'inline', 1)
    `).run();
    db.prepare(`
      INSERT INTO formula_revision_dependencies
        (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
      VALUES ('rev.s47.source.1', 'formula.s47.source', 'formula.s47.target', 0, 'markdown')
    `).run();
    db.prepare(`
      INSERT INTO formula_derivation_edges
        (source_formula_id, target_formula_id, actor_username)
      VALUES ('formula.s47.source', 'formula.s47.target', 'S47Fixture')
    `).run();

    db.prepare("DELETE FROM schema_migrations WHERE id = '028_formula_content_bindings'").run();
    db.exec("DROP TRIGGER IF EXISTS formula_content_binding_sources_immutable_delete");
    db.exec("DELETE FROM formula_content_binding_sources; DELETE FROM formula_content_bindings;");
    runMigrations(db, ROOT);

    assert.equal(tableCount(db, "formula_content_bindings"), 3);
    assert.equal(tableCount(db, "formula_content_binding_sources"), 5);
    assert.equal(
      tableCount(db, "article_formula_bindings"),
      3,
      "migration must preserve legacy article bindings"
    );
    assert.equal(
      tableCount(db, "formula_revision_dependencies"),
      1,
      "migration must preserve formula dependencies"
    );
    assert.equal(
      db.prepare(`
        SELECT COUNT(*) AS count FROM formula_content_bindings
        WHERE source_kind = 'article' AND target_formula_id = 'formula.s47.target'
      `).get().count,
      2,
      "multiple articles remain separate authorities"
    );
    const repeatedArticle = db.prepare(`
      SELECT location_json AS locationJson FROM formula_content_bindings
      WHERE source_kind = 'article' AND source_id = 'post-s47-a'
        AND target_formula_id = 'formula.s47.target'
    `).get();
    assert.equal(JSON.parse(repeatedArticle.locationJson).references.length, 2);
    assert.equal(
      db.prepare(`
        SELECT COUNT(*) AS count FROM formula_content_bindings
        WHERE source_kind = 'formula_revision'
          AND source_id = 'rev.s47.source.1'
          AND target_formula_id = 'formula.s47.target'
      `).get().count,
      1,
      "revision dependency and legacy edge deduplicate to one authority"
    );

    const before = {
      bindings: tableCount(db, "formula_content_bindings"),
      sources: tableCount(db, "formula_content_binding_sources")
    };
    const migration = require("../migrations/028_formula_content_bindings");
    migration.up(db);
    assert.deepEqual(
      {
        bindings: tableCount(db, "formula_content_bindings"),
        sources: tableCount(db, "formula_content_binding_sources")
      },
      before,
      "migration up must be idempotent"
    );

    const store = createContentStore(db);
    const articleAuthority = validateFormulaContentBindingPayload({
      sourceKind: "article",
      sourceId: "post-s47-a",
      bindings: [
        {
          targetFormulaId: "formula.s47.target",
          displayMode: "display",
          ordinal: 0,
          locations: [
            {
              bindingId: "binding.s47.a",
              revisionId: "rev.s47.target.1",
              displayMode: "display",
              ordinal: 0
            },
            {
              bindingId: "binding.s47.a.second",
              revisionId: "rev.s47.target.1",
              displayMode: "inline",
              ordinal: 1
            }
          ]
        },
        {
          targetFormulaId: "formula.s47.leaf",
          targetRevisionId: "rev.s47.leaf.1",
          displayMode: "inline",
          ordinal: 2
        }
      ]
    });
    assert.equal(store.saveFormulaContentBindings(articleAuthority).length, 2);
    assert.equal(store.formulaContentBindingsForTarget("formula.s47.target").length, 3);
    const reducedArticleAuthority = validateFormulaContentBindingPayload({
      ...articleAuthority,
      bindings: articleAuthority.bindings.slice(0, 1)
    });
    assert.equal(store.saveFormulaContentBindings(reducedArticleAuthority).length, 1);
    assert.equal(
      store.formulaContentBindingsForSource("article", "post-s47-a", { includeRetired: true })
        .filter((binding) => binding.lifecycleStatus === "retired").length,
      1,
      "removed semantic relations must be retired rather than deleted"
    );
    assert.throws(
      () => validateFormulaContentBindingPayload({
        sourceKind: "article",
        sourceId: "post-s47-a",
        bindings: [
          { targetFormulaId: "formula.s47.target" },
          { targetFormulaId: "formula.s47.target" }
        ]
      }),
      /重复绑定公式/
    );
    assert.throws(
      () => db.prepare(`
        DELETE FROM formula_content_bindings
        WHERE binding_id = (SELECT binding_id FROM formula_content_bindings ORDER BY binding_id LIMIT 1)
      `).run(),
      /retired instead of deleted/
    );

    assert.throws(
      () => db.prepare(`
        INSERT INTO formula_content_bindings
          (binding_id, source_kind, source_id, source_formula_id,
           target_formula_id, display_mode, ordinal)
        VALUES ('fbind.self', 'formula_revision', 'rev.s47.source.1',
                'formula.s47.source', 'formula.s47.source', 'display', 1)
      `).run(),
      /self-reference/
    );

    db.prepare(`
      INSERT INTO formula_content_bindings
        (binding_id, source_kind, source_id, source_formula_id,
         target_formula_id, display_mode, ordinal)
      VALUES ('fbind.branch', 'formula_revision', 'rev.s47.target.1',
              'formula.s47.target', 'formula.s47.leaf', 'display', 0)
    `).run();
    assert.throws(
      () => store.saveFormulaContentBindings(validateFormulaContentBindingPayload({
        sourceKind: "formula_revision",
        sourceId: "rev.s47.leaf.1",
        sourceFormulaId: "formula.s47.leaf",
        bindings: [{ targetFormulaId: "formula.s47.source", displayMode: "display" }]
      })),
      /cycle/
    );

    db.prepare(`
      INSERT INTO formula_content_bindings
        (binding_id, source_kind, source_id, target_formula_id,
         target_revision_id, display_mode, ordinal)
      VALUES ('fbind.article-no-dag', 'article', 'post-s47-a',
              'formula.s47.source', 'rev.s47.source.1', 'inline', 1)
    `).run();
    assert.ok(
      db.prepare("SELECT 1 AS present FROM formula_content_bindings WHERE binding_id = 'fbind.article-no-dag'").get(),
      "article references must stay outside formula DAG checks"
    );

    const backupPath = path.join(fixture.dataDir, "binding-authority.backup.sqlite");
    db.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
    assert.ok(fs.statSync(backupPath).size > 0, "isolated pre-change backup must be non-empty");
    const { DatabaseSync } = require("node:sqlite");
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    try {
      assert.equal(tableCount(backup, "article_formula_bindings"), 3);
      assert.equal(tableCount(backup, "formula_revision_dependencies"), 1);
      assert.equal(tableCount(backup, "formula_content_bindings"), 6);
    } finally {
      backup.close();
    }
  } finally {
    fixture.db.close();
    removeFixture(fixture.dataDir);
  }
}

freshSchemaChecks();
legacyAndAuthorityChecks();
console.log("Formula binding authority checks passed: fresh schema, legacy dedupe, DAG, idempotency, backup, and source preservation.");
