"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PRIVATE_PATH = "S66ThemeFooterBrowser_7vQ2nK9xP4mR8cL1hT6wZ3aF5dJ0sYgB";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s66-browser-"));
const browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s66-cdp-"));
let serverChild;
let browserChild;
let serverOutput = "";

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function browserExecutable() {
  return [process.env.EDGE_PATH, process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
    .filter(Boolean).find((file) => fs.existsSync(file));
}

function kill(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else child.kill("SIGKILL");
}

function removeOwned(directory, prefix) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()), `refusing to remove non-temp path ${resolved}`);
  assert.ok(path.basename(resolved).startsWith(prefix), `refusing to remove unowned path ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
}

async function pollJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser endpoint unavailable: ${url}`);
}

async function waitHealth(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated S66 server unavailable\n${serverOutput}`);
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); this.waiters = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const waiter of [...(this.waiters.get(message.method) || [])]) waiter(message.params || {});
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result || {});
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP connect timeout")), 10000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP connect failed")); }, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method) {
    return new Promise((resolve) => {
      const complete = (params) => {
        this.waiters.get(method)?.delete(complete);
        resolve(params);
      };
      const set = this.waiters.get(method) || new Set();
      set.add(complete);
      this.waiters.set(method, set);
    });
  }
  close() { this.socket?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function navigate(client, url) {
  const loaded = client.wait("Page.loadEventFired");
  const result = await client.send("Page.navigate", { url });
  assert.ok(!result.errorText, `navigation failed: ${result.errorText || url}`);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function pageState(client, selector = "") {
  return evaluate(client, `(() => {
    const cards = ${JSON.stringify(selector)} ? [...document.querySelectorAll(${JSON.stringify(selector)})] : [];
    return {
      href: location.href,
      theme: document.documentElement.dataset.theme,
      firstFrameTheme: window.__s66FirstFrameTheme || (window.__s66ThemeTrace || [])[0],
      trace: window.__s66ThemeTrace || [],
      storedTheme: localStorage.getItem('larkixmaker-theme'),
      version: document.querySelector('.site-version')?.textContent.trim() || '',
      filing: document.querySelector('.site-filing')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      filingLinks: [...document.querySelectorAll('.site-filing a')].map((link) => ({href:link.href,target:link.target,rel:link.rel})),
      iconFirst: Boolean(document.querySelector('.site-filing a[href*="beian.mps.gov.cn"] > img:first-child')),
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cards: cards.map((card) => ({width:card.getBoundingClientRect().width, parentWidth:card.parentElement.getBoundingClientRect().width}))
    };
  })()`);
}

async function main() {
  const executable = browserExecutable();
  assert.ok(executable, "Edge or Chrome is required for S66 browser verification");
  const listenPort = await availablePort();
  serverChild = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: tempRoot, HOST: "127.0.0.1", PORT: String(listenPort), ADMIN_USERNAME: "S66BrowserTester", ADMIN_PASSWORD: "s66-isolated-password", PRIVATE_CMS_PATH: PRIVATE_PATH, ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverChild.stdout.on("data", (chunk) => { serverOutput += chunk; });
  serverChild.stderr.on("data", (chunk) => { serverOutput += chunk; });
  const base = `http://127.0.0.1:${listenPort}`;
  await waitHealth(`${base}/healthz`);
  assert.equal((await fetch(`${base}/data/theme-init.js`)).status, 200, "theme initializer is publicly served");
  assert.equal((await fetch(`${base}/assets/icons/beian.png`)).status, 200, "filing icon is publicly served");

  const debugPort = await availablePort();
  browserChild = spawn(executable, ["--headless=new", "--disable-gpu", "--force-dark-mode", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${browserProfile}`, `${base}/index.html`], { stdio: "ignore", windowsHide: true });
  const targets = await pollJson(`http://127.0.0.1:${debugPort}/json/list`);
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(base));
  assert.ok(target?.webSocketDebuggerUrl, "S66 browser page target is available");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__s66ThemeTrace=[];
    document.addEventListener('DOMContentLoaded', () => {
      window.__s66FirstFrameTheme=document.documentElement.dataset.theme || '';
      window.__s66ThemeTrace.push(window.__s66FirstFrameTheme);
    }, {once:true});
  ` });

  await navigate(client, `${base}/index.html?s66=origin`);
  await evaluate(client, `localStorage.clear()`);
  await navigate(client, `${base}/index.html?s66=unset`);
  let state = await pageState(client, ".larkix-product-card");
  assert.equal(state.theme, "light", "unset preference defaults to light even under forced dark system preference");
  assert.equal(state.firstFrameTheme, "light", "unset preference paints its first frame light");
  assert.ok(state.trace.every((theme) => theme === "light"), `unset load never applies an opposite theme: ${state.trace}`);
  assert.equal(state.version, "LarkixMaker v2.5.5 · Build 20260911.0001");
  assert.match(state.filing, /粤ICP备2026065094号-1/);
  assert.match(state.filing, /粤公网安备44522402000188号/);
  assert.equal(state.iconFirst, true);
  assert.equal(state.filingLinks[1].target, "_blank");
  assert.equal(state.filingLinks[1].rel, "noreferrer");

  await evaluate(client, `localStorage.setItem('larkixmaker-theme','invalid')`);
  await navigate(client, `${base}/maker.html?s66=invalid`);
  state = await pageState(client, ".focus-entry-card");
  assert.equal(state.theme, "light", "invalid preference defaults to light");
  assert.equal(state.firstFrameTheme, "light", "invalid preference paints light first");

  await evaluate(client, `localStorage.setItem('larkixmaker-theme','dark')`);
  await navigate(client, `${base}/miniapps.html?s66=dark`);
  state = await pageState(client, ".miniapp-card");
  assert.equal(state.theme, "dark");
  assert.equal(state.firstFrameTheme, "dark", "saved dark preference paints dark first");
  assert.ok(state.trace.every((theme) => theme === "dark"), `dark load never applies an opposite theme: ${state.trace}`);
  await navigate(client, `${base}/search.html?type=miniapp&s66=dark-nav`);
  state = await pageState(client, ".public-media-card");
  assert.equal(state.firstFrameTheme, "dark", "cross-page dark navigation remains dark from first frame");

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const [route, selector] of [["index.html", ".larkix-product-card"], ["maker.html", ".focus-entry-card"], ["miniapps.html", ".miniapp-card"], ["search.html?type=miniapp", ".public-media-card"]]) {
    await navigate(client, `${base}/${route}${route.includes("?") ? "&" : "?"}s66=mobile`);
    state = await pageState(client, selector);
    assert.ok(state.scrollWidth <= state.width, `${route} has no horizontal overflow at 390px (${state.scrollWidth}/${state.width})`);
    assert.ok(state.cards.length > 0, `${route} renders target cards at 390px`);
    assert.ok(state.cards.every((card) => card.width <= card.parentWidth + 1), `${route} cards remain full-width within their single column`);
  }

  await navigate(client, `${base}/${PRIVATE_PATH}/admin/`);
  state = await pageState(client);
  assert.equal(state.version, "LarkixMaker v2.5.5 · Build 20260911.0001", "CMS keeps professional version display");
  assert.equal(state.filing, "", "CMS never renders public filing information");
  assert.equal(state.firstFrameTheme, "dark", "CMS uses saved dark preference before first paint");
  client.close();
  console.log("S66 real-browser fixture passed: forced-system first frames, cross-page persistence, exact public filing, CMS exclusion and 390px card/footer containment");
}

main().then(() => {
  kill(browserChild);
  kill(serverChild);
  removeOwned(browserProfile, "larkix-s66-cdp-");
  removeOwned(tempRoot, "larkix-s66-browser-");
}).catch((error) => {
  console.error(error);
  kill(browserChild);
  kill(serverChild);
  try { removeOwned(browserProfile, "larkix-s66-cdp-"); } catch (cleanupError) { console.error(cleanupError); }
  try { removeOwned(tempRoot, "larkix-s66-browser-"); } catch (cleanupError) { console.error(cleanupError); }
  process.exitCode = 1;
});
