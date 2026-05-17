const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadRenderer() {
  const source = fs.readFileSync(path.join(__dirname, "..", "data", "markdown-renderer.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.GokottaMarkdown;
}

function countMatches(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

function assertIncludes(value, fragment, label) {
  assert.ok(String(value).includes(fragment), `${label}: expected ${JSON.stringify(fragment)}`);
}

const markdown = loadRenderer();

{
  const ampere = markdown.mathToText(
    "\\nabla \\times \\mathbf{B}=\\mu_0\\mathbf{J}+\\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}"
  );
  assertIncludes(ampere, "\u2207", "nabla");
  assertIncludes(ampere, "\u00d7", "times");
  assertIncludes(ampere, "\u03bc\u2080", "mu subscript");
  assertIncludes(ampere, "\u2202", "partial");

  assert.equal(markdown.mathToText("\\sqrt{1+x^2}"), "\u221a(1+x\u00b2)");
  assert.equal(markdown.mathToText("\\alpha+\\beta+\\Gamma"), "\u03b1+\u03b2+\u0393");

  const accented = markdown.mathToText("\\vec{B}+\\hat{x}+\\bar{y}+\\dot{q}+\\ddot{z}");
  assertIncludes(accented, "\u20d7", "vector accent");
  assertIncludes(accented, "\u0302", "hat accent");
  assertIncludes(accented, "\u0304", "bar accent");
  assertIncludes(accented, "\u0307", "dot accent");
  assertIncludes(accented, "\u0308", "ddot accent");
  assert.ok(!accented.includes("?"), "accented math must not degrade to question marks");
}

{
  const rendered = markdown.render(`Inline $x_i^2+\\sqrt{x}$.

$$
\\oint_C \\mathbf{B}\\cdot d\\mathbf{l}=\\mu_0 I_{enc}
$$

\\[
f(x)=\\int_0^x \\frac{1}{\\sqrt{1+t^2}}dt
\\]
`);
  assertIncludes(rendered.html, "markdown-math-inline", "inline math span");
  assert.equal(countMatches(rendered.html, /markdown-math-display/g), 2, "display math block count");
  assertIncludes(rendered.html, "math-frac", "fraction markup");
  assertIncludes(rendered.html, "math-limit-op", "integral limit markup");
  assertIncludes(rendered.html, "math-root", "root markup");
  assertIncludes(rendered.html, "\u222e", "closed integral glyph");
  assert.ok(!rendered.html.includes("\ufffd"), "rendered math must not contain replacement characters");
}

{
  const code = markdown.render(`\`\`\`js
const formula = "$x_i^2$";
\`\`\`

~~~c
#define LED_PIN 13
~~~
`);
  assert.equal(countMatches(code.html, /<pre /g), 2, "backtick and tilde fences both render as code blocks");
  assertIncludes(code.html, 'data-lang="js"', "js code fence language");
  assertIncludes(code.html, 'data-lang="c"', "tilde code fence language");
  assert.equal(countMatches(code.html, /markdown-math/g), 0, "math delimiters inside code remain literal");
}

{
  const rendered = markdown.render(`# Hidden H1

## Repeat
### Repeat
#### Repeat
## Repeat
`);
  assert.deepEqual(
    Array.from(rendered.headings, (heading) => heading.level),
    [2, 3, 4, 2],
    "heading AST preserves H2/H3/H4 and skips H1"
  );
  assert.deepEqual(
    Array.from(rendered.headings, (heading) => heading.id),
    ["repeat", "repeat-2", "repeat-3", "repeat-4"],
    "duplicate heading ids are stable and unique"
  );
}

{
  const longMarkdown = Array.from({ length: 120 }, (_, index) => {
    const level = 2 + (index % 3);
    return `${"#".repeat(level)} Long Section ${index % 9}`;
  }).join("\n\n");
  const rendered = markdown.render(longMarkdown);
  const ids = Array.from(rendered.headings, (heading) => heading.id);
  assert.equal(rendered.headings.length, 120, "long article heading count");
  assert.equal(new Set(ids).size, ids.length, "long article heading ids must not collide");
  assert.deepEqual(
    [...new Set(Array.from(rendered.headings, (heading) => heading.level))],
    [2, 3, 4],
    "long article heading levels remain H2/H3/H4"
  );
}

console.log("Markdown renderer regression tests passed.");
