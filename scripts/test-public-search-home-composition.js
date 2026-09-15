"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const maker = read("maker.html");
const searchHtml = read("search.html");
const searchJs = read("search.js");
const main = read("main.js");
const contentCss = read("styles/20-content.css");
const formulaCss = read("styles/40-formula.css");
const responsiveCss = read("styles/40-responsive.css");

assert.match(index, /<form class="home-search-route" action="\.\/search\.html"[^>]*method="get"/, "landing search routes to the independent page");
assert.match(maker, /id="siteSearch"/, "Maker home retains its established search field");
assert.match(main, /function bindHomepageSearchRoute[\s\S]*\.\/search\.html/, "Maker search routes to the independent page");

for (const type of ["article", "project", "derivation", "formula", "miniapp"]) {
  assert.match(searchHtml, new RegExp(`data-search-type="${type}"`), `${type} tab is present`);
}
assert.doesNotMatch(searchHtml, /data-search-type="(?:all|combined)"/, "there is no combined search tab");
assert.match(searchJs, /state = \{ type: "article"/, "article is the default type");
assert.match(searchJs, /addEventListener\("input"[\s\S]*setTimeout\(\(\) => runSearch/, "one-character live search is debounced");
assert.match(searchJs, /new AbortController\(\)/, "previous requests are cancellable");
assert.match(searchJs, /request !== state\.request/, "stale responses cannot overwrite current results");
assert.match(searchJs, /\.\/api\/public\/search\?/, "the S63 public search authority is consumed directly");
for (const sort of ["comprehensive", "views", "newest", "common-level"]) {
  assert.match(searchHtml, new RegExp(`value="${sort}"`), `${sort} sort is exposed`);
}
assert.match(searchJs, /durationMin/, "applicable duration filters are delegated to the authority API");
assert.match(searchJs, /date: state\.date/, "date filter is delegated to the authority API");
assert.match(searchJs, /value\.set\("category", state\.category\)/, "category filter is delegated to the authority API");
assert.doesNotMatch(searchJs, /item\.commonLevel|commonLevel\s*[:=]/, "internal common levels are not rendered or copied into local ranking");
assert.match(searchJs, /aria-label="浏览量 \$\{count\} 次"/, "cards expose an exact accessible view count");
assert.match(searchJs, /function compactViews/, "cards expose a compact visible view count");
assert.match(searchJs, /durationMinutes/, "article and project duration metadata is rendered when available");
assert.match(searchJs, /window\.LarkixMath\?\.render/, "formula conclusions use the public math renderer");
assert.match(searchJs, /Math\.min\(1, availableWidth \/ width, availableHeight \/ height\)/, "formula conclusions fit on both axes without a clipping floor");
assert.match(formulaCss, /width:\s*max-content[\s\S]*white-space:\s*nowrap/, "formula conclusions are retained as complete content before fitting");
assert.doesNotMatch(formulaCss, /text-overflow:\s*ellipsis/, "formula conclusions are not ellipsized");

assert.match(main, /\.\/api\/public\/home-discovery/, "homepage consumes the S63 discovery authority");
assert.match(main, /latestFormulas\.slice\(0, 8\)/, "homepage caps latest formulas at eight");
assert.match(main, /focusSlots\.map[\s\S]*articleMap\.get[\s\S]*return article \? focusedArticleCard\(slot, article\) : ""/, "invalid focus slots are hidden without substitutes");
assert.match(main, /recommended\.querySelector\("\.home-focus-layout"\)[\s\S]*focusSlots\.map/, "focus cards render into the renamed live layout rather than a stale selector");
assert.match(main, /homeDiscoveryRequest[\s\S]*request !== homeDiscoveryRequest/, "stale homepage discovery responses are ignored");
assert.match(main, /safePublicRoute/, "dynamic card routes are constrained to same-origin public paths");
assert.doesNotMatch(main, /commonLevel/, "homepage presentation does not expose internal levels");
assert.match(contentCss, /\.home-focus-layout[\s\S]*grid-template:[\s\S]*large small-1[\s\S]*large small-2/, "focus slots retain their fixed composition");
assert.match(responsiveCss, /@media \(max-width: 760px\)[\s\S]*\.home-focus-layout[\s\S]*grid-template-columns:\s*1fr/, "focus and search layouts collapse on narrow screens");

console.log("S65 public search/home static checks passed: authority-backed five-type search, stale-response guards, accessible cards, complete formulas, exact focus semantics and responsive composition");
