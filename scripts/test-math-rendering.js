"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const katex = require("katex");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function loadRenderers() {
  const sandbox = { window: { katex } };
  vm.createContext(sandbox);
  vm.runInContext(read("data/math-renderer.js"), sandbox);
  vm.runInContext(read("data/markdown-renderer.js"), sandbox);
  return {
    math: sandbox.window.LarkixMath,
    markdown: sandbox.window.LarkixMarkdown
  };
}

const { math, markdown } = loadRenderers();

assert.equal(math.ENGINE, "KaTeX");
assert.equal(math.VERSION, "0.16.22");

for (const fixture of [
  String.raw`V_{in}^{2}`,
  String.raw`\sqrt{a+\frac{b}{c}}+d`,
  String.raw`\int_{0}^{T_s}\frac{v_L(t)}{L}\,\mathrm{d}t`,
  String.raw`\frac{1}{1+\frac{a}{b}}`,
  String.raw`\boxed{D=1-\frac{V_{in}}{V_{out}}}`
]) {
  const result = math.render(fixture, { displayMode: true });
  assert.equal(result.valid, true, fixture);
  assert.equal(result.blocking, false, fixture);
  assert.match(result.html, /class="katex"/, fixture);
  assert.match(result.html, /class="katex-mathml"/, fixture);
}

assert.match(math.render(String.raw`\frac{a}{b}`).html, /\bmfrac\b/);
assert.match(math.render(String.raw`\sqrt{x}`).html, /\bsqrt\b/);
assert.match(math.render(String.raw`\int_0^1 x\,\mathrm{d}x`).html, /∫/);
assert.match(math.render(String.raw`\boxed{x}`).html, /\bfbox\b/);

const invalidBrace = math.validate(String.raw`\frac{1}{`);
assert.equal(invalidBrace.valid, false);
assert.equal(invalidBrace.blocking, true);
assert.equal(invalidBrace.diagnostics[0].code, "math.syntax.invalid");
assert.ok(invalidBrace.diagnostics[0].range.line >= 1);
assert.ok(invalidBrace.diagnostics[0].range.column >= 1);

const invalidDelimiter = math.validate(String.raw`\[x+1`);
assert.equal(invalidDelimiter.valid, false);
assert.equal(invalidDelimiter.diagnostics[0].code, "math.delimiter.unmatched");

const markdownResult = markdown.render(String.raw`
行内公式 $V_{in}^{2}$。

$$
\boxed{D=1-\frac{V_{in}}{V_{out}}}
$$
`);
assert.equal(markdownResult.valid, true);
assert.equal(markdownResult.canPublish, true);
assert.deepEqual(Array.from(markdownResult.diagnostics), []);
assert.match(markdownResult.html, /markdown-math-inline/);
assert.match(markdownResult.html, /markdown-math-display is-boxed/);

const blocked = markdown.render("$$\n\\frac{1}{2}");
assert.equal(blocked.valid, false);
assert.equal(blocked.canPublish, false);
assert.equal(blocked.diagnostics[0].blocking, true);
assert.match(blocked.html, /公式暂不可用/);
assert.doesNotMatch(blocked.html, /\\frac/);

for (const page of ["post.html", "project.html", "derive.html"]) {
  const html = read(page);
  const katexIndex = html.indexOf("katex.min.js");
  const mathIndex = html.indexOf("data/math-renderer.js");
  const markdownIndex = html.indexOf("data/markdown-renderer.js");
  assert.ok(katexIndex >= 0, `${page} loads local KaTeX`);
  assert.ok(katexIndex < mathIndex && mathIndex < markdownIndex, `${page} math load order`);
}

const adminHtml = read("admin/index.html");
assert.ok(adminHtml.indexOf("katex.min.css") >= 0, "CMS loads local KaTeX CSS");
assert.ok(
  adminHtml.indexOf("katex.min.js") < adminHtml.indexOf("data/math-renderer.js") &&
    adminHtml.indexOf("data/math-renderer.js") < adminHtml.indexOf("data/markdown-renderer.js"),
  "CMS math load order"
);

const style = read("styles/26-inline-math.css");
assert.match(style, /\.markdown-math-display[\s\S]*?border:\s*0/);
assert.match(style, /\.markdown-math-display\.is-boxed/);
assert.match(style, /\.markdown-math-error--display/);
assert.doesNotMatch(style, /\.markdown-math-display\s*\{[^}]*border:\s*1px/);

console.log("Shared KaTeX rendering checks passed.");
