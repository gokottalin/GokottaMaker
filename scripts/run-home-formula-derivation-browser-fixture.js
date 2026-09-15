"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s68-browser-"));
const browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s68-cdp-"));
let serverChild;
let browserChild;
let serverOutput = "";

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close((error) => error ? reject(error) : resolve(value));
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
  throw new Error(`isolated S68 server unavailable\n${serverOutput}`);
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
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method) {
    return new Promise((resolve) => {
      const complete = (params) => { this.waiters.get(method)?.delete(complete); resolve(params); };
      const set = this.waiters.get(method) || new Set();
      set.add(complete); this.waiters.set(method, set);
    });
  }
  close() { this.socket?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitFor(client, expression, message, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await evaluate(client, `Boolean(${expression})`)) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${message}`);
}

async function navigate(client, url) {
  const loaded = client.wait("Page.loadEventFired");
  const result = await client.send("Page.navigate", { url });
  assert.ok(!result.errorText, `navigation failed: ${result.errorText || url}`);
  await loaded;
}

async function reload(client) {
  const loaded = client.wait("Page.loadEventFired");
  await client.send("Page.reload", { ignoreCache: true });
  await loaded;
}

async function clickPoint(client, selector, touch = false) {
  const point = await evaluate(client, `(() => { const target=document.querySelector(${JSON.stringify(selector)}); target.scrollIntoView({block:'center'}); const r=target.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  if (touch) {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, radiusX: 2, radiusY: 2, force: 1 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  }
}

function formula(key, overrides = {}) {
  return validateFormulaCardPayload({
    formulaId: `formula.s68.${key}`,
    slug: `s68-${key}`,
    displayName: `S68 ${key.toUpperCase()} Formula`,
    moduleKey: "power-electronics",
    categoryPath: "S68/Browser",
    purpose: "S68 isolated browser fixture",
    tags: ["scope:s68", `key:${key}`],
    latex: `V_{${key}}=${key.length}`,
    markdownDerivation: "",
    revisionReason: "s68-browser-fixture",
    commonLevel: 5,
    ...overrides
  });
}

function seedData() {
  const dbDir = path.join(tempRoot, "database");
  const db = createDatabase({ root: ROOT, dataDir: tempRoot, dbDir, dbPath: path.join(dbDir, "gokottamaker.sqlite"), uploadDir: path.join(tempRoot, "uploads") });
  try {
    const store = createContentStore(db);
    const c = store.saveFormulaCard(formula("c")); store.publishFormulaCard(c.card.formulaId);
    const b = store.saveFormulaCard(formula("b", { markdownDerivation: `{{formula-ref:${c.card.formulaId}}}` })); store.publishFormulaCard(b.card.formulaId);
    const a = store.saveFormulaCard(formula("a", { markdownDerivation: `{{formula-ref:${b.card.formulaId}}}` })); store.publishFormulaCard(a.card.formulaId);
    const root = store.saveFormulaCard(formula("root")); store.publishFormulaCard(root.card.formulaId);
    const long = store.saveFormulaCard(formula("long", { latex: String.raw`V_{out}=V_{in}\cdot\frac{R_2}{R_1+R_2}+I_{load}\cdot\left(L\frac{di}{dt}+R_{ESR}+R_{trace}+R_{sense}\right)+\sum_{k=1}^{24}\frac{V_k}{k}` }));
    store.publishFormulaCard(long.card.formulaId);
    const invalid = store.saveFormulaCard(formula("invalid"));
    store.publishFormulaCard(invalid.card.formulaId);
  } finally {
    db.close();
  }
}

async function main() {
  const executable = browserExecutable();
  assert.ok(executable, "Edge or Chrome is required for S68 browser verification");
  seedData();
  const listenPort = await availablePort();
  serverChild = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: tempRoot, HOST: "127.0.0.1", PORT: String(listenPort), ADMIN_USERNAME: "S68BrowserTester", ADMIN_PASSWORD: "s68-isolated-password", PRIVATE_CMS_PATH: "S68BrowserPrivatePath_7vQ2nK9xP4mR8cL1hT6wZ3aF5dJ0sYgB", ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverChild.stdout.on("data", (chunk) => { serverOutput += chunk; });
  serverChild.stderr.on("data", (chunk) => { serverOutput += chunk; });
  const base = `http://127.0.0.1:${listenPort}`;
  await waitHealth(`${base}/healthz`);

  for (const route of ["/formula/s68-a", "/formula.js", "/formula-graph.js", "/styles/40-formula.css", "/assets/vendor/katex/katex.min.js", "/assets/vendor/cytoscape.min.js", "/data/math-renderer.js"]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `public route whitelist blocked ${route}: HTTP ${response.status}`);
  }

  const debugPort = await availablePort();
  browserChild = spawn(executable, ["--headless=new", "--disable-gpu", "--window-size=1280,900", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${browserProfile}`, `${base}/index.html`], { stdio: "ignore", windowsHide: true });
  const targets = await pollJson(`http://127.0.0.1:${debugPort}/json/list`);
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(base));
  assert.ok(target?.webSocketDebuggerUrl, "S68 browser page target is available");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const target = String(args[0] || '');
        if (!target.includes('/api/formulas/s68-invalid') || !response.ok) return response;
        const payload = await response.clone().json();
        payload.card.latex = '\\\\notARealCommand{';
        for (const node of payload.card.graph?.nodes || []) {
          if (node.current) node.latex = payload.card.latex;
        }
        return new Response(JSON.stringify(payload), { status: response.status, headers: { 'Content-Type': 'application/json' } });
      };
    })();
  ` });

  await navigate(client, `${base}/index.html`);
  await waitFor(client, `document.readyState==='complete' && document.querySelector('.home-search-clear')`, "landing search controls");
  await evaluate(client, `(() => { localStorage.setItem('larkixmaker-theme','light'); const i=document.querySelector('#larkixHomeSearch'); i.value='touch-clear'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await waitFor(client, `!document.querySelector('.home-search-clear').hidden`, "visible landing clear control");
  await clickPoint(client, ".home-search-clear", true);
  assert.deepEqual(await evaluate(client, `({value:document.querySelector('#larkixHomeSearch').value,focused:document.activeElement===document.querySelector('#larkixHomeSearch'),hidden:document.querySelector('.home-search-clear').hidden})`), { value: "", focused: true, hidden: true }, "touch clear removes all text once and retains focus");
  await evaluate(client, `(() => { const i=document.querySelector('#larkixHomeSearch'); i.value='formula icon'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await clickPoint(client, ".home-search-submit");
  await waitFor(client, `location.pathname==='/search.html' && new URL(location.href).searchParams.get('q')==='formula icon'`, "mouse icon search navigation");
  assert.deepEqual(await evaluate(client, `({path:location.pathname,q:new URL(location.href).searchParams.get('q')})`), { path: "/search.html", q: "formula icon" }, "mouse icon submits current landing keyword to the existing route");

  await navigate(client, `${base}/maker.html`);
  await waitFor(client, `document.querySelector('.home-search-submit')`, "Maker search controls");
  await evaluate(client, `(() => { const i=document.querySelector('#siteSearch'); i.focus(); i.value='x'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await client.send("Input.dispatchKeyEvent", { type: "char", text: "\r", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await waitFor(client, `location.pathname==='/search.html' && new URL(location.href).searchParams.get('q')==='x'`, "keyboard Enter search navigation");
  assert.deepEqual(await evaluate(client, `({path:location.pathname,q:new URL(location.href).searchParams.get('q')})`), { path: "/search.html", q: "x" }, "keyboard Enter submits the same Maker search route");

  await navigate(client, `${base}/maker.html?s68=desktop-light`);
  await waitFor(client, `document.querySelectorAll('#homeLatestFormulas .public-media-card--formula').length >= 6 && document.querySelector('#homeLatestFormulas .katex')`, "rendered homepage formulas");
  let home = await evaluate(client, `(() => {
    const cards=[...document.querySelectorAll('#homeLatestFormulas .public-media-card--formula')];
    const grid=document.querySelector('.home-miniapp-grid');
    while(grid.children.length<3) grid.append(grid.firstElementChild.cloneNode(true));
    const mini=[...grid.children];
    const style=getComputedStyle(mini[0]);
    return {theme:document.documentElement.dataset.theme,width:innerWidth,bodyClass:document.body.className,gridColumns:getComputedStyle(grid).gridTemplateColumns,scrollWidth:document.documentElement.scrollWidth,formulaCount:cards.length,rendered:cards.filter(c=>c.querySelector('.katex')).length,ids:cards.map(c=>c.dataset.formulaId),mini:mini.map(c=>({x:Math.round(c.getBoundingClientRect().x),y:Math.round(c.getBoundingClientRect().y),width:Math.round(c.getBoundingClientRect().width)})),style:{background:style.backgroundColor,border:style.borderTopWidth,radius:style.borderRadius,shadow:style.boxShadow,padding:style.paddingTop}};
  })()`);
  assert.equal(home.theme, "light");
  assert.ok(home.formulaCount >= 6 && home.rendered >= 5, "homepage renders published conclusions with KaTeX and keeps invalid fallback stable");
  assert.ok(home.ids.every((id) => id.startsWith("formula.s68.")), "homepage keeps complete formulaId values");
  assert.ok(home.mini.every((card) => card.width === home.mini[0].width), "desktop miniapp cards are equal width");
  assert.ok(home.mini.every((card) => card.y === home.mini[0].y), `desktop miniapp cards remain in one row: ${JSON.stringify(home.mini)} at ${home.width}px, body=${home.bodyClass}, columns=${home.gridColumns}`);
  assert.notEqual(home.style.background, "rgba(0, 0, 0, 0)");
  assert.notEqual(home.style.border, "0px");
  assert.notEqual(home.style.radius, "0px");
  assert.notEqual(home.style.shadow, "none");
  assert.notEqual(home.style.padding, "0px");
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
  await evaluate(client, `(() => { document.documentElement.style.scrollBehavior='auto'; document.querySelector('.home-miniapp-card').scrollIntoView({block:'center'}); })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const hoverPoint = await evaluate(client, `(() => { const r=document.querySelector('.home-miniapp-card').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hoverPoint.x, y: hoverPoint.y, buttons: 0, pointerType: "mouse" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const hoverState = await evaluate(client, `(() => { const target=document.querySelector('.home-miniapp-card'); const hit=document.elementFromPoint(${hoverPoint.x},${hoverPoint.y}); return {transform:getComputedStyle(target).transform,hover:target.matches(':hover'),hit:hit?.className || hit?.tagName || null}; })()`);
  assert.notEqual(hoverState.transform, "none", `desktop mouse hover produces visible card feedback: ${JSON.stringify(hoverState)}`);

  await evaluate(client, `localStorage.setItem('larkixmaker-theme','dark')`);
  await navigate(client, `${base}/maker.html?s68=desktop-dark`);
  await waitFor(client, `document.querySelector('#homeLatestFormulas .katex')`, "dark homepage formulas");
  const darkCard = await evaluate(client, `(() => { const s=getComputedStyle(document.querySelector('.home-miniapp-card')); return {theme:document.documentElement.dataset.theme,bg:s.backgroundColor,shadow:s.boxShadow}; })()`);
  assert.equal(darkCard.theme, "dark");
  assert.notEqual(darkCard.bg, "rgba(0, 0, 0, 0)");
  assert.notEqual(darkCard.shadow, "none", "dark miniapp card uses the active shared theme tokens");

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(client, `${base}/maker.html?s68=mobile`);
  await waitFor(client, `document.querySelector('#homeLatestFormulas .public-media-card--formula')`, "mobile homepage formulas");
  home = await evaluate(client, `(() => { const grid=document.querySelector('.home-miniapp-grid'); while(grid.children.length<3) grid.append(grid.firstElementChild.cloneNode(true)); const cards=[...grid.children].map(c=>c.getBoundingClientRect()); return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:cards.map(r=>({x:Math.round(r.x),width:Math.round(r.width)})),parent:Math.round(grid.getBoundingClientRect().width)}; })()`);
  assert.ok(home.scrollWidth <= home.width, `Maker homepage has no 390px horizontal overflow (${home.scrollWidth}/${home.width})`);
  assert.ok(home.cards.every((card) => card.x === home.cards[0].x && card.width <= home.parent + 1), "390px miniapps are a single full-width column");

  await navigate(client, `${base}/formula/s68-a`);
  await waitFor(client, `document.querySelector('.formula-single-card .katex')`, "default formula view");
  let formulaState = await evaluate(client, `({view:document.querySelector('[aria-selected="true"]').dataset.formulaView,cards:document.querySelectorAll('.formula-single-card').length,markdown:document.querySelectorAll('.formula-markdown-derivation,.formula-purpose-public').length,href:location.href,overflow:document.documentElement.scrollWidth-innerWidth})`);
  assert.deepEqual(formulaState, { view: "formula", cards: 1, markdown: 0, href: `${base}/formula/s68-a`, overflow: 0 }, "plain card/search entry defaults to the single-card formula view");

  await evaluate(client, `document.querySelector('[data-open-derivation]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const derivationDebug = await evaluate(client, `({active:document.querySelector('[aria-selected="true"]')?.dataset.formulaView||'',nodes:document.querySelectorAll('.formula-graph-node').length,host:document.querySelector('#publicFormulaGraph')?.innerHTML.slice(0,180)||'',graphType:typeof window.LarkixFormulaGraph,cyType:typeof window.cytoscape,href:location.href})`);
  if (derivationDebug.active !== "derivation" || derivationDebug.nodes < 1) console.error("S68 derivation debug", derivationDebug);
  await waitFor(client, `document.querySelector('[data-formula-view="derivation"]').getAttribute('aria-selected')==='true' && document.querySelector('.formula-graph-node')`, "derivation view");
  assert.match(await evaluate(client, `location.search`), /view=derivation/, "derivation entry persists in URL");
  await evaluate(client, `document.querySelector('#publicFormulaGraph')._formulaGraph.expand('formula.s68.b')`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await evaluate(client, `document.querySelector('#publicFormulaGraph')._formulaGraph.expand()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const graphState = await evaluate(client, `(() => { const nodes=[...document.querySelectorAll('.formula-graph-node.is-formula')]; return {count:nodes.length,complete:nodes.every(n=>n.querySelector('.formula-graph-node-title')?.textContent.trim() && (n.querySelector('.katex')||n.querySelector('.is-invalid'))),overflow:document.documentElement.scrollWidth-innerWidth}; })()`);
  assert.ok(graphState.count >= 3, "multi-layer derivation exposes at least three formula nodes");
  assert.equal(graphState.complete, true, "every visible formula node includes a name and rendered/fallback conclusion");
  assert.ok(graphState.overflow <= 0, "derivation graph does not create page overflow at 390px");
  await reload(client);
  await waitFor(client, `document.querySelector('[data-formula-view="derivation"]').getAttribute('aria-selected')==='true' && document.querySelector('.formula-graph-node')`, "refreshed derivation view");

  await evaluate(client, `document.querySelector('.formula-graph-node.is-formula:not(.is-current)')?.click()`);
  await waitFor(client, `document.querySelector('[data-formula-view="formula"]').getAttribute('aria-selected')==='true' && location.pathname!='/formula/s68-a'`, "node-selected formula root");
  const selectedSlug = await evaluate(client, `location.pathname.split('/').pop()`);
  assert.ok(["s68-b", "s68-c"].includes(selectedSlug), `node click selects another public formula root (${selectedSlug})`);
  await evaluate(client, `document.querySelector('[data-open-derivation]').click()`);
  await waitFor(client, `document.querySelector('.formula-graph-node.is-current .formula-graph-node-title')`, "new-root graph");
  assert.match(await evaluate(client, `document.querySelector('.formula-graph-node.is-current .formula-graph-node-title').textContent`), new RegExp(selectedSlug.slice(-1).toUpperCase()), "new derivation graph is rooted at the clicked formula");
  await evaluate(client, `history.back()`);
  await waitFor(client, `document.querySelector('[data-formula-view="formula"]').getAttribute('aria-selected')==='true'`, "history back formula view");
  await evaluate(client, `history.forward()`);
  await waitFor(client, `document.querySelector('[data-formula-view="derivation"]').getAttribute('aria-selected')==='true'`, "history forward derivation view");

  await navigate(client, `${base}/formula/s68-root?view=derivation`);
  await waitFor(client, `document.querySelector('.formula-derivation-empty-root')`, "root-only derivation state");
  assert.deepEqual(await evaluate(client, `({nodes:document.querySelectorAll('.formula-graph-node.is-formula').length,text:document.querySelector('.formula-derivation-empty-root').textContent.trim()})`), { nodes: 1, text: "暂无上游依赖" }, "dependency-free formula retains its unique root and explicit message");

  await navigate(client, `${base}/formula/s68-invalid`);
  await waitFor(client, `document.querySelector('.public-formula-fallback')`, "invalid LaTeX fallback");
  assert.match(await evaluate(client, `document.querySelector('.public-formula-fallback').textContent`), /公式暂不可显示/, "invalid LaTeX is visibly downgraded");
  await navigate(client, `${base}/formula/s68-long`);
  await waitFor(client, `document.querySelector('.formula-single-card .katex')`, "long LaTeX formula");
  const longState = await evaluate(client, `(() => { const math=document.querySelector('.formula-card-latex'); return {scale:parseFloat(getComputedStyle(math).getPropertyValue('--formula-fit-scale')||'1'),overflow:document.documentElement.scrollWidth-innerWidth}; })()`);
  assert.ok(longState.scale < 1 && longState.scale > 0, `long formula scales without clipping (${longState.scale})`);
  assert.ok(longState.overflow <= 0, "long formula creates no horizontal page overflow");

  client.close();
  console.log("S68 real-browser fixture passed: isolated route gate, desktop/390 light-dark cards, mouse/touch/keyboard search, formula entry/refresh/history/root switching, empty graph and long/invalid LaTeX");
}

main().then(() => {
  kill(browserChild);
  kill(serverChild);
  removeOwned(browserProfile, "larkix-s68-cdp-");
  removeOwned(tempRoot, "larkix-s68-browser-");
  console.log("S68 cleanup complete");
}).catch((error) => {
  console.error(error);
  kill(browserChild);
  kill(serverChild);
  try { removeOwned(browserProfile, "larkix-s68-cdp-"); } catch (cleanupError) { console.error(cleanupError); }
  try { removeOwned(tempRoot, "larkix-s68-browser-"); } catch (cleanupError) { console.error(cleanupError); }
  process.exitCode = 1;
});
