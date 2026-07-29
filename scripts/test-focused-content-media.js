const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const MAIN_PATH = path.join(ROOT, "main.js");
const MEDIA_PATH = path.join(ROOT, "data", "media.js");
const STYLE_INDEX_PATH = path.join(ROOT, "styles.css");
const FOCUSED_STYLE_PATH = path.join(ROOT, "styles", "27-focused-content-media.css");

const mainSource = fs.readFileSync(MAIN_PATH, "utf8");
const mediaSource = fs.readFileSync(MEDIA_PATH, "utf8");
const styleIndex = fs.readFileSync(STYLE_INDEX_PATH, "utf8");
const focusedStyle = fs.readFileSync(FOCUSED_STYLE_PATH, "utf8");

assert.equal(
  (mainSource.match(/data-focused-card-media=/g) || []).length,
  3,
  "feature, row, and fallback article cards opt in"
);
for (const variant of ["feature", "row", "article"]) {
  assert.match(mainSource, new RegExp(`focused-card-media--${variant}`), `${variant} media variant is present`);
}
assert.match(mainSource, /hydrateFocusedMedia\?\.\(recentLessonFeature\)/, "feature media hydrates after render");
assert.match(mainSource, /hydrateFocusedMedia\?\.\(list\)/, "list media hydrates after render");
assert.doesNotMatch(
  mainSource.slice(mainSource.indexOf("function renderHeroCards"), mainSource.indexOf("function bindHeroSwipe")),
  /focused-card-media|data-focused-card-media/,
  "Hero cards do not opt into focused media"
);

const responsiveImport = styleIndex.indexOf('@import "./styles/40-responsive.css";');
const focusedImport = styleIndex.indexOf('@import "./styles/27-focused-content-media.css";');
assert.ok(focusedImport > responsiveImport, "focused media overrides load after legacy responsive image heights");
assert.equal(
  (styleIndex.match(/27-focused-content-media\.css/g) || []).length,
  1,
  "focused media style is imported once"
);
for (const required of [
  "#homeRecommended .focused-card-media",
  "--focused-card-media-size",
  "object-fit: cover",
  "overflow: hidden",
  ".larkix-cover-crop",
  'data-focused-media-state="failed"',
  "@media (max-width: 760px)"
]) {
  assert.ok(focusedStyle.includes(required), `focused style includes ${required}`);
}
assert.doesNotMatch(focusedStyle, /\.hero(?:\b|-)|#homeHero|hero-bg/i, "focused style has no Hero selector");
assert.doesNotMatch(focusedStyle, /aspect-ratio|16\s*[:/]\s*9|56\.25%/i, "focused media has no fixed 16:9 sizing");
assert.match(mediaSource, /function hydrateFocusedMedia\(/, "focused media hydrator is shared");
assert.match(mediaSource, /focusedMediaResizeObserver/, "focused media observes container resizes");
assert.match(mediaSource, /querySelector\?\.\(":scope > \[data-cover-crop\]"\)/, "crop replay uses the card-owned viewport");
assert.match(mediaSource, /addEventListener\("error"/, "failed images receive a stable state");
assert.match(mediaSource, /addEventListener\("load"/, "loaded images receive a ready state");

const mediaSandbox = { window: {} };
vm.createContext(mediaSandbox);
vm.runInContext(mediaSource, mediaSandbox);
const media = mediaSandbox.window.LarkixMedia;

const cropFixtures = [
  {
    id: "landscape",
    crop: { x: 0, y: 0, width: 1, height: 1, sourceWidth: 1920, sourceHeight: 1080 }
  },
  {
    id: "portrait",
    crop: {
      x: 0,
      y: 0.341796875,
      width: 1,
      height: 0.31640625,
      sourceWidth: 1080,
      sourceHeight: 1920
    }
  },
  {
    id: "square",
    crop: { x: 0, y: 0.21875, width: 1, height: 0.5625, sourceWidth: 1200, sourceHeight: 1200 }
  },
  {
    id: "ultra-wide",
    crop: { x: 0.25, y: 0, width: 0.5, height: 1, sourceWidth: 3840, sourceHeight: 1080 }
  }
];

const cardViewports = [
  { id: "desktop-feature", width: 548, height: 340 },
  { id: "desktop-row", width: 244, height: 96 },
  { id: "half-feature", width: 760, height: 280 },
  { id: "half-row", width: 365, height: 96 },
  { id: "mobile-feature", width: 336, height: 280 },
  { id: "mobile-row", width: 308, height: 210 }
];

for (const fixture of cropFixtures) {
  assert.deepEqual(JSON.parse(JSON.stringify(media.normalizeCrop(fixture.crop))), fixture.crop);
  for (const viewport of cardViewports) {
    const layout = media.cropLayout(fixture.crop, viewport.width, viewport.height);
    const sourceRatio = fixture.crop.sourceWidth / fixture.crop.sourceHeight;
    assert.ok(
      Math.abs(layout.width / layout.height - sourceRatio) < 1e-9,
      `${fixture.id}/${viewport.id}: natural proportions are preserved`
    );
    const cropLeft = layout.left + fixture.crop.x * layout.width;
    const cropTop = layout.top + fixture.crop.y * layout.height;
    const cropRight = cropLeft + fixture.crop.width * layout.width;
    const cropBottom = cropTop + fixture.crop.height * layout.height;
    assert.ok(cropLeft <= 0.000001, `${fixture.id}/${viewport.id}: crop covers left edge`);
    assert.ok(cropTop <= 0.000001, `${fixture.id}/${viewport.id}: crop covers top edge`);
    assert.ok(cropRight >= viewport.width - 0.000001, `${fixture.id}/${viewport.id}: crop covers right edge`);
    assert.ok(cropBottom >= viewport.height - 0.000001, `${fixture.id}/${viewport.id}: crop covers bottom edge`);
  }
}

const croppedMarkup = media.image("./fixture-media/portrait.svg", "portrait fixture", {
  className: "focused-card-media__image",
  crop: cropFixtures[1].crop
});
assert.match(croppedMarkup, /class="larkix-cover-crop"/, "saved S22 crop emits the shared crop host");
assert.match(croppedMarkup, /class="focused-card-media__image"/, "focused image class survives crop markup");

function fixtureSvg(name) {
  const fixtures = {
    square: { width: 720, height: 720, color: "#2563eb" },
    portrait: { width: 540, height: 960, color: "#db2777" },
    landscape: { width: 1280, height: 720, color: "#059669" },
    "ultra-wide": { width: 1920, height: 480, color: "#d97706" }
  };
  const fixture = fixtures[name] || fixtures.landscape;
  const radius = Math.round(Math.min(fixture.width, fixture.height) * 0.22);
  const fontSize = Math.round(Math.min(fixture.width, fixture.height) * 0.11);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fixture.width}" height="${fixture.height}" viewBox="0 0 ${fixture.width} ${fixture.height}">
  <rect width="100%" height="100%" fill="${fixture.color}" />
  <circle cx="50%" cy="50%" r="${radius}" fill="#ffffff" fill-opacity="0.82" />
  <path d="M0 ${fixture.height * 0.18}H${fixture.width}M0 ${fixture.height * 0.82}H${fixture.width}" stroke="#111827" stroke-width="${Math.max(8, fontSize * 0.1)}" />
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#111827">${name}</text>
</svg>`;
}

function imageMarkup(name, { crop = null, failed = false } = {}) {
  const source = failed ? "data:image/png;base64,broken" : `/fixture-media/${name}.svg`;
  const cropMarkup = crop
    ? ` class="larkix-cover-crop" data-cover-crop="true" data-cover-crop-x="${crop.x}" data-cover-crop-y="${crop.y}" data-cover-crop-width="${crop.width}" data-cover-crop-height="${crop.height}" data-cover-source-width="${crop.sourceWidth}" data-cover-source-height="${crop.sourceHeight}"`
    : "";
  const image = `<img class="focused-card-media__image" src="${source}" alt="${name} fixture" decoding="async" />`;
  return crop ? `<picture${cropMarkup}>${image}</picture>` : image;
}

function rowFixture(name, options = {}) {
  return `<article class="lesson-row" data-fixture="${name}">
  <a class="focused-card-media focused-card-media--row" data-focused-card-media="row" href="#${name}" aria-label="${name}">
    ${imageMarkup(name, options)}
  </a>
  <div>
    <div class="lesson-row-meta"><span class="category-pill">Fixture</span><span>${name}</span></div>
    <h3><a href="#${name}">${name} cover</a></h3>
    <p>圆形与文字用于检查等比裁切、完整填充和响应式重放。</p>
  </div>
</article>`;
}

function browserFixtureHtml() {
  const portraitCrop = cropFixtures.find((fixture) => fixture.id === "portrait").crop;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S25 focused content media fixture</title>
  <link rel="stylesheet" href="/styles.css" />
  <style>
    body { margin: 0; }
    .fixture-hero { margin-block: 16px; }
    .fixture-shell { padding-block-end: 32px; }
    .fixture-summary { position: relative; z-index: 2; color: #fff; padding: 24px; }
  </style>
  <script>
    window.__focusedMediaResourceErrors = [];
    addEventListener("error", function (event) {
      if (event.target && (event.target.src || event.target.href)) {
        window.__focusedMediaResourceErrors.push(event.target.src || event.target.href);
      }
    }, true);
  </script>
</head>
<body>
  <main class="fixture-shell">
    <section class="site-shell hero fixture-hero" id="fixtureHero">
      <img class="hero-bg is-active" src="/fixture-media/landscape.svg" alt="Hero independence fixture" />
      <div class="fixture-summary"><h1>Hero independence fixture</h1></div>
    </section>
    <section class="site-shell section-row" id="homeRecommended">
      <div class="section-heading"><div class="section-title-block split-title"><h2>聚焦内容</h2><span>Focused Picks</span></div></div>
      <div class="home-lesson-layout">
        <article class="lesson-feature" data-fixture="feature">
          <div class="lesson-feature-copy"><span class="category-pill">Fixture</span><h3><a href="#feature">Square feature cover</a></h3></div>
          <a class="lesson-feature-media focused-card-media focused-card-media--feature" data-focused-card-media="feature" href="#feature" aria-label="feature">
            ${imageMarkup("square")}
          </a>
        </article>
        <div class="lesson-list">
          ${rowFixture("square")}
          ${rowFixture("portrait", { crop: portraitCrop })}
          ${rowFixture("landscape")}
          ${rowFixture("ultra-wide")}
          ${rowFixture("failed", { failed: true })}
        </div>
      </div>
    </section>
  </main>
  <script src="/data/media.js"></script>
  <script>
    (function () {
      function waitForImage(image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }

      Promise.all(Array.from(document.images).map(waitForImage)).then(function () {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            window.__collectFocusedMediaEvidence = function () {
              var hosts = Array.from(document.querySelectorAll("[data-focused-card-media]")).map(function (host) {
                var image = host.querySelector("img");
                var hostRect = host.getBoundingClientRect();
                var imageRect = image.getBoundingClientRect();
                var cropped = Boolean(host.querySelector("[data-cover-crop]"));
                return {
                  fixture: host.closest("[data-fixture]").dataset.fixture,
                  variant: host.dataset.focusedCardMedia,
                  state: host.dataset.focusedMediaState,
                  cropped: cropped,
                  host: { width: hostRect.width, height: hostRect.height, left: hostRect.left, right: hostRect.right, top: hostRect.top, bottom: hostRect.bottom },
                  image: { width: imageRect.width, height: imageRect.height, left: imageRect.left, right: imageRect.right, top: imageRect.top, bottom: imageRect.bottom },
                  natural: { width: image.naturalWidth, height: image.naturalHeight },
                  objectFit: getComputedStyle(image).objectFit,
                  overflow: getComputedStyle(host).overflow,
                  fills: cropped
                    ? imageRect.left <= hostRect.left + 0.6 && imageRect.right >= hostRect.right - 0.6 && imageRect.top <= hostRect.top + 0.6 && imageRect.bottom >= hostRect.bottom - 0.6
                    : getComputedStyle(image).objectFit === "cover"
                };
              });
              var hero = document.querySelector("#fixtureHero");
              var heroImage = hero.querySelector(".hero-bg");
              var heroRect = hero.getBoundingClientRect();
              return {
                viewport: { width: innerWidth, height: innerHeight },
                hosts: hosts,
                hero: {
                  width: heroRect.width,
                  height: heroRect.height,
                  imageWidth: heroImage.getBoundingClientRect().width,
                  imageHeight: heroImage.getBoundingClientRect().height,
                  objectFit: getComputedStyle(heroImage).objectFit,
                  focusedOptIn: hero.hasAttribute("data-focused-card-media") || heroImage.hasAttribute("data-focused-card-media")
                },
                pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                unexpectedResourceErrors: window.__focusedMediaResourceErrors.filter(function (url) {
                  return !String(url).startsWith("data:image/png;base64,broken");
                })
              };
            };
            document.documentElement.dataset.evidenceReady = "true";
          });
        });
      });
    })();
  </script>
</body>
</html>`;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css",
    ".js": "application/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  }[extension] || "application/octet-stream";
}

function serveBrowserFixture(port) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (url.pathname === "/fixture") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(browserFixtureHtml());
      return;
    }
    const fixtureMatch = url.pathname.match(/^\/fixture-media\/(square|portrait|landscape|ultra-wide)\.svg$/);
    if (fixtureMatch) {
      response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" });
      response.end(fixtureSvg(fixtureMatch[1]));
      return;
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relativePath);
    const allowed =
      filePath.startsWith(`${ROOT}${path.sep}`) &&
      [".css", ".js", ".svg", ".png", ".webp", ".woff", ".woff2"].includes(path.extname(filePath).toLowerCase());
    if (!allowed || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(response);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Focused media browser fixture: http://127.0.0.1:${port}/fixture`);
  });
}

console.log(
  `Focused content media fixtures passed: ${cropFixtures.map((fixture) => fixture.id).join(", ")} across ${cardViewports.length} card viewports.`
);

if (process.argv[2] === "--serve") {
  const port = Number.parseInt(process.argv[3], 10) || 5572;
  serveBrowserFixture(port);
}
