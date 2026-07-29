"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "admin/admin.css"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const formEnd = html.indexOf("</form>");
const drawerStart = html.indexOf('id="formulaAuthoringPopover"');
assert.ok(formEnd > 0 && drawerStart > formEnd, "formula drawer must remain outside the article form and Markdown scroll flow");
assert.match(html, /<aside class="formula-authoring-drawer is-collapsed" id="formulaAuthoringPopover"/);
assert.match(html, /id="openFormulaAuthoringButton"[\s\S]*aria-controls="formulaAuthoringDrawerBody"[\s\S]*aria-expanded="false"/);
assert.match(html, /id="formulaAuthoringQuickPreview"/);
assert.match(html, /id="formulaAuthoringWorkbenchButton"/);
assert.match(html, /id="returnToArticleFormulaButton"/);
assert.ok(
  html.indexOf('id="formulaCardEditor"') < drawerStart,
  "the complete formula workbench must not be embedded in the article drawer"
);

assert.match(js, /function captureFormulaEditorState\(\)/);
assert.match(js, /formulaAuthoringState\.sourceMarkdown = field\.value/);
assert.match(js, /formulaAuthoringState\.editorScrollTop = field\.scrollTop/);
assert.match(js, /formulaAuthoringState\.pageScrollY = window\.scrollY/);
assert.match(js, /lastValidSelection/);
assert.match(js, /openFormulaAuthoringButton\?\.addEventListener\("pointerdown"/);
assert.match(js, /event\.preventDefault\(\);[\s\S]*captured: captureFormulaEditorState\(\)/);
assert.match(js, /pendingSnapshot && performance\.now\(\) - pendingSnapshot\.capturedAt < 1500/);
assert.match(js, /function restoreFormulaPageScroll\(pageScrollY = formulaAuthoringState\.pageScrollY\)/);
assert.match(js, /window\.setTimeout\(restore, 190\)/);
assert.match(js, /function restoreFormulaEditorState\(options = \{\}\)/);
assert.match(js, /field\.value !== formulaAuthoringState\.sourceMarkdown/);
assert.match(js, /field\.setSelectionRange\(selectionStart, selectionEnd\)/);
assert.match(js, /field\.scrollTop = formulaAuthoringState\.editorScrollTop/);
assert.match(js, /function setFormulaDrawerExpanded\(expanded, options = \{\}\)/);
assert.match(js, /dashboard\.classList\.toggle\("is-formula-drawer-open"/);
assert.match(js, /function renderFormulaAuthoringQuickPreview\(card\)/);
assert.match(js, /card\.insertLatex \|\| card\.latex/);
assert.match(js, /待发布修改未进入此预览/);
assert.match(js, /function openFormulaWorkbenchFromArticle\(\)[\s\S]*saveDraft\(\)[\s\S]*window\.location\.hash = "formulas"/);
assert.match(js, /function returnToArticleFormula\(\)[\s\S]*contentForm\.markdown\.value !== snapshot\.sourceMarkdown/);
assert.match(js, /function returnToArticleFormula\(\)[\s\S]*loadFormulaAuthoringCatalog\(\{ selectDefault: true \}\)/);
assert.match(js, /const start = formulaAuthoringState\.selectionStart/);
assert.match(js, /const end = formulaAuthoringState\.selectionEnd/);
assert.doesNotMatch(js, /positionFormulaAuthoringPopover/);

assert.match(css, /\.formula-authoring-drawer\s*\{[\s\S]*position:\s*fixed/);
assert.match(css, /\.dashboard\.has-formula-authoring \.admin-main\s*\{[\s\S]*overflow-anchor:\s*none/);
assert.match(css, /\.formula-authoring-drawer\.is-collapsed\s*\{[\s\S]*width:\s*52px[\s\S]*height:\s*52px/);
assert.match(css, /@media \(min-width: 1181px\)[\s\S]*\.dashboard\.is-formula-drawer-open \.admin-main[\s\S]*padding-right:\s*432px/);
assert.match(css, /@media \(max-width: 1180px\)[\s\S]*padding-bottom:\s*calc\(min\(46vh, 430px\) \+ 76px\)/);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.formula-authoring-drawer[\s\S]*height:\s*min\(48vh, 405px\)/);
assert.match(css, /\[data-theme="dark"\] \.formula-authoring-drawer/);
assert.match(css, /\.formula-authoring-header-actions \.button\s*\{[\s\S]*font-size:\s*0/);
assert.doesNotMatch(css, /\.formula-authoring-popover/);

assert.equal(
  packageJson.scripts["test:formula-authoring-drawer"],
  "node scripts/test-formula-authoring-drawer.js"
);

console.log("formula authoring drawer checks passed: persistent entry, captured selection, quick preview, workbench return and responsive space");
