const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const katex = require("katex");

const ROOT = path.join(__dirname, "..");
const KATEX_PATH = path.join(ROOT, "assets", "vendor", "katex", "katex.min.js");
const MATH_RENDERER_PATH = path.join(ROOT, "data", "math-renderer.js");
const RENDERER_PATH = path.join(ROOT, "data", "markdown-renderer.js");
const STYLE_INDEX_PATH = path.join(ROOT, "styles.css");
const INLINE_STYLE_PATH = path.join(ROOT, "styles", "26-inline-math.css");

function loadRenderer() {
  const mathSource = fs.readFileSync(MATH_RENDERER_PATH, "utf8");
  const markdownSource = fs.readFileSync(RENDERER_PATH, "utf8");
  const sandbox = { window: { katex } };
  vm.createContext(sandbox);
  vm.runInContext(mathSource, sandbox);
  vm.runInContext(markdownSource, sandbox);
  return sandbox.window.LarkixMarkdown;
}

function count(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

function renderInline(renderer, latex, prefix = "中文前文", suffix = "，中文后文。") {
  return renderer.render(`${prefix}$${latex}$${suffix}`).html;
}

const renderer = loadRenderer();
const styleIndex = fs.readFileSync(STYLE_INDEX_PATH, "utf8");
const inlineStyle = fs.readFileSync(INLINE_STYLE_PATH, "utf8");

const fixtures = [
  {
    id: "ordinary",
    latex: "D_{buck}=V_{out}/V_{in}",
    expectedStructures: ["script"]
  },
  {
    id: "buck-ripple-rate",
    latex: "k_{ripple}=dI_{trans}/dI_{diag}",
    expectedStructures: ["script"]
  },
  {
    id: "stacked-fraction",
    latex: "\\frac{V_{in}D}{L_{nom}f_{sw}}",
    expectedStructures: ["fraction", "script"],
    expectedFractions: 1
  },
  {
    id: "integral-differential-fraction",
    latex:
      "\\frac{\\int_{0}^{T_s}\\sqrt{V_{in}^2+t^2}\\mathrm{d}t}{\\frac{1}{T_s}\\sqrt{L_m^2+\\sqrt{C_{out}}}}",
    expectedStructures: ["fraction", "integral", "root", "script"],
    expectedFractions: 2,
    expectedRoots: 3,
    expectedIntegrals: 1
  },
  {
    id: "nested-roots",
    latex: "\\sqrt{1+\\sqrt{1+x_{n}^{2}}}",
    expectedStructures: ["root", "script"],
    expectedRoots: 2
  },
  {
    id: "multi-level-scripts",
    latex: "I_{L_{phase}}^{pk_{max}}",
    expectedStructures: ["script"],
    expectedScripts: 3
  }
];

const browserSurfaces = {
  cms: '<main class="admin-shell"><article class="preview-panel"><div class="markdown-preview markdown-article fixture-surface" id="markdownPreview"></div></article></main>',
  post: '<main><section class="post-layout"><article class="markdown-article fixture-surface" id="postContent"></article></section></main>',
  derive:
    '<main><section class="post-layout derive-layout"><article class="markdown-article derive-content formula-markdown-derivation fixture-surface" id="deriveContent"></article></section></main>'
};

function browserFixtureHtml(surface, theme) {
  const fixtureMarkdown = fixtures
    .map((fixture) => `结构 ${fixture.id}：$${fixture.latex}$，中文标点紧邻。`)
    .join("\n\n");
  const surfaceHtml = browserSurfaces[surface];
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A31 ${surface} ${theme}</title>
  <link rel="stylesheet" href="/assets/vendor/katex/katex.min.css" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    body { margin: 0; }
    .fixture-shell { box-sizing: border-box; max-width: 1120px; margin: 0 auto; padding: 24px; }
    .fixture-surface { min-width: 0; }
  </style>
  <script>
    window.__inlineMathResourceErrors = [];
    addEventListener("error", function (event) {
      if (event.target && (event.target.src || event.target.href)) {
        window.__inlineMathResourceErrors.push(event.target.src || event.target.href);
      }
    }, true);
  </script>
</head>
<body>
  <div class="fixture-shell">${surfaceHtml}</div>
  <script src="/assets/vendor/katex/katex.min.js"></script>
  <script src="/data/math-renderer.js"></script>
  <script src="/data/markdown-renderer.js"></script>
  <script>
    (function () {
      var fixtureIds = ${JSON.stringify(fixtures.map((fixture) => fixture.id))};
      var target = document.querySelector(".fixture-surface");
      var markdown = ${JSON.stringify(`普通中文基线用于比较相邻行。\n\n${fixtureMarkdown}\n\n$$\n\\frac{V_{in}D}{L f_s}\n$$\n\n结束中文基线用于比较相邻行。`)};
      var renderResult = window.LarkixMarkdown.render(markdown);
      target.innerHTML = renderResult.html;
      Array.from(target.querySelectorAll(".markdown-math-inline")).forEach(function (formula, index) {
        formula.dataset.fixtureId = fixtureIds[index];
      });

      requestAnimationFrame(function () {
        var formulas = Array.from(target.querySelectorAll(".markdown-math-inline")).map(function (formula) {
          var rect = formula.getBoundingClientRect();
          var frame = formula.querySelector(".math-inline-frame").getBoundingClientRect();
          var fractions = Array.from(formula.querySelectorAll(".mfrac")).map(function (fraction) {
            var fractionRect = fraction.getBoundingClientRect();
            return {
              top: fractionRect.top,
              bottom: fractionRect.bottom,
              outsideFrame: fractionRect.top < frame.top - 0.5 || fractionRect.bottom > frame.bottom + 0.5
            };
          });
          var roots = Array.from(formula.querySelectorAll(".mord.sqrt")).map(function (root) {
            var rootRect = root.getBoundingClientRect();
            return rootRect.top < frame.top - 0.5 || rootRect.bottom > frame.bottom + 0.5;
          });
          return {
            id: formula.dataset.fixtureId,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            frameTop: frame.top,
            frameBottom: frame.bottom,
            verticalClip: frame.top < rect.top - 0.5 || frame.bottom > rect.bottom + 0.5,
            verticalScrollClip: formula.scrollHeight > formula.clientHeight + 1,
            horizontalPolicy: getComputedStyle(formula).overflowX,
            fractions: fractions,
            rootsClipped: roots.some(Boolean)
          };
        });
        var paragraphs = Array.from(target.querySelectorAll(":scope > p")).map(function (paragraph) {
          var rect = paragraph.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        });
        window.__inlineMathEvidence = {
          surface: ${JSON.stringify(surface)},
          theme: ${JSON.stringify(theme)},
          viewport: { width: innerWidth, height: innerHeight },
          katexVersion: window.LarkixMath && window.LarkixMath.VERSION,
          valid: renderResult.valid,
          diagnostics: renderResult.diagnostics,
          formulas: formulas,
          paragraphOverlap: paragraphs.some(function (paragraph, index) {
            return index > 0 && paragraphs[index - 1].bottom > paragraph.top + 0.5;
          }),
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          displayMode: getComputedStyle(target.querySelector(".markdown-math-display")).display,
          color: getComputedStyle(target.querySelector(".markdown-math-inline")).color,
          resourceErrors: window.__inlineMathResourceErrors
        };
        document.documentElement.dataset.evidenceReady = "true";
      });
    })();
  </script>
</body>
</html>`;
}

function serveBrowserFixtures(port) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (url.pathname === "/fixture") {
      const surface = browserSurfaces[url.searchParams.get("surface")] ? url.searchParams.get("surface") : "post";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(browserFixtureHtml(surface, theme));
      return;
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relativePath);
    const allowed =
      filePath.startsWith(`${ROOT}${path.sep}`) &&
      [".css", ".js", ".woff", ".woff2"].includes(path.extname(filePath).toLowerCase());
    if (!allowed || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      extension === ".css"
        ? "text/css; charset=utf-8"
        : extension === ".js"
          ? "application/javascript; charset=utf-8"
          : extension === ".woff2"
            ? "font/woff2"
            : "font/woff";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(response);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Inline math browser fixture: http://127.0.0.1:${port}/fixture?surface=post&theme=light`);
  });
}

for (const fixture of fixtures) {
  const html = renderInline(renderer, fixture.latex);
  assert.match(html, /class="markdown-math markdown-math-inline(?: [^"]+)?"/, `${fixture.id}: shared inline class`);
  assert.match(html, /data-math-layout="inline-flow"/, `${fixture.id}: shared layout contract`);
  assert.match(html, /class="math-inline-frame"/, `${fixture.id}: natural line-box frame`);
  assert.match(
    html,
    /中文前文[\s\S]*<\/span>，中文后文。<\/p>/,
    `${fixture.id}: adjacent Chinese punctuation remains outside math`
  );
  assert.ok(!html.includes("\ufffd"), `${fixture.id}: no replacement characters`);

  for (const structure of fixture.expectedStructures) {
    assert.match(
      html,
      new RegExp(`data-math-structures="[^"]*\\b${structure}\\b[^"]*"`),
      `${fixture.id}: ${structure} profile`
    );
  }
  if (fixture.expectedFractions) {
    assert.ok(count(html, /\bmfrac\b/g) >= fixture.expectedFractions, `${fixture.id}: fraction count`);
  }
  if (fixture.expectedRoots) {
    assert.ok(count(html, /\bsqrt\b/g) >= fixture.expectedRoots, `${fixture.id}: root count`);
  }
  if (fixture.expectedIntegrals) {
    assert.ok(count(html, /∫/g) >= fixture.expectedIntegrals, `${fixture.id}: integral count`);
  }
  if (fixture.expectedScripts) {
    assert.ok(count(html, /\bmsupsub\b/g) >= fixture.expectedScripts, `${fixture.id}: script count`);
  }
}

const integralFixture = renderInline(renderer, fixtures[3].latex);
assert.match(integralFixture, /\bmfrac\b/, "integral fixture keeps the fraction structure");
assert.match(integralFixture, /∫/, "integral remains inside the rendered numerator");
assert.match(integralFixture, />d<\/span>/, "differential remains explicit math text");

const displayHtml = renderer.render("$$\n\\frac{V_{in}D}{L f_s}\n$$").html;
assert.match(displayHtml, /class="markdown-math markdown-math-display"/, "display formula remains a block");
assert.ok(!displayHtml.includes("data-math-layout"), "display formula does not receive inline layout metadata");
assert.ok(!displayHtml.includes("math-inline-frame"), "display formula does not receive an inline frame");

const contentImport = styleIndex.indexOf('@import "./styles/20-content.css";');
const cropImport = styleIndex.indexOf('@import "./styles/25-cover-crop.css";');
const inlineImport = styleIndex.indexOf('@import "./styles/26-inline-math.css";');
const printImport = styleIndex.indexOf('@import "./styles/30-accessibility-print.css";');
assert.ok(contentImport >= 0 && cropImport > contentImport, "cover style remains after content style");
assert.ok(inlineImport > cropImport && printImport > inlineImport, "inline math style has a deterministic cascade position");
assert.equal(count(styleIndex, /26-inline-math\.css/g), 1, "inline math style is imported once");

for (const required of [
  'data-math-layout="inline-flow"',
  "display: inline-flex",
  "vertical-align: baseline",
  "max-inline-size: 100%",
  "overflow-x: auto",
  "overflow-y: auto",
  "overflow: visible",
  ".markdown-math-inline .katex",
  ".markdown-math-display",
  ".markdown-math-display.is-boxed",
  ".markdown-math-error--display",
  "border: 0"
]) {
  assert.ok(inlineStyle.includes(required), `style contract includes ${required}`);
}

assert.doesNotMatch(inlineStyle, /data-latex|buck|ripple|post-\d+|article-\d+/i, "no formula or article-specific selector");
const inlineLayoutStyle = inlineStyle
  .split("}")
  .filter((rule) => !rule.includes(".formula-binding-marker"))
  .join("}");
assert.doesNotMatch(
  inlineLayoutStyle,
  /translate(?:X|Y)?\(\s*-/i,
  "inline math layout has no fixed negative translation"
);
assert.doesNotMatch(inlineStyle, /vertical-align\s*:\s*-/i, "no fixed negative vertical alignment");
assert.doesNotMatch(inlineStyle, /overflow-y\s*:\s*hidden/i, "tall inline math is never vertically clipped");

console.log(`Inline math layout fixtures passed: ${fixtures.map((fixture) => fixture.id).join(", ")}.`);

if (process.argv[2] === "--serve") {
  const port = Number.parseInt(process.argv[3], 10) || 5568;
  serveBrowserFixtures(port);
}
