const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const katex = require("katex");
const { markdownToDocx } = require("../lib/md2doc");

function loadRenderer() {
  const mathSource = fs.readFileSync(path.join(__dirname, "..", "data", "math-renderer.js"), "utf8");
  const markdownSource = fs.readFileSync(path.join(__dirname, "..", "data", "markdown-renderer.js"), "utf8");
  const sandbox = { window: { katex } };
  vm.createContext(sandbox);
  vm.runInContext(mathSource, sandbox);
  vm.runInContext(markdownSource, sandbox);
  return sandbox.window.LarkixMarkdown;
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
  assertIncludes(rendered.html, 'class="msupsub"', "inline math script markup");
  assert.equal(countMatches(rendered.html, /markdown-math-display/g), 2, "display math block count");
  assertIncludes(rendered.html, 'class="mfrac"', "KaTeX fraction markup");
  assertIncludes(rendered.html, 'class="mop"', "KaTeX integral operator markup");
  assertIncludes(rendered.html, "sqrt", "KaTeX root markup");
  assertIncludes(rendered.html, "\u222e", "closed integral glyph");
  assertIncludes(rendered.html, 'class="katex-mathml"', "accessible MathML output");
  assert.ok(!rendered.html.includes("\ufffd"), "rendered math must not contain replacement characters");
  assert.equal(rendered.valid, true, "valid Markdown math is publishable");
  assert.deepEqual(Array.from(rendered.diagnostics), [], "valid Markdown math has no diagnostics");
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
  const rendered = markdown.render(`\`VIN / VREF × (2^12 - 1)\`

\`\`\`text
code ≈ round(VIN / VREF × (2^12 - 1))
1 LSB ≈ VREF / 2^12
\`\`\`

\`\`\`text
VBAT ---- R1 ----+---- ADC_INx
\`\`\`
`);
  assert.equal(countMatches(rendered.html, /markdown-math-inline/g), 1, "formula-like inline code renders as inline math");
  assert.equal(countMatches(rendered.html, /markdown-math-display/g), 1, "formula-like text fence renders as display math");
  assert.equal(countMatches(rendered.html, /<pre /g), 1, "ASCII circuit text fence stays a code block");
  assertIncludes(rendered.html, 'class="katex"', "formula-like plain text uses the shared engine");
  assertIncludes(rendered.html, 'class="msupsub"', "plain formula powers use KaTeX scripts");
}

{
  const invalidBrace = markdown.render("Valid text before $x_{$ and after.");
  assert.equal(invalidBrace.valid, false, "invalid brace blocks publication");
  assert.equal(invalidBrace.canPublish, false, "invalid brace exposes the publication gate");
  assert.equal(invalidBrace.diagnostics[0].code, "math.syntax.invalid", "invalid brace diagnostic code");
  assert.equal(invalidBrace.diagnostics[0].blocking, true, "invalid brace diagnostic is blocking");
  assert.ok(invalidBrace.diagnostics[0].range.column >= 1, "invalid brace has a located range");
  assertIncludes(invalidBrace.html, "公式暂不可用", "invalid formula has a safe public placeholder");
  assert.ok(!invalidBrace.html.includes("x_{"), "invalid public output does not expose raw LaTeX");

  const invalidDelimiter = markdown.render("$$\n\\frac{1}{2}");
  assert.equal(invalidDelimiter.valid, false, "unclosed display delimiter blocks publication");
  assert.equal(invalidDelimiter.diagnostics[0].code, "math.delimiter.unclosed", "delimiter diagnostic code");
  assert.equal(invalidDelimiter.diagnostics[0].range.line, 1, "delimiter diagnostic locates the opening line");
  assert.ok(!invalidDelimiter.html.includes("\\frac"), "unclosed public output does not expose raw LaTeX");
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
  const rendered = markdown.render(`# Visible H1

## Visible H2
### Visible H3
`, { includeH1: true });
  assert.deepEqual(
    Array.from(rendered.headings, (heading) => heading.level),
    [1, 2, 3],
    "includeH1 preserves Markdown H1/H2/H3 for DOCX export"
  );
  assertIncludes(rendered.html, "<h1", "includeH1 renders h1 markup");
}

{
  const rendered = markdown.render(
    `Boost uses {{derive:d-boost|D.boost|blue}}, {{derive:l-nom|Lnom}}, and {{derive:f-sw|fsw|teal}}.`
  );
  assert.equal(countMatches(rendered.html, /class="derivation-link/g), 3, "derive shortcode link count");
  assertIncludes(
    rendered.html,
    'class="derivation-link derivation-link--blue formula-jump-sup" href="./derive.html?slug=d-boost"',
    "derive shortcode renders requested token"
  );
  assertIncludes(rendered.html, 'data-derive-slug="d-boost"', "derive shortcode slug data attribute");
  assertIncludes(rendered.html, 'data-derive-label="D.boost"', "derive shortcode label data attribute");
  assertIncludes(rendered.html, 'data-derive-color="blue"', "derive shortcode color data attribute");
  assertIncludes(rendered.html, 'title="D.boost详细推导"', "derive shortcode title text");
  assertIncludes(rendered.html, 'aria-label="查看 D.boost详细推导"', "derive shortcode aria label");
  assertIncludes(rendered.html, "formula-jump-sup", "derive shortcode renders as formula jump marker");
  assertIncludes(rendered.html, '<span class="derive-jump-icon" aria-hidden="true">↵</span>', "derive shortcode marker icon");
  assertIncludes(rendered.html, '<span class="derive-jump-label">D.boost</span>', "derive shortcode preserves hidden label");
  assertIncludes(
    rendered.html,
    'class="derivation-link derivation-link--purple formula-jump-sup" href="./derive.html?slug=l-nom"',
    "derive shortcode default color token"
  );
  assertIncludes(
    rendered.html,
    'class="derivation-link derivation-link--purple formula-jump-sup" href="./derive.html?slug=f-sw"',
    "derive shortcode invalid color falls back"
  );
  assert.ok(!rendered.html.includes("derivation-link--teal"), "invalid derive color token must not become a class");
}

{
  const escaped = markdown.render(`Escaped {{derive:d-boost|<b>D.boost</b>|purple}} label.`);
  assertIncludes(escaped.html, "&lt;b&gt;D.boost&lt;/b&gt;", "derive shortcode escapes HTML label");
  assert.ok(!escaped.html.includes("<b>D.boost</b>"), "derive shortcode label must not render raw HTML");

  const longLabel = "L".repeat(81);
  const invalid = markdown.render(`Bad {{derive:../bad|Bad|blue}} and {{derive:d-boost|${longLabel}|blue}}.`);
  assert.equal(countMatches(invalid.html, /class="derivation-link/g), 0, "invalid derive shortcode does not render link");
  assertIncludes(invalid.html, "{{derive:../bad|Bad|blue}}", "invalid derive slug remains visible as escaped text");
  assertIncludes(invalid.html, `{{derive:d-boost|${longLabel}|blue}}`, "invalid derive label remains visible as escaped text");
}

{
  const rendered = markdown.render(`$$
D = 1 - \\frac{V_{in}\\eta}{V_{out}}
$$
{{derive:d-boost|占空比公式|purple}}`);
  assert.equal(countMatches(rendered.html, /class="derivation-link/g), 1, "display formula jump count");
  assertIncludes(rendered.html, "markdown-math markdown-math-display", "display formula is rendered");
  assert.ok(
    /<div class="markdown-math markdown-math-display"[\s\S]*class="derivation-link derivation-link--purple formula-jump-sup"[\s\S]*<\/div>/.test(
      rendered.html
    ),
    "display formula jump is attached inside the formula block"
  );
  assert.ok(!rendered.html.includes("<p><a class=\"derivation-link"), "display formula jump is not a standalone paragraph link");
}

{
  const rendered = markdown.render(`\`{{derive:d-boost|D.boost|purple}}\`

\`\`\`md
{{derive:d-boost|D.boost|purple}}
\`\`\`

$ {{derive:d-boost|D.boost|purple}} $

\\({{derive:d-boost|D.boost|purple}}\\)

$$
{{derive:d-boost|D.boost|purple}}
$$

\\[
{{derive:d-boost|D.boost|purple}}
\\]
`);
  assert.equal(
    countMatches(rendered.html, /class="derivation-link/g),
    0,
    "derive shortcodes inside code and math regions are ignored"
  );
}

{
  const binding = {
    bindingId: "bind.marker",
    formulaId: "formula.marker",
    revisionId: "rev.marker",
    displayMode: "inline",
    slug: "marker-target",
    displayName: "占空比公式",
    latex: "z_{database}",
    archiveState: "active"
  };
  const decorated = markdown.render(
    `作者原式 $x_{author}^2$ {{formula:bind.marker|formula.marker|rev.marker|inline}}；普通 $y_{plain}$.`,
    { formulaBindings: [binding] }
  );
  assert.equal(countMatches(decorated.html, /class="formula-binding-marker /g), 1, "bound author formula has one marker");
  assertIncludes(decorated.html, "x_{author}^2", "bound source formula remains unchanged");
  assert.ok(!decorated.html.includes("z_{database}"), "adjacent binding does not repeat database formula");
  assertIncludes(decorated.html, 'title="占空比公式详细推导"', "binding marker exposes target tooltip");
  assertIncludes(decorated.html, 'aria-label="查看 占空比公式详细推导"', "binding marker has accessible name");
  assertIncludes(decorated.html, "derive.html?formula=marker-target", "binding marker navigates to stable formula slug");
}

{
  const displayBinding = {
    bindingId: "bind.display",
    formulaId: "formula.display",
    revisionId: "rev.display",
    displayMode: "display",
    slug: "display-target",
    displayName: "纹波公式",
    latex: "z_{legacy}",
    archiveState: "active"
  };
  const decorated = markdown.render(`$$
\\boxed{\\Delta I_L=\\frac{V_{in}D}{Lf_s}}
$$
{{formula:bind.display|formula.display|rev.display|display}}`, { formulaBindings: [displayBinding] });
  assert.equal(countMatches(decorated.html, /markdown-math markdown-math-display/g), 1, "display source formula is not duplicated");
  assert.equal(countMatches(decorated.html, /class="formula-binding-marker /g), 1, "display formula has one marker");
  assert.ok(
    /class="markdown-math markdown-math-display[\s\S]*class="formula-binding-marker formula-binding-marker--display"[\s\S]*<\/div>/.test(
      decorated.html
    ),
    "display marker is attached inside the source formula host"
  );
  const unresolved = markdown.render(
    `$x$ {{formula:bind.missing|formula.missing|rev.missing|inline}}`,
    { formulaBindings: [] }
  );
  assert.equal(countMatches(unresolved.html, /formula-binding-marker/g), 0, "unresolved binding does not mark ordinary source math");
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

{
  const docxText = markdownToDocx({
    markdown: `# 一级标题

## 二级标题

### 三级标题

Inline $x_i^2+\\frac{1}{2}$ and \`VIN / VREF × (2^12 - 1)\`.

$$
\\frac{V_{IN}}{V_{REF}} \\times (2^{12} - 1)
$$

-----
`,
    title: "",
    options: {}
  }).toString("utf8");
  assertIncludes(docxText, '<w:pStyle w:val="Heading1"/>', "DOCX H1 paragraph style");
  assertIncludes(docxText, '<w:pStyle w:val="Heading2"/>', "DOCX H2 paragraph style");
  assertIncludes(docxText, '<w:pStyle w:val="Heading3"/>', "DOCX H3 paragraph style");
  assertIncludes(docxText, '<w:outlineLvl w:val="0"/>', "DOCX Heading1 outline level");
  assertIncludes(docxText, '<w:outlineLvl w:val="1"/>', "DOCX Heading2 outline level");
  assertIncludes(docxText, '<w:outlineLvl w:val="2"/>', "DOCX Heading3 outline level");
  assertIncludes(
    docxText,
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"',
    "DOCX declares styles relationship"
  );
  assertIncludes(docxText, "<m:sSub>", "DOCX math subscript");
  assertIncludes(docxText, "<m:sSup>", "DOCX math superscript");
  assertIncludes(docxText, "<m:f>", "DOCX math fraction");
  assertIncludes(docxText, "<w:pBdr>", "DOCX horizontal rule paragraph border");
}

{
  const docxText = markdownToDocx({
    markdown: `Derivation: {{derive:d-boost|D.boost|green}}.`,
    title: "",
    options: {}
  }).toString("utf8");
  assertIncludes(docxText, "D.boost [derive:d-boost]", "DOCX derive shortcode readable fallback");
  assert.ok(!docxText.includes("derivation-link--green"), "DOCX derive shortcode must not preserve HTML class text");
}

console.log("Markdown renderer and MD2File DOCX regression tests passed.");
