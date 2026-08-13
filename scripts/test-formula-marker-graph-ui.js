"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const katex = require("katex");

const ROOT = path.resolve(__dirname, "..");

function loadMarkdown() {
  const sandbox = { window: { katex } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "math-renderer.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "markdown-renderer.js"), "utf8"), sandbox);
  return sandbox.window.LarkixMarkdown;
}

function loadGraph() {
  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "formula-graph.js"), "utf8"), sandbox);
  return sandbox.LarkixFormulaGraph;
}

const markdown = loadMarkdown();
const graph = loadGraph();
const binding = {
  bindingId: "bind.s49.complex",
  formulaId: "formula.s49.complex",
  revisionId: "rev.s49.complex",
  displayMode: "display",
  slug: "s49-complex",
  displayName: "复杂纹波公式",
  latex: "\\boxed{\\Delta I_L=\\frac{V_{in}D}{L f_s}}",
  archiveState: "active"
};
const rendered = markdown.render(
  `$$\n\\boxed{\\Delta I_L=\\frac{V_{in}D}{L f_s}}\n$$\n{{formula:bind.s49.complex|formula.s49.complex|rev.s49.complex|display}}`,
  { formulaBindings: [binding] }
);

assert.equal((rendered.html.match(/class="formula-binding-marker /g) || []).length, 1);
assert.match(rendered.html, /title="复杂纹波公式详细推导"/);
assert.match(rendered.html, /aria-label="查看 复杂纹波公式详细推导"/);
assert.doesNotMatch(rendered.html, /formula-reference-meta/);
assert.equal((rendered.html.match(/formula-binding-marker__label/g) || []).length, 1);

assert.equal(
  graph.hrefForNode({ nodeType: "formula", slug: "boost-duty" }),
  "./derive.html?formula=boost-duty"
);
assert.equal(
  graph.hrefForNode({ nodeType: "article", slug: "boost-design", route: "./post.html?id=boost-design" }),
  "./post.html?id=boost-design"
);
assert.equal(
  graph.hrefForNode(
    { nodeType: "article", postId: "post-private-id", slug: "boost-design", route: "./post.html?id=boost-design" },
    { articleHrefPrefix: "/post.html?id=" }
  ),
  "/post.html?id=post-private-id"
);
assert.equal(
  graph.hrefForNode(
    { nodeType: "article", slug: "boost-design" },
    { articleHrefPrefix: "/post.html?id=" }
  ),
  "/post.html?id=boost-design"
);

const graphSource = fs.readFileSync(path.join(ROOT, "formula-graph.js"), "utf8");
const publicSource = fs.readFileSync(path.join(ROOT, "post.js"), "utf8");
const publicCss = fs.readFileSync(path.join(ROOT, "derive.html"), "utf8");
const adminSource = fs.readFileSync(path.join(ROOT, "admin", "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(ROOT, "admin", "admin.css"), "utf8");

assert.match(graphSource, /dataset\.nodeType/);
assert.match(graphSource, /formula-graph-node-kind/);
assert.match(graphSource, /formula-graph-node-state/);
assert.match(graphSource, /is-article-summary/);
assert.doesNotMatch(graphSource, /formula-binding-marker/);
assert.doesNotMatch(publicSource, /\$\{renderFormulaDerivationSection\(card\)\}/);
assert.match(adminSource, /node\?\.nodeType === "formula"/);
assert.match(adminSource, /articleHrefPrefix:\s*"\/post\.html\?id="/);
assert.match(adminSource, /window\.open\(href/);
for (const css of [publicCss, adminCss]) {
  assert.match(css, /\.formula-graph-node\.is-article/);
  assert.match(css, /\.formula-graph-node-kind/);
  assert.match(css, /\.formula-graph-node-state/);
  assert.match(css, /\.formula-graph-node-math\.is-article-summary/);
}

console.log(
  "Formula marker and graph UI checks passed: one marker, exact accessible target, duplicate removal, typed routes, and CMS-only editing behavior."
);
