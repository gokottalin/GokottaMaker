"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const serverSource = source("server.js");
const pageSource = source("formula.html");
const pageScript = source("formula.js");
const graphSource = source("formula-graph.js");
const postSource = source("post.js");
const seoSource = source("lib/seo.js");

assert.ok(serverSource.includes('url.pathname.match(/^\\/formula\\/([^/]+)$/)'));
assert.match(serverSource, /servePermanentRedirect\(req, res, `\/formula\/\$\{encodeURIComponent\(formulaSlug\)\}`\)/);
assert.match(serverSource, /timingSafeEqual/);
assert.match(serverSource, /invalid continuation cursor/);
assert.match(pageSource, /id="formulaContent"/);
assert.match(pageSource, /styles\/40-formula\.css/);
assert.match(pageScript, /location\.pathname\.match\(\/\^\\\/formula/);
assert.match(postSource, /canonicalPath:\s*absoluteUrl\(`\/formula\//);
assert.match(postSource, /hrefPrefix:\s*"\/formula\/"/);
assert.match(postSource, /formulaRelationsHtml/);
assert.match(graphSource, /loadContinuation/);
assert.match(seoSource, /allFormulas/);

function payload(index, targetFormulaId = "") {
  return validateFormulaCardPayload({
    formulaId: `formula.s59.${String(index).padStart(3, "0")}`,
    slug: `s59-${String(index).padStart(3, "0")}`,
    displayName: `S59 公式 ${index}`,
    moduleKey: "power-electronics",
    categoryPath: "S59/详情页",
    purpose: index % 2 ? "" : "验证公式独立页",
    tags: index % 2 ? [] : ["topic:S59"],
    latex: `F_{${index}}=${index}`,
    markdownDerivation: targetFormulaId ? `{{formula-ref:${targetFormulaId}}}` : "",
    revisionReason: "S59 isolated fixture"
  });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s59-"));
const dbDir = path.join(tempRoot, "database");
const db = createDatabase({ root: ROOT, dataDir: tempRoot, dbDir, dbPath: path.join(dbDir, "isolated.sqlite"), uploadDir: path.join(tempRoot, "uploads") });
const store = createContentStore(db);
try {
  let target = "";
  const cards = [];
  for (let index = 244; index >= 0; index -= 1) {
    const saved = store.saveFormulaCard(payload(index, target)).card;
    cards.push(saved);
    target = saved.formulaId;
  }
  for (const card of cards) store.publishFormulaCard(card.formulaId);

  const first = store.publicFormulaCardBySlug("s59-000");
  assert.equal(first.graph.nodes.length, 240);
  assert.equal(first.graph.truncated, true);
  const continued = store.publicFormulaCardBySlug("s59-000", { payloadNodeLimit: 480 });
  assert.equal(continued.graph.nodes.length, 245);
  assert.equal(continued.graph.truncated, false);
  assert.equal(continued.graph.edges.length, 244);

  const draft = store.saveFormulaCard(payload(900)).card;
  assert.equal(store.publicFormulaCardBySlug(draft.slug), null);
  store.publishFormulaCard(draft.formulaId);
  assert.ok(store.publicFormulaCardBySlug(draft.slug));
  store.archiveFormulaCard(draft.formulaId);
  assert.equal(store.publicFormulaCardBySlug(draft.slug), null);
} finally {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Formula detail page checks passed: canonical route, shared rendering, publication privacy, signed cursor gates, and 245-node continuation.");
