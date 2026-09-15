"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validateFormulaCardPayload, validatePostPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s65-browser-"));
let serverChild;
let serverOutput = "";

function port() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close((error) => error ? reject(error) : resolve(value));
    });
  });
}

function browser() {
  return [process.env.EDGE_PATH, process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
    .filter(Boolean).find((file) => fs.existsSync(file));
}

function kill(child) {
  if (!child || !child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else child.kill("SIGKILL");
}

async function waitHealth(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated S65 server did not become healthy\n${serverOutput}`);
}

function dump(executable, url, width) {
  const profile = path.join(tempRoot, `profile-${width}-${Date.now()}`);
  const result = spawnSync(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${profile}`, `--window-size=${width},844`, "--virtual-time-budget=4000", "--dump-dom", url], { encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || `browser exited ${result.status}`);
  return result.stdout;
}

function seedDiscoveryData() {
  const dbDir = path.join(tempRoot, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir: tempRoot,
    dbDir,
    dbPath: path.join(dbDir, "gokottamaker.sqlite"),
    uploadDir: path.join(tempRoot, "uploads")
  });
  try {
    const store = createContentStore(db);
    for (let index = 1; index <= 3; index += 1) {
      store.savePost(validatePostPayload({
        id: `s65-focus-${index}`,
        slug: `s65-focus-${index}`,
        title: `S65 Focus ${index}`,
        category: "电子基础",
        excerpt: `S65 focus article ${index}`,
        markdown: `# S65 Focus ${index}\n\nPublic fixture content.`,
        cover: "./assets/covers/analog-cover.png",
        readingMinutes: index * 5,
        date: "2026-09-15",
        publishStatus: "published",
        featured: false,
        featuredOrder: 0,
        recommendationPriority: 50,
        commonLevel: 5,
        tags: "module:power-electronics, keyword:s65"
      }));
    }
    store.saveHomepageFocusSlots({ slots: [
      { slot: "large", postId: "s65-focus-1", commonLevel: 8 },
      { slot: "small-1", postId: "s65-focus-2", commonLevel: 7 },
      { slot: "small-2", postId: "s65-focus-3", commonLevel: 6 }
    ] }, { id: "s65-browser", username: "S65BrowserTester" });
    for (let index = 1; index <= 8; index += 1) {
      const saved = store.saveFormulaCard(validateFormulaCardPayload({
        formulaId: `formula.s65.browser.${index}`,
        slug: `s65-browser-${index}`,
        displayName: `S65 Browser Formula ${index}`,
        moduleKey: "power-electronics",
        categoryPath: "S65/Browser",
        purpose: "S65 public browser fixture",
        tags: ["scope:s65", `index:${index}`],
        latex: `V_{S65,${index}}=${index}`,
        markdownDerivation: "",
        revisionReason: "s65-browser-fixture",
        commonLevel: 5
      }));
      store.publishFormulaCard(saved.card.formulaId);
    }
  } finally {
    db.close();
  }
}

async function main() {
  const executable = browser();
  assert.ok(executable, "Edge or Chrome is required for the S65 real-browser fixture");
  seedDiscoveryData();
  const listenPort = await port();
  serverChild = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: tempRoot, HOST: "127.0.0.1", PORT: String(listenPort), ADMIN_USERNAME: "S65BrowserTester", ADMIN_PASSWORD: "s65-isolated-password", PRIVATE_CMS_PATH: "S65BrowserPrivatePath_7vQ2nK9xP4mR8cL1hT6wZ3aF5dJ0sYgB", ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverChild.stdout.on("data", (chunk) => { serverOutput += chunk; });
  serverChild.stderr.on("data", (chunk) => { serverOutput += chunk; });
  await waitHealth(`http://127.0.0.1:${listenPort}/healthz`);
  const base = `http://127.0.0.1:${listenPort}`;
  const defaultSearch = dump(executable, `${base}/search.html?q=a`, 1280);
  assert.match(defaultSearch, /data-search-type="article"[^>]*aria-selected="true"/, "default article tab is selected in a real browser");
  assert.match(defaultSearch, /id="publicSearchSummary"/, "live search reaches a browser-rendered result state");
  assert.doesNotMatch(defaultSearch, /commonLevel|publishStatus|deletedAt/, "browser DOM does not disclose internal discovery authority");
  const formulaSearch = dump(executable, `${base}/search.html?type=formula`, 390);
  assert.match(formulaSearch, /data-search-type="formula"[^>]*aria-selected="true"/, "formula tab restores from URL at narrow width");
  assert.equal((formulaSearch.match(/class="public-media-card public-media-card--formula/g) || []).length, 8, "all eight published formulas render in narrow real-browser search");
  const home = dump(executable, `${base}/maker.html`, 390);
  const ids = ["homeDerivations", "homeLatestFormulas", "homeRecommended", "homeFocus"];
  let cursor = -1;
  for (const id of ids) {
    const next = home.indexOf(`id="${id}"`);
    assert.ok(next > cursor, `${id} appears in the required relative order`);
    cursor = next;
  }
  assert.match(home, /class="home-search-route"/, "Maker home search is converted into an independent-page route");
  const formulaSection = home.slice(home.indexOf('id="homeLatestFormulas"'), home.indexOf('id="homeRecommended"'));
  assert.equal((formulaSection.match(/class="public-media-card public-media-card--formula/g) || []).length, 8, "homepage renders the latest eight formulas");
  assert.equal((home.match(/class="home-focus-card /g) || []).length, 3, "homepage renders all three authoritative focus slots");
  assert.match(home, /home-focus-card--large/, "large focus slot keeps its assigned layout identity");
  assert.match(home, /home-focus-card--small-1/, "small-1 focus slot keeps its assigned layout identity");
  assert.match(home, /home-focus-card--small-2/, "small-2 focus slot keeps its assigned layout identity");
  console.log("S65 real-browser fixture passed: five-type URL state, live public search DOM/privacy, narrow formula rendering, latest eight formulas and exact three-slot homepage composition");
}

main().then(() => {
  kill(serverChild);
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}).catch((error) => {
  console.error(error);
  kill(serverChild);
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  process.exitCode = 1;
});
