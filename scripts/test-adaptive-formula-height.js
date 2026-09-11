const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFile } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
const fixtures = [
  ["ordinary", "E=mc^2"],
  ["root-fraction", "\\frac{\\sqrt{V_{in}^2+V_{out}^2}}{L f_s}"],
  ["whole-root", "\\sqrt{\\frac{V_{in}D}{L f_s}}"],
  ["nested-fraction", "\\frac{1+\\frac{D}{1-D}}{\\frac{L}{T_s}+\\frac{C}{T_s}}"],
  ["integral", "\\int_{0}^{T_s} v_L(t)\\,\\mathrm{d}t"],
  ["matrix", "\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}"],
  ["cases", "f(x)=\\begin{cases}x^2,&x\\ge0\\\\-x,&x<0\\end{cases}"],
  ["boxed", "\\boxed{\\frac{V_o}{V_{in}}=\\frac{D}{1-D}}"]
];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

const rendererSource = read("data/math-renderer.js");
const contentStyle = read("styles/20-content.css");
const inlineStyle = read("styles/26-inline-math.css");
const adminStyle = read("admin/admin.css");
const graphSource = read("formula-graph.js");

assert.match(rendererSource, /ADAPTIVE_BLOCK_SELECTOR/);
assert.match(rendererSource, /document\.fonts\?\.ready/);
assert.match(rendererSource, /MutationObserver/);
assert.match(rendererSource, /ResizeObserver/);
assert.match(rendererSource, /MEASURE_EPSILON/);
assert.match(contentStyle, /\.markdown-math-display\[data-math-adaptive="block"\][\s\S]*overflow:\s*visible/);
assert.doesNotMatch(contentStyle + adminStyle, /data-math-adaptive[^}]*overflow-y:\s*(?:auto|scroll)/);
assert.match(inlineStyle, /\.markdown-math-inline[\s\S]*vertical-align:\s*baseline/);
assert.doesNotMatch(rendererSource, /markdown-math-inline[\s\S]{0,300}min(?:imum)?Height/);
assert.match(graphSource, /scheduleRemeasure/);
assert.match(graphSource, /Math\.abs\(previous\.height - height\) > 1/);
assert.match(graphSource, /resizeObserver\?\.observe\(overlay\)/);

function fixtureHtml(surface, theme) {
  const hostClass = surface === "cms"
    ? "formula-editor-preview markdown-article"
    : surface === "md2file"
      ? "md2doc-preview markdown-article"
      : "markdown-article";
  return `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/assets/vendor/katex/katex.min.css"><link rel="stylesheet" href="/styles.css">
  ${surface === "cms" ? '<link rel="stylesheet" href="/admin/admin.css">' : ""}
  <style>body{margin:0}.fixture{box-sizing:border-box;width:100%;padding:16px}.fixture>*{max-width:100%}</style>
  </head><body><main class="fixture ${hostClass}" id="host"></main><pre id="evidence"></pre>
  <script src="/assets/vendor/katex/katex.min.js"></script><script src="/data/math-renderer.js"></script>
  <script>(function(){
    const fixtures=${JSON.stringify(fixtures)}; const host=document.getElementById("host");
    fixtures.forEach(([id,latex])=>{const block=document.createElement("div");block.className="markdown-math markdown-math-display";block.dataset.fixture=id;block.innerHTML=LarkixMath.render(latex,{displayMode:true}).html;host.append(block)});
    host.querySelectorAll(".markdown-math-display").forEach(block=>LarkixMath.adaptiveLayout.measure(block));
    const rows=[...host.querySelectorAll(".markdown-math-display")].map(block=>{const math=block.querySelector(".katex-display > .katex");const b=block.getBoundingClientRect();const m=math.getBoundingClientRect();const style=getComputedStyle(block);return{id:block.dataset.fixture,height:b.height,mathHeight:m.height,topGap:m.top-b.top,bottomGap:b.bottom-m.bottom,overflowY:style.overflowY,verticalScroll:block.scrollHeight>block.clientHeight+1,adaptive:block.dataset.mathAdaptive}});
    document.getElementById("evidence").textContent=JSON.stringify({surface:${JSON.stringify(surface)},theme:${JSON.stringify(theme)},rows});
  })()</script></body></html>`;
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/fixture") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(fixtureHtml(url.searchParams.get("surface"), url.searchParams.get("theme")));
        return;
      }
      const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
      if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file)) {
        response.writeHead(404).end(); return;
      }
      const extension = path.extname(file).toLowerCase();
      const contentType = extension === ".css" ? "text/css" : extension === ".woff2" ? "font/woff2" : extension === ".woff" ? "font/woff" : "application/javascript";
      response.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function dump(url, width) {
  return new Promise((resolve, reject) => {
    execFile(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--window-size=${width},900`, "--virtual-time-budget=2500", "--dump-dom", url], { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout));
  });
}

(async () => {
  assert.ok(chrome, "需要本机 Chrome 或 Edge 执行专项浏览器尺寸回归");
  const server = await serve();
  const port = server.address().port;
  try {
    for (const width of [390, 1366]) {
      for (const surface of ["post", "cms", "md2file"]) {
        for (const theme of ["light", "dark"]) {
          const html = await dump(`http://127.0.0.1:${port}/fixture?surface=${surface}&theme=${theme}`, width);
          const match = html.match(/<pre id="evidence">([\s\S]*?)<\/pre>/);
          assert.ok(match && match[1], `${surface}/${theme}/${width}: browser evidence ready; ${html.slice(-500)}`);
          const evidence = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
          evidence.rows.forEach((row) => {
            assert.equal(row.adaptive, "block", `${row.id}: adaptive marker`);
            assert.notEqual(row.overflowY, "auto", `${row.id}: no vertical auto scroll`);
            assert.notEqual(row.overflowY, "scroll", `${row.id}: no vertical forced scroll`);
            assert.equal(row.verticalScroll, false, `${row.id}: no vertical scroll range`);
            assert.ok(row.topGap >= 5 && row.bottomGap >= 5, `${row.id}: safe vertical gaps`);
            assert.ok(row.height >= row.mathHeight + 10, `${row.id}: container encloses math`);
          });
          const ordinary = evidence.rows.find((row) => row.id === "ordinary");
          const tall = evidence.rows.find((row) => row.id === "matrix");
          assert.ok(tall.height > ordinary.height, `${surface}/${theme}/${width}: tall formula expands`);
        }
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`Adaptive formula height passed: ${fixtures.map(([id]) => id).join(", ")}; 12 browser surface/theme/width combinations.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
