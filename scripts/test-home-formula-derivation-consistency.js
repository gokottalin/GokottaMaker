"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requirement = JSON.parse(read("docs/codex-workline/requirements/active/REQ-20260915-001.json"));
const index = read("index.html");
const main = read("main.js");
const search = read("search.js");
const formulaHtml = read("formula.html");
const formula = read("formula.js");
const graph = read("formula-graph.js");
const server = read("server.js");
const contentCss = read("styles/20-content.css");
const formulaCss = read("styles/40-formula.css");
const responsiveCss = read("styles/40-responsive.css");

assert.equal(requirement.status, "dispatched");
assert.equal(requirement.confirmation.confirmed, true);
assert.equal(requirement.confirmation.digest, "sha256:3245ca525ff7af0a418b25f88e56b1b9cd517285743259347c0eba8a74f50df9");
assert.equal(requirement.openQuestions.length, 0);
assert.equal(requirement.assumptions.length, 0);
assert.equal(requirement.acceptanceCriteria.length, 12);

assert.match(main, /ensureHomeFormulaRenderer[\s\S]*katex\.min\.js[\s\S]*math-renderer\.js/, "Maker home loads the established renderer before formula cards");
assert.match(main, /data-formula-id="\$\{html\(item\.formulaId \|\| item\.id/, "homepage retains the complete public formula identity");
assert.match(main, /data-formula-source=/, "homepage retains the source used by the public formula cover");
assert.match(main, /Math\.min\(1, availableWidth \/ width, availableHeight \/ height\)/, "homepage formula covers fit on both axes");
assert.match(main, /公式暂不可显示/, "homepage has a visible formula-render fallback");
assert.match(search, /data-formula-id=/, "search and homepage cards preserve the same public formula identity");
assert.match(search, /公式暂不可显示/, "search and homepage use the same visible fallback language");

for (const source of [index, main]) {
  assert.match(source, /home-search-clear/, "homepage search has a conditional clear control");
  assert.match(source, /home-search-submit/, "homepage search has an icon submit control");
  assert.match(source, /input\.focus\(\)|search\.focus\(\)/, "clear keeps focus in the search field");
}
assert.doesNotMatch(index, />搜索<\/button>/, "landing page has no textual search button");
assert.doesNotMatch(main, /button\.textContent\s*=\s*"搜索"/, "Maker page has no textual search button");
assert.match(main, /\.\/search\.html\$\{query \? `\?q=\$\{encodeURIComponent\(query\)\}`/, "Enter and icon submit share the existing search route");

for (const view of ["formula", "derivation"]) {
  assert.match(formulaHtml, new RegExp(`data-formula-view="${view}"`), `${view} tab exists`);
}
assert.match(formula, /requested[\s\S]*\? requested : "formula"/, "plain formula entry defaults to formula view");
assert.match(formula, /history\.pushState/, "view and root changes create browser history entries");
assert.match(formula, /addEventListener\("popstate"/, "history navigation restores URL view state");
assert.match(formula, /data-open-derivation/, "formula view exposes the derivation entry");
assert.match(formula, /formulaCardHtml\(card\)/, "formula view renders exactly the public discovery-style card");
assert.doesNotMatch(formula, /markdownDerivation|renderFormulaCard\(/, "formula view does not render full Markdown detail");
assert.match(formula, /暂无上游依赖/, "root-only graphs have an explicit empty-upstream state");
assert.match(formula, /destroyGraph\(\)[\s\S]*_formulaGraph\?\.destroy/, "old graph instances are destroyed before root/view replacement");
assert.match(formula, /navigate\(slug, "formula", true\)/, "formula graph node clicks switch to the selected formula root");
assert.match(graph, /options\.onNavigate\(hrefFor\(node\), String\(node\.slug\), node\)/, "graph navigation exposes node type without changing public href semantics");
assert.equal((server.match(/"\/assets\/vendor\/cytoscape\.min\.js"/g) || []).length, 2, "Cytoscape is admitted by exactly the general and focus-mode file allowlists");
assert.match(server, /const publicStaticFiles = new Set\([\s\S]*"\/assets\/vendor\/cytoscape\.min\.js"/, "general static allowlist contains the exact Cytoscape file");
assert.match(server, /const focusModePublicAssetFiles = new Set\([\s\S]*"\/assets\/vendor\/cytoscape\.min\.js"/, "focus-mode asset allowlist contains the same exact Cytoscape file");

assert.match(contentCss, /\.home-miniapp-grid > \.home-miniapp-card[\s\S]*var\(--public-card-bg\)[\s\S]*var\(--public-card-shadow\)/, "homepage miniapps use shared card tokens");
assert.match(contentCss, /\.home-miniapp-card:hover[\s\S]*translateY/, "homepage miniapps retain visible hover feedback");
assert.match(responsiveCss, /@media \(min-width: 761px\)[\s\S]*home-miniapp-grid[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, "desktop miniapps remain equal-width in one row");
assert.match(responsiveCss, /@media \(max-width: 760px\)[\s\S]*home-miniapp-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/, "mobile miniapps become one full-width column");
assert.doesNotMatch(formulaCss, /text-overflow:\s*ellipsis/, "formula and graph math are never ellipsized");

console.log("S68 static checks passed: 12 acceptance contracts, homepage card/search parity, responsive miniapps and persistent formula/derivation views");
