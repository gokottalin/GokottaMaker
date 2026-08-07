const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const katex = require("katex");

const ROOT = path.join(__dirname, "..");

function loadRenderer() {
  const sandbox = { window: { katex } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "math-renderer.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "markdown-renderer.js"), "utf8"), sandbox);
  return sandbox.window.LarkixMarkdown;
}

function count(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

const renderer = loadRenderer();
const inlineBindings = [
  {
    bindingId: "bind.a",
    formulaId: "formula.a",
    revisionId: "rev.a",
    displayMode: "inline",
    slug: "formula-a",
    displayName: "占空比公式",
    latex: "D_{database}",
    archiveState: "active"
  },
  {
    bindingId: "bind.b",
    formulaId: "formula.b",
    revisionId: "rev.b",
    displayMode: "inline",
    slug: "formula-b",
    displayName: "电感纹波公式",
    latex: "I_{database}",
    archiveState: "active"
  }
];

const inline = renderer.render(
  `绑定 $D_{author}=1-\\frac{V_{in}}{V_{out}}$ {{formula:bind.a|formula.a|rev.a|inline}} 和 $\\Delta I_{L,author}$ {{formula:bind.b|formula.b|rev.b|inline}}；普通 $f_s^2$。`,
  { formulaBindings: inlineBindings }
);
assert.equal(count(inline.html, /class="formula-binding-marker /g), 2);
assert.equal(count(inline.html, /data-formula-binding-id=/g), 2);
assert.match(inline.html, /D_\{author\}/);
assert.match(inline.html, /\\Delta I_\{L,author\}/);
assert.doesNotMatch(inline.html, /D_\{database\}|I_\{database\}/);
assert.match(inline.html, /title="占空比公式详细推导"/);
assert.match(inline.html, /title="电感纹波公式详细推导"/);
assert.match(inline.html, /aria-label="查看 占空比公式详细推导"/);
assert.match(inline.html, /href="\.\/derive\.html\?formula=formula-a"/);
assert.equal(count(renderer.render("普通 $x_i^2$。").html, /formula-binding-marker/g), 0);

const displayBinding = {
  bindingId: "bind.display",
  formulaId: "formula.display",
  revisionId: "rev.display",
  displayMode: "display",
  slug: "formula-display",
  displayName: "BOOST 电感公式",
  latex: "L_{database}",
  archiveState: "active"
};
const display = renderer.render(
  `$$
\\boxed{L_{author}=\\frac{V_{in}D}{\\Delta I_L f_s}}
$$
{{formula:bind.display|formula.display|rev.display|display}}`,
  { formulaBindings: [displayBinding] }
);
assert.equal(count(display.html, /markdown-math markdown-math-display/g), 1);
assert.equal(count(display.html, /class="formula-binding-marker /g), 1);
assert.match(
  display.html,
  /class="markdown-math markdown-math-display[\s\S]*class="formula-binding-marker formula-binding-marker--display"[\s\S]*<\/div>/
);
assert.match(display.html, /L_\{author\}/);
assert.doesNotMatch(display.html, /L_\{database\}/);

const legacy = renderer.render("历史 {{formula:bind.a|formula.a|rev.a|inline}}", {
  formulaBindings: inlineBindings
});
assert.equal(count(legacy.html, /markdown-math-inline/g), 1);
assert.equal(count(legacy.html, /class="formula-binding-marker /g), 1);
assert.match(legacy.html, /D_\{database\}/);

const unresolved = renderer.render(
  `$x_{source}$ {{formula:bind.missing|formula.missing|rev.missing|inline}}`,
  { formulaBindings: [] }
);
assert.match(unresolved.html, /x_\{source\}/);
assert.equal(count(unresolved.html, /formula-binding-marker/g), 0);

const css = fs.readFileSync(path.join(ROOT, "styles", "26-inline-math.css"), "utf8");
assert.match(css, /\.formula-binding-marker\s*\{/);
assert.match(css, /border-radius:\s*50%/);
assert.match(css, /inset-block-start:\s*-0\.62em/);
assert.match(css, /\.markdown-math-display > \.formula-binding-marker--display/);
assert.match(css, /\.formula-binding-marker:focus-visible/);

console.log("Formula binding marker fixtures passed: bound-only, source-preserving, inline/display, legacy, tooltip and keyboard styles.");
