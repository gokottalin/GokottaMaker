"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pages = [
  "404.html", "category.html", "derive.html", "formula.html", "index.html", "maker.html",
  "miniapps.html", "post.html", "project.html", "projects.html", "search.html",
  "tools/gokotta-elec.html", "tools/larkix-elec.html", "tools/md2doc.html",
  "admin/index.html", "admin/course-paths.html"
];

for (const file of pages) {
  const html = read(file);
  const themeIndex = html.indexOf("theme-init.js");
  const styleIndex = html.indexOf('rel="stylesheet"');
  assert.ok(themeIndex >= 0, `${file} loads the blocking theme initializer`);
  assert.ok(styleIndex < 0 || themeIndex < styleIndex, `${file} applies theme before its first stylesheet`);
  assert.equal((html.match(/theme-init\.js/g) || []).length, 1, `${file} loads theme initializer exactly once`);
  assert.equal((html.match(/site-meta\.js/g) || []).length, 1, `${file} loads authoritative site metadata exactly once`);
  assert.equal((html.match(/footer\.js/g) || []).length, 1, `${file} loads the shared footer exactly once`);
}

const themeInit = read("data/theme-init.js");
assert.match(themeInit, /let theme = "light"/, "unset storage deterministically defaults to light");
assert.match(themeInit, /storedTheme === "light" \|\| storedTheme === "dark"/, "only stored light and dark values are accepted");
assert.doesNotMatch(themeInit, /matchMedia|prefers-color-scheme/, "first-paint theme never follows the system preference");

const footer = read("data/footer.js");
assert.doesNotMatch(footer, /const systemTheme|prefers-color-scheme: dark/, "late footer initialization never follows system theme");
assert.match(footer, /meta\.version[\s\S]*replace\(\/\^v\/i, ""\)/, "display semver derives from authoritative metadata");
assert.match(footer, /meta\.build[\s\S]*replace\(\/-\/g, "\."\)/, "display build derives from authoritative metadata");
assert.match(footer, /LarkixMaker"\} v\$\{version\} · Build \$\{build\}/, "professional version format is projected once");
assert.match(footer, /isCms[\s\S]*\? "" : `<nav class="site-filing"/, "CMS omits filing while keeping the version footer");
assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\/[\s\S]*粤ICP备2026065094号-1/, "ICP number links to MIIT");
assert.match(footer, /href="https:\/\/beian\.mps\.gov\.cn\/#\/query\/webSearch\?code=44522402000188" target="_blank" rel="noreferrer"><img src="\/assets\/icons\/beian\.png"[\s\S]*粤公网安备44522402000188号/, "public-security icon precedes exact filing text and safe external link");

const meta = read("data/site-meta.js");
assert.match(meta, /productName: "LarkixMaker"/);
assert.match(meta, /version: "V2\.5\.5"/);
assert.match(meta, /build: "20260911-0001"/);

const css = [read("styles/00-base.css"), read("styles/20-content.css"), read("styles/larkix-home.css"), read("styles/larkix-elec.css"), read("styles/gokotta-elec.css"), read("styles/40-responsive.css")].join("\n");
for (const token of ["--public-card-radius", "--public-card-padding", "--public-card-gap", "--public-card-border", "--public-card-bg", "--public-card-shadow"]) {
  assert.match(css, new RegExp(token), `${token} shared visual token exists`);
}
for (const selector of [".larkix-product-card", ".miniapp-card", ".public-media-card", ".home-focus-card", ".focus-entry-card"]) {
  assert.match(css, new RegExp(selector.replace(".", "\\.")), `${selector} participates in the shared card system`);
}
assert.match(read("styles/40-responsive.css"), /@media \(max-width: 760px\)[\s\S]*\.public-media-grid,[\s\S]*\.larkix-product-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, "all target grids collapse to a full-width mobile column");
assert.match(read("styles/40-responsive.css"), /\.site-footer-inner[\s\S]*flex-direction: column/, "mobile filing footer wraps vertically without overflow");

const server = read("server.js");
assert.equal((server.match(/"\/data\/theme-init\.js"/g) || []).length, 1, "theme initializer has one exact focused-public allowlist entry");
assert.equal((server.match(/"\/assets\/icons\/beian\.png"/g) || []).length, 1, "filing icon has one exact focused-public allowlist entry");

const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sourceIcon = "C:\\Users\\10731\\Downloads\\备案图标.png";
const projectIcon = path.join(root, "assets", "icons", "beian.png");
assert.ok(fs.existsSync(sourceIcon), "Owner filing icon source exists");
assert.equal(digest(projectIcon), digest(sourceIcon), "project filing icon is an exact byte copy");

console.log("S66 focused static checks passed: 16 pre-style theme gates, deterministic themes, shared cards, professional version, scoped filings and exact icon/static allowlists");
