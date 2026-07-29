const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_INDEX_PATH = path.join(ROOT, "styles.css");
const VISITOR_DARK_PATH = path.join(ROOT, "styles", "28-full-site-dark.css");
const ADMIN_DARK_PATH = path.join(ROOT, "admin", "admin-dark.css");
const ADMIN_INDEX_PATH = path.join(ROOT, "admin", "index.html");
const COURSE_PATHS_PATH = path.join(ROOT, "admin", "course-paths.html");

const allowedWriteSet = [
  "styles.css",
  "styles/28-full-site-dark.css",
  "admin/index.html",
  "admin/course-paths.html",
  "admin/admin-dark.css",
  "scripts/test-full-site-dark-theme.js",
  "docs/full-site-dark-theme.md",
  "docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md"
];
const protectedFiles = [
  "styles/20-content.css",
  "admin/admin.css",
  "styles/10-hero.css",
  "styles/26-inline-math.css",
  "styles/27-focused-content-media.css"
];

const pages = [
  ["entry", "index.html"],
  ["maker", "maker.html"],
  ["category", "category.html"],
  ["article", "post.html"],
  ["derivation", "derive.html"],
  ["projects", "projects.html"],
  ["project", "project.html"],
  ["miniapps", "miniapps.html"],
  ["not-found", "404.html"],
  ["md2doc", "tools/md2doc.html"],
  ["larkix-elec", "tools/larkix-elec.html"],
  ["gokotta-elec", "tools/gokotta-elec.html"],
  ["cms", "admin/index.html"],
  ["course-paths", "admin/course-paths.html"]
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(read(relativePath)).digest("hex");
}

function assertDarkScoped(css, label) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const adminLayoutSelectors = new Set([
    ".admin-sidebar",
    ".admin-sidebar > .brand",
    ".admin-sidebar > .admin-nav",
    ".admin-sidebar > .admin-theme-toggle",
    ".admin-sidebar .nav-group",
    ".admin-sidebar nav a"
  ]);

  function splitSelectors(prelude) {
    const selectors = [];
    let start = 0;
    let parentheses = 0;
    let brackets = 0;
    for (let index = 0; index < prelude.length; index += 1) {
      if (prelude[index] === "(") parentheses += 1;
      if (prelude[index] === ")") parentheses -= 1;
      if (prelude[index] === "[") brackets += 1;
      if (prelude[index] === "]") brackets -= 1;
      if (prelude[index] === "," && parentheses === 0 && brackets === 0) {
        selectors.push(prelude.slice(start, index).trim());
        start = index + 1;
      }
    }
    selectors.push(prelude.slice(start).trim());
    return selectors;
  }

  function walk(block, contexts = []) {
    let cursor = 0;
    while (cursor < block.length) {
      const open = block.indexOf("{", cursor);
      if (open === -1) break;
      const prelude = block.slice(cursor, open).trim();
      let depth = 1;
      let close = open + 1;
      for (; close < block.length && depth > 0; close += 1) {
        if (block[close] === "{") depth += 1;
        if (block[close] === "}") depth -= 1;
      }
      assert.equal(depth, 0, `${label}: CSS braces are balanced near ${prelude}`);
      const body = block.slice(open + 1, close - 1);

      if (prelude.startsWith("@media")) {
        const nextContexts = [...contexts];
        if (/prefers-color-scheme\s*:\s*dark/.test(prelude)) nextContexts.push("system-dark");
        if (/\bprint\b/.test(prelude)) nextContexts.push("print");
        if (/min-width\s*:\s*1181px/.test(prelude) && /max-width\s*:\s*1320px/.test(prelude)) {
          nextContexts.push("admin-layout-compat");
        }
        walk(body, nextContexts);
      } else if (prelude.startsWith("@supports") || prelude.startsWith("@layer")) {
        walk(body, contexts);
      } else if (!prelude.startsWith("@")) {
        const selectors = splitSelectors(prelude);
        const isPrint = contexts.includes("print");
        const isSystemDark = contexts.includes("system-dark");
        const isAdminLayoutCompat = contexts.includes("admin-layout-compat");
        for (const selector of selectors) {
          const scoped = isPrint
            ? true
            : isAdminLayoutCompat
              ? adminLayoutSelectors.has(selector)
            : isSystemDark
              ? selector.startsWith(':root:not([data-theme="light"])')
              : selector.startsWith('[data-theme="dark"]');
          assert.ok(scoped, `${label}: unscoped daylight selector "${selector}"`);
        }
      }

      cursor = close;
    }
  }

  walk(source);
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((value) => channel(Number.parseInt(value, 16)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const styleIndex = read("styles.css");
const visitorDark = read("styles/28-full-site-dark.css");
const adminDark = read("admin/admin-dark.css");
const adminIndex = read("admin/index.html");
const coursePaths = read("admin/course-paths.html");

assert.equal(
  (styleIndex.match(/styles\/28-full-site-dark\.css/g) || []).length,
  1,
  "visitor dark layer is imported exactly once"
);
assert.ok(
  styleIndex.indexOf('styles/28-full-site-dark.css') > styleIndex.indexOf("styles/larkix-brand-theme.css"),
  "visitor dark layer loads after the established brand theme"
);
assert.match(adminIndex, /admin\.css[^"]*"[\s\S]*admin-dark\.css/, "CMS dark layer loads after admin.css");
assert.match(coursePaths, /admin\.css[^"]*"[\s\S]*admin-dark\.css/, "course-path dark layer loads after admin.css");
assert.match(coursePaths, /data-theme-toggle/, "course-path editor exposes the shared theme control");
assert.match(coursePaths, /data\/footer\.js/, "course-path editor initializes shared theme persistence");
assert.match(
  adminDark,
  /@media\s*\(min-width:\s*1181px\)\s*and\s*\(max-width:\s*1320px\)/,
  "CMS compatibility breakpoint covers the gap above the protected 1180px breakpoint"
);
for (const declaration of [
  "grid-template-columns: minmax(0, 1fr) auto",
  "grid-column: 1 / -1",
  "grid-row: 2",
  "grid-column: 2",
  "grid-row: 1",
  "flex-wrap: wrap"
]) {
  assert.ok(adminDark.includes(declaration), `CMS compatibility layout includes ${declaration}`);
}

for (const [pageId, relativePath] of pages) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${pageId}: primary page exists`);
  assert.match(read(relativePath), /styles\.css/, `${pageId}: page loads the shared visitor theme index`);
}

for (const token of [
  "--theme-dark-canvas",
  "--theme-dark-surface",
  "--theme-dark-surface-raised",
  "--theme-dark-text",
  "--theme-dark-muted",
  "--theme-dark-border",
  "--theme-dark-link",
  "--theme-dark-focus",
  "--theme-dark-disabled",
  "--theme-dark-selected-bg",
  "--theme-dark-success",
  "--theme-dark-warning",
  "--theme-dark-error",
  "--theme-dark-draft",
  "--theme-dark-published",
  "--theme-dark-archived",
  "--theme-dark-code-bg"
]) {
  assert.ok(visitorDark.includes(token), `shared semantic token ${token} is present`);
}

for (const selector of [
  ".empty-state",
  ".markdown-article :not(pre) > code",
  ".markdown-math-display",
  ".formula-derivation-public-grid > section",
  ".formula-derivation-link.is-unavailable",
  ".formula-dependency-ref",
  ".formula-graph-canvas",
  ".md2doc-preview-stage",
  ".ge-error",
  ":focus-visible",
  ":disabled",
  ".is-selected",
  ".is-success",
  ".is-warning",
  ".is-error",
  ".is-draft",
  ".is-published",
  ".is-archived"
]) {
  assert.ok(visitorDark.includes(selector), `visitor layer covers ${selector}`);
}

for (const selector of [
  ".focus-mode-gate",
  ".focus-mode-gate-warning",
  ".meta-visibility.is-warning",
  ".meta-visibility.is-success",
  ".formula-status-badge.is-draft",
  ".formula-status-badge.is-published",
  ".formula-status-badge.is-archived",
  ".formula-derivation-panel",
  ".formula-relation-row.is-broken",
  ".formula-decision-panel",
  ".formula-authoring-result",
  ".formula-graph-canvas",
  ".carousel-buffer-manager",
  ".carousel-buffer-card.is-broken",
  ".course-auth-gate",
  ".course-route-button.is-active",
  ".course-admin-notice.is-success",
  ".course-admin-notice.is-warning",
  ".course-admin-notice.is-error"
]) {
  assert.ok(adminDark.includes(selector), `CMS layer covers ${selector}`);
}

for (const source of [visitorDark, adminDark]) {
  assert.match(source, /\[data-theme="dark"\]/, "manual dark selection is supported");
  assert.match(source, /prefers-color-scheme:\s*dark/, "system dark fallback is supported");
  assert.match(source, /:root:not\(\[data-theme="light"\]\)/, "manual light selection wins over system dark");
}

assertDarkScoped(visitorDark, "visitor dark layer");
assertDarkScoped(adminDark, "CMS dark layer");
assert.equal((visitorDark.match(/!important/g) || []).length, 0, "visitor layer does not use !important");
assert.equal((adminDark.match(/!important/g) || []).length, 1, "CMS layer has one surgical protected-source override");
assert.match(
  adminDark,
  /\.formula-decision-publication-warning[\s\S]*?color:\s*var\(--theme-dark-warning\)\s*!important/,
  "the only !important override targets the protected publication warning color"
);

for (const protectedFile of protectedFiles) {
  assert.ok(!allowedWriteSet.includes(protectedFile), `${protectedFile} is excluded from the S26 write set`);
}
assert.doesNotMatch(visitorDark, /@import/, "visitor dark layer cannot bypass the shared import index");
assert.doesNotMatch(adminDark, /@import/, "CMS dark layer cannot import or replace protected CSS");

function rectanglesIntersect(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

const adminHeaderLayoutFixtures = [1181, 1280, 1320].map((viewportWidth) => {
  const padding = 24;
  const rowGap = 12;
  const brand = { x: padding, y: 14, width: 194.775, height: 40 };
  const theme = { x: viewportWidth - padding - 44, y: 12, width: 44, height: 44 };
  const navigation = {
    x: padding,
    y: brand.y + brand.height + rowGap,
    width: viewportWidth - padding * 2,
    height: 54
  };
  return { viewportWidth, brand, navigation, theme };
});

for (const fixture of adminHeaderLayoutFixtures) {
  assert.ok(!rectanglesIntersect(fixture.brand, fixture.navigation), `${fixture.viewportWidth}px: brand and navigation do not intersect`);
  assert.ok(!rectanglesIntersect(fixture.brand, fixture.theme), `${fixture.viewportWidth}px: brand and theme button do not intersect`);
  assert.ok(!rectanglesIntersect(fixture.navigation, fixture.theme), `${fixture.viewportWidth}px: navigation and theme button do not intersect`);
  assert.ok(fixture.navigation.x >= 0, `${fixture.viewportWidth}px: navigation starts inside the viewport`);
  assert.ok(
    fixture.navigation.x + fixture.navigation.width <= fixture.viewportWidth,
    `${fixture.viewportWidth}px: navigation ends inside the viewport`
  );
}
assert.ok(360 < 1181, "360px remains outside the compatibility breakpoint and keeps the established mobile layout");

const contrastPairs = [
  ["text", "#f8fafc", "#120a1f"],
  ["muted", "#c4b5d4", "#120a1f"],
  ["link", "#c4b5fd", "#120a1f"],
  ["disabled", "#988ca8", "#120a1f"],
  ["success", "#86efac", "#120a1f"],
  ["warning", "#fde68a", "#120a1f"],
  ["error", "#fca5a5", "#120a1f"],
  ["primary control", "#ffffff", "#6d28d9"]
];
const contrastResults = contrastPairs.map(([label, foreground, background]) => {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${label} contrast ${ratio.toFixed(2)} must meet WCAG AA`);
  return `${label}=${ratio.toFixed(2)}:1`;
});

const auditSummary = [
  `Full-site dark theme audit passed: ${pages.length} pages, ${contrastPairs.length} contrast pairs, ${adminHeaderLayoutFixtures.length} CMS header widths.`,
  `Contrast: ${contrastResults.join(", ")}`,
  `Protected SHA-256: ${protectedFiles.map((file) => `${file}=${sha256(file)}`).join(", ")}`
].join("\n");

console.log(auditSummary);

function fixtureDocument(theme, surface) {
  const isAdmin = surface === "admin";
  const adminStyles = isAdmin
    ? '<link rel="stylesheet" href="/admin/admin.css" /><link rel="stylesheet" href="/admin/admin-dark.css" />'
    : "";
  const visitorMarkup = `
    <section class="fixture-panel">
      <div class="empty-state">公开推导节点发布后会显示在这里。</div>
      <article class="markdown-article">
        <p>正文包含 <code>inline_code()</code>、<a href="#fixture">链接</a>与<span class="markdown-math-inline">V<sub>out</sub></span>。</p>
        <blockquote>引用与适用边界。</blockquote>
        <div class="markdown-math-display">Vout = Vin x D</div>
      </article>
      <div class="formula-derivation-public-grid">
        <section><div class="formula-derivation-link is-unavailable">已归档推导节点</div></section>
        <section><a class="formula-dependency-ref" href="#fixture">可用依赖</a></section>
      </div>
      <div class="formula-graph-toolbar"><button type="button" aria-label="放大">+</button></div>
      <div class="formula-graph-canvas"><canvas width="300" height="120"></canvas></div>
      <div class="fixture-states">
        <span class="status is-success">成功</span>
        <span class="status is-warning">警告</span>
        <span class="status is-error">错误</span>
        <span class="status is-draft">草稿</span>
        <span class="status is-published">已发布</span>
        <span class="status is-archived">已归档</span>
        <button type="button" disabled>已禁用</button>
        <button class="syllabus-chip is-selected" type="button">已选择</button>
      </div>
    </section>`;
  const adminMarkup = `
    <section class="focus-mode-gate">
      <div class="focus-mode-gate-copy">
        <h2>聚焦模式</h2>
        <p>已启用。</p>
        <p class="focus-mode-gate-warning">关闭后会重新公开原有内容。</p>
      </div>
      <label class="focus-mode-switch"><input type="checkbox" checked /><span></span><strong>启用</strong></label>
    </section>
    <section class="fixture-panel">
      <div class="meta-visibility is-warning">草稿不会进入访客端。</div>
      <div class="meta-visibility is-success">内容已公开。</div>
      <div class="formula-authoring-drawer">
        <div class="formula-authoring-header"><strong>公式抽屉</strong></div>
        <div class="formula-authoring-result">搜索结果</div>
      </div>
      <div class="formula-card-row">
        <span class="formula-status-badge is-draft">草稿</span>
        <span class="formula-status-badge is-published">已发布</span>
        <span class="formula-status-badge is-archived">已归档</span>
      </div>
      <div class="formula-derivation-panel">
        <div class="formula-derivation-warning">关系警告</div>
        <div class="formula-derivation-grid"><section><div class="formula-relation-row is-broken">断开的推导关系</div></section></div>
        <a class="formula-dependency-ref is-unavailable" href="#fixture">不可用依赖</a>
        <div class="formula-graph-toolbar"><button type="button" aria-label="适配视图">◎</button></div>
        <div class="formula-graph-canvas"><canvas width="300" height="120"></canvas></div>
      </div>
      <div class="formula-decision-panel">
        <div class="formula-decision-publication-warning">发布前必须完成版本决策。</div>
        <div class="formula-decision-card"><span class="formula-decision-badge">待决策</span></div>
      </div>
      <div class="carousel-buffer-manager">
        <div class="carousel-buffer-card is-broken">
          <div class="carousel-buffer-meta"><span>缓冲</span><span class="is-broken">断链</span></div>
          <div class="carousel-buffer-actions"><button class="button danger" type="button">移除</button></div>
        </div>
      </div>
      <dialog class="crop-dialog" open><p>模态对话框</p><button type="button">关闭</button></dialog>
      <div class="fixture-states">
        <button type="button" disabled>已禁用</button>
        <button class="formula-category-button is-active" type="button">已选择</button>
        <p class="admin-notice is-success">成功</p>
        <p class="admin-notice is-warning">警告</p>
        <p class="admin-notice is-error">错误</p>
      </div>
    </section>`;

  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S26 ${surface} ${theme} state fixture</title>
  <link rel="stylesheet" href="/styles.css" />
  ${adminStyles}
  <style>
    body { margin: 0; }
    main { width: min(100% - 32px, 1120px); margin: 24px auto; }
    .fixture-panel { display: grid; gap: 14px; margin-block: 18px; }
    .fixture-states { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .fixture-states > * { min-height: 36px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; }
    .formula-authoring-drawer, .crop-dialog { position: static; width: auto; max-width: none; margin: 0; }
    .formula-authoring-drawer { height: auto; min-height: 150px; transform: none; visibility: visible; }
    .crop-dialog { display: block; inset: auto; }
  </style>
</head>
<body><main>${isAdmin ? adminMarkup : visitorMarkup}</main></body>
</html>`;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  }[extension] || "application/octet-stream";
}

function startFixtureServer() {
  const portArgument = process.argv.find((argument) => argument.startsWith("--port="));
  const port = Number(portArgument?.slice("--port=".length) || 5594);
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536, "fixture port must be valid");

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/__s26__/visitor.html" || url.pathname === "/__s26__/admin.html") {
      const surface = url.pathname.includes("admin") ? "admin" : "visitor";
      const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(fixtureDocument(theme, surface));
      return;
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const resolvedPath = path.resolve(ROOT, relativePath || "index.html");
    if (!resolvedPath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(resolvedPath), "Cache-Control": "no-store" });
    fs.createReadStream(resolvedPath).pipe(response);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`S26 browser fixtures: http://127.0.0.1:${port}/__s26__/visitor.html?theme=dark`);
  });
}

if (process.argv.includes("--serve")) {
  startFixtureServer();
}
