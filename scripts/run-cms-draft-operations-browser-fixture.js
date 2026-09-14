"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validatePostPayload, validateProjectPayload, validateKnowledgeNodePayload, validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "S64BrowserTester";
const PASSWORD = "s64-browser-isolated-password";
const PRIVATE_PATH = "S64CmsDraftOpsBrowser_7vQ2nK9xP4mR8cL1hT6wZ3aF5dJ0sYgB";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s64-browser-"));
let child = null;
let browserChild = null;
let browserProfile = "";
let cleaning = false;
const runId = `${process.pid}-${Date.now().toString(36)}`;

function logStage(stage) {
  console.log(`[S64 browser ${runId}] ${stage}`);
}

function killProcessTree(processHandle) {
  if (!processHandle || processHandle.exitCode !== null || !processHandle.pid) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(processHandle.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 5000 });
    if (result.error) processHandle.kill("SIGKILL");
  } else {
    processHandle.kill("SIGKILL");
  }
}

function removeOwnedDirectory(directory, prefix) {
  if (!directory) return;
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith(prefix)) {
    throw new Error(`refusing to remove unowned directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
}

function post(id, title, publishStatus = "published") {
  return validatePostPayload({
    id, slug: id, title, category: "电力电子", excerpt: `${title}摘要`, markdown: `# ${title}\n\nS64 浏览器夹具。`,
    cover: "./assets/covers/analog-cover.png", readingMinutes: 8, date: "2026-09-14", publishStatus,
    featured: false, featuredOrder: 0, recommendationPriority: 50, commonLevel: 5, tags: "module:power-electronics"
  });
}

function project() {
  return validateProjectPayload({
    id: "s64-project", slug: "s64-project", title: "S64 开源项目", statusKey: "online", summary: "项目摘要",
    cover: "./assets/covers/project-cover.png", markdown: "# S64 项目", date: "2026-09-14", visibilityStatus: "published",
    featured: false, featuredOrder: 0, commonLevel: 5, tags: "module:maker"
  });
}

function node(id, cover = "") {
  return validateKnowledgeNodePayload({
    id, slug: id, nodeType: "derivation", symbol: "D_s64", title: "S64 推导链路", summary: "推导摘要",
    markdown: "# S64 推导链路", cover, accentColor: "purple", tags: "module:power-electronics",
    publishStatus: "draft", visibilityStatus: "public", commonLevel: 5
  });
}

function formula() {
  return validateFormulaCardPayload({
    formulaId: "formula.s64.browser", slug: "s64-browser", displayName: "S64 浏览器公式", moduleKey: "power-electronics",
    categoryPath: "浏览器验收/基础", purpose: "S64 隔离验收", tags: ["scope:s64"], latex: "V_{out}=D V_{in}",
    markdownDerivation: "## 推导\n\n初始服务器正文。", revisionReason: "fixture", commonLevel: 5
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  logStage(`cleanup start (exit ${exitCode})`);
  killProcessTree(browserChild);
  killProcessTree(child);
  try {
    removeOwnedDirectory(tempRoot, "larkix-s64-browser-");
    removeOwnedDirectory(browserProfile, "larkix-s64-cdp-");
  } catch (error) {
    console.error(`[S64 browser ${runId}] cleanup failed: ${error.message}`);
    exitCode = 1;
  }
  logStage("cleanup complete");
  process.exit(exitCode);
}

function browserExecutable() {
  return [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || "";
}

async function pollJson(url, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser debugging endpoint did not open: ${url}`);
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); this.eventWaiters = new Map(); this.lastDialog = null; }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        if (message.method === "Page.javascriptDialogOpening") this.lastDialog = message.params || {};
        const waiters = [...(this.eventWaiters.get(message.method) || [])];
        for (const waiter of waiters) waiter.resolve(message.params || {});
        return;
      }
      if (!this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id); this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result || {});
    });
    const rejectPendingAndWaiters = (reason) => {
      for (const pending of this.pending.values()) pending.reject(reason);
      this.pending.clear();
      for (const waiters of this.eventWaiters.values()) {
        for (const waiter of [...waiters]) waiter.reject(reason);
      }
      this.eventWaiters.clear();
    };
    this.socket.addEventListener("close", () => rejectPendingAndWaiters(new Error("CDP socket closed")));
    this.socket.addEventListener("error", () => rejectPendingAndWaiters(new Error("CDP socket failed")));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP socket connect timed out")), 10000);
      const complete = (callback) => (value) => { clearTimeout(timer); callback(value); };
      this.socket.addEventListener("open", complete(resolve), { once: true });
      this.socket.addEventListener("error", complete(reject), { once: true });
    });
  }
  send(method, params = {}, timeoutMs = 10000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  waitForEvent(method, timeoutMs = 12000) {
    let settled = false;
    let timer = 0;
    let waiter;
    const remove = () => {
      const waiters = this.eventWaiters.get(method);
      if (!waiters) return;
      waiters.delete(waiter);
      if (waiters.size === 0) this.eventWaiters.delete(method);
    };
    const promise = new Promise((resolve, reject) => {
      const complete = (callback) => (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        remove();
        callback(value);
      };
      waiter = { resolve: complete(resolve), reject: complete(reject) };
      const waiters = this.eventWaiters.get(method) || new Set();
      waiters.add(waiter);
      this.eventWaiters.set(method, waiters);
      timer = setTimeout(() => waiter.reject(new Error(`CDP event timed out: ${method}`)), timeoutMs);
    });
    return {
      promise,
      cancel: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        remove();
      }
    };
  }
  clearLastDialog() { this.lastDialog = null; }
  close() { this.socket?.close(); }
}

async function evaluate(client, expression) {
  if (client.lastDialog) {
    throw new Error(`S64 browser evaluation blocked by a JavaScript dialog: type=${client.lastDialog.type || "unknown"}, message=${client.lastDialog.message || ""}`);
  }
  const dialogWaiter = client.waitForEvent("Page.javascriptDialogOpening", 10000);
  const evaluationResult = client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    .then((result) => ({ event: "evaluation", result }));
  const dialogResult = dialogWaiter.promise.then((params) => ({ event: "dialog", params }));
  let outcome;
  try {
    outcome = await Promise.race([evaluationResult, dialogResult]);
  } finally {
    dialogWaiter.cancel();
  }
  if (outcome.event === "dialog") {
    throw new Error(`S64 browser evaluation opened a JavaScript dialog: type=${outcome.params.type || "unknown"}, message=${outcome.params.message || ""}`);
  }
  const result = outcome.result;
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
  return result.result?.value;
}

async function waitFor(client, expression, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser wait timed out: ${label}`);
}

let reloadSequence = 0;

async function reloadPage(client) {
  const currentUrl = await evaluate(client, `location.href`);
  client.clearLastDialog();
  const navigationUrl = new URL(currentUrl);
  navigationUrl.searchParams.set("__s64_reload", String(++reloadSequence));
  const loadWaiter = client.waitForEvent("Page.loadEventFired", 12000);
  const dialogWaiter = client.waitForEvent("Page.javascriptDialogOpening", 12000);
  const loadResult = loadWaiter.promise.then((params) => ({ event: "load", params }));
  const dialogResult = dialogWaiter.promise.then((params) => ({ event: "dialog", params }));
  const outcomePromise = Promise.race([loadResult, dialogResult]).then((outcome) => {
    if (outcome.event === "dialog") {
      throw new Error(`S64 navigation opened a JavaScript dialog: type=${outcome.params.type || "unknown"}, message=${outcome.params.message || ""}`);
    }
    return outcome;
  });
  try {
    const navigationResult = client.send("Page.navigate", { url: navigationUrl.href }).then((navigation) => {
      assert.ok(!navigation.errorText, `S64 page navigation failed: ${navigation.errorText || "unknown error"}`);
      return navigation;
    });
    await Promise.all([navigationResult, outcomePromise]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const readinessResult = evaluate(client, `({readyState:document.readyState,href:location.href})`).then((value) => ({ event: "readiness", value }));
    const postLoadOutcome = await Promise.race([readinessResult, dialogResult]);
    if (postLoadOutcome.event === "dialog") {
      throw new Error(`S64 post-load readiness opened a JavaScript dialog: type=${postLoadOutcome.params.type || "unknown"}, message=${postLoadOutcome.params.message || ""}`);
    }
    assert.ok(["interactive", "complete"].includes(postLoadOutcome.value?.readyState), `S64 post-load document is not ready: ${JSON.stringify(postLoadOutcome.value)}`);
    assert.equal(postLoadOutcome.value.href, navigationUrl.href, "S64 post-load URL must match the requested navigation URL");
  } finally {
    loadWaiter.cancel();
    dialogWaiter.cancel();
  }
}

async function verifyBrowser(url) {
  const executable = browserExecutable();
  assert.ok(executable, "Edge or Chrome is required for S64 browser verification");
  browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s64-cdp-"));
  const debugPort = await availablePort();
  logStage(`launch browser on CDP ${debugPort}`);
  browserChild = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${browserProfile}`, url], { stdio: "ignore", windowsHide: true });
  let client;
  try {
    const targets = await pollJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((item) => item.type === "page" && item.url === url)
      || targets.find((item) => item.type === "page" && item.url.includes(`/${PRIVATE_PATH}/admin/`));
    assert.ok(target?.webSocketDebuggerUrl, "headless CMS target must be available");
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    logStage("CDP connected");
    await waitFor(client, `Boolean(document.querySelector('#loginForm'))`, "login form");
    const login = await evaluate(client, `(async () => {
      const response=await fetch('/${PRIVATE_PATH}/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:${JSON.stringify(USERNAME)},password:${JSON.stringify(PASSWORD)}})});
      return {ok:response.ok,status:response.status,body:await response.text()};
    })()`);
    assert.equal(login.ok, true, `fixture login failed (${login.status}): ${login.body}`);
    await reloadPage(client);
    await waitFor(client, `document.querySelector('#dashboard')?.hidden === false`, "CMS login");
    logStage("login passed");

    const fillArticle = (title, markdown) => `(() => {
      const title=document.querySelector('#contentForm [name="title"]');
      const markdown=document.querySelector('#contentForm [name="markdown"]');
      title.value=${JSON.stringify(title)}; markdown.value=${JSON.stringify(markdown)};
      title.dispatchEvent(new Event('input',{bubbles:true})); markdown.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    })()`;
    await evaluate(client, fillArticle("新建文章 A", "# A\n\n仅属于草稿 A"));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await evaluate(client, `window.confirm=()=>true; document.querySelector('#resetButton').click(); true`);
    await evaluate(client, fillArticle("新建文章 B", "# B\n\n仅属于草稿 B"));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await evaluate(client, `document.querySelector('#resetButton').click(); true`);
    const articleState = await evaluate(client, `(() => {
      const keys=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:'));
      return {keys,titles:keys.map((key)=>JSON.parse(localStorage.getItem(key)).snapshot.title),picker:document.querySelectorAll('#articleDraftPicker option').length};
    })()`);
    assert.equal(articleState.keys.length, 2);
    assert.equal(new Set(articleState.keys).size, 2);
    assert.deepEqual(new Set(articleState.titles), new Set(["新建文章 A", "新建文章 B"]));
    assert.equal(articleState.picker, 2);
    logStage("article identities passed");

    await evaluate(client, `location.hash='formulas'; true`);
    await waitFor(client, `document.querySelector('#formulas')?.hidden === false`, "formula view");
    const fillFormula = (name, latex) => `(() => {
      const button=document.querySelector('#newFormulaButton'); if(document.querySelector('#formulaCardEditor').hidden) button.click();
      const name=document.querySelector('#formulaCardEditor [name="displayName"]');
      const latex=document.querySelector('#formulaCardEditor [name="latex"]');
      name.value=${JSON.stringify(name)}; latex.value=${JSON.stringify(latex)};
      name.dispatchEvent(new Event('input',{bubbles:true})); latex.dispatchEvent(new Event('input',{bubbles:true})); return true;
    })()`;
    await evaluate(client, fillFormula("新建公式 A", "A=1"));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await evaluate(client, `window.confirm=()=>true; document.querySelector('#newFormulaButton').click(); true`);
    await evaluate(client, fillFormula("新建公式 B", "B=2"));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const formulaState = await evaluate(client, `(() => {
      const keys=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:'));
      return {keys,names:keys.map((key)=>JSON.parse(localStorage.getItem(key)).snapshot.displayName),picker:document.querySelectorAll('#formulaDraftPicker option').length};
    })()`);
    assert.equal(formulaState.keys.length, 2);
    assert.equal(new Set(formulaState.keys).size, 2);
    assert.deepEqual(new Set(formulaState.names), new Set(["新建公式 A", "新建公式 B"]));
    assert.equal(formulaState.picker, 2);
    logStage("formula identities passed");
    await evaluate(client, `document.querySelector('#newFormulaButton').click(); true`);

    await evaluate(client, `(() => {
      const identity='s64-large'; const key='larkixmaker_admin_autodraft_v2:article:'+identity;
      const record={version:2,kind:'article',identity,savedAt:new Date().toISOString(),baseToken:'stale-server-baseline',snapshot:{editingType:'post',editingId:identity,type:'post',title:'冲突本地标题',category:'电力电子',excerpt:'本地摘要',tags:'',markdown:'# local',publishStatus:'published',featured:false,featuredOrder:'0',recommendationPriority:'50',readingMinutes:'8',cover:'./assets/covers/analog-cover.png'}};
      localStorage.setItem(key,JSON.stringify(record));
      const registry=JSON.parse(localStorage.getItem('larkixmaker_admin_autodraft_v2:registry')||'[]').filter((item)=>item!==key); registry.unshift(key); localStorage.setItem('larkixmaker_admin_autodraft_v2:registry',JSON.stringify(registry));
      sessionStorage.setItem('s64-conflict-record',JSON.stringify(record)); return true;
    })()`);
    await reloadPage(client);
    await waitFor(client, `document.querySelector('#draftConflictActions')?.hidden === false`, "article conflict actions");
    const conflictState = await evaluate(client, `(() => ({title:document.querySelector('#contentForm [name="title"]').value, conflictVisible:!document.querySelector('#draftConflictActions').hidden, draft:localStorage.getItem('larkixmaker_admin_autodraft_v2:article:s64-large')}))()`);
    assert.equal(conflictState.title, "S64 大卡文章");
    assert.equal(conflictState.conflictVisible, true);
    logStage("conflict safe default passed");
    const conflictBefore = conflictState.draft;

    await evaluate(client, `location.hash='formulas'; document.querySelector('#newFormulaButton').click(); const field=document.querySelector('#formulaCardEditor [name="purpose"]'); field.value='只修改公式'; field.dispatchEvent(new Event('input',{bubbles:true})); window.dispatchEvent(new Event('beforeunload',{cancelable:true})); true`);
    const conflictAfterFormulaUnload = await evaluate(client, `localStorage.getItem('larkixmaker_admin_autodraft_v2:article:s64-large')`);
    assert.equal(conflictAfterFormulaUnload, conflictBefore, "formula-only dirty unload must not overwrite conflicted article draft");
    logStage("cross-editor preservation passed");
    await evaluate(client, `window.confirm=()=>true; document.querySelector('#newFormulaButton').click(); true`);
    await reloadPage(client);
    await waitFor(client, `document.querySelector('#dashboard')?.hidden === false`, "reload with session");
    await waitFor(client, `document.querySelectorAll('#articleDraftPicker option').length >= 3 && document.querySelectorAll('#formulaDraftPicker option').length >= 3`, "reload recovery picker enumeration");
    const reloadedPickers = await evaluate(client, `({articles:document.querySelectorAll('#articleDraftPicker option').length,formulas:document.querySelectorAll('#formulaDraftPicker option').length,formulaVisible:!document.querySelector('#formulaDraftRecoveryBar').hidden})`);
    assert.ok(reloadedPickers.articles >= 3);
    assert.ok(reloadedPickers.formulas >= 3);
    assert.equal(reloadedPickers.formulaVisible, true);
    logStage("reload pickers passed");
    await waitFor(client, `document.querySelector('#draftConflictActions')?.hidden === false`, "conflict after reload");
    await evaluate(client, `(() => { const field=document.querySelector('#contentForm [name="title"]'); field.value='冲突后文章新编辑'; field.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const articleConflictEdits = await evaluate(client, `(() => {
      const stable=localStorage.getItem('larkixmaker_admin_autodraft_v2:article:s64-large');
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      return {stable,working:records.find((record)=>record.conflictRole==='server-side-edit' && record.sourceIdentity==='s64-large')};
    })()`);
    assert.equal(articleConflictEdits.stable, conflictBefore, "article conflict stable local side must not be overwritten by same-editor autosave");
    assert.equal(articleConflictEdits.working?.snapshot?.title, "冲突后文章新编辑");
    await evaluate(client, `document.querySelector('#keepServerDraftButton').click(); true`);
    await waitFor(client, `document.querySelector('#draftConflictActions')?.hidden === true`, "article keep-server resolution");
    await evaluate(client, `window.confirm=()=>true; document.querySelector('#resetButton').click(); true`);
    await reloadPage(client);
    await waitFor(client, `document.querySelector('#dashboard')?.hidden === false`, "article conflict records after reload");
    await waitFor(client, `(() => {
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      const old=records.find((record)=>record.conflictRole==='preserved-local' && record.snapshot?.title==='冲突本地标题');
      const working=records.find((record)=>record.conflictRole==='server-side-edit' && record.snapshot?.title==='冲突后文章新编辑');
      const options=new Set([...document.querySelectorAll('#articleDraftPicker option')].map((option)=>option.value));
      return Boolean(old?.identity && working?.identity && options.has(old.identity) && options.has(working.identity));
    })()`, "article preserved and working picker options ready");
    const articleKept = await evaluate(client, `(() => {
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      return {old:records.find((record)=>record.conflictRole==='preserved-local' && record.snapshot?.title==='冲突本地标题'),working:records.find((record)=>record.conflictRole==='server-side-edit' && record.snapshot?.title==='冲突后文章新编辑')};
    })()`);
    assert.ok(articleKept.old?.identity);
    assert.ok(articleKept.working?.identity);
    await evaluate(client, `(() => { window.confirm=()=>true; const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key))); const record=records.find((item)=>item.conflictRole==='preserved-local' && item.snapshot?.title==='冲突本地标题'); const picker=document.querySelector('#articleDraftPicker'); picker.value=record.identity; document.querySelector('#restoreSelectedArticleDraftButton').click(); return true; })()`);
    await waitFor(client, `document.querySelector('#contentForm [name="title"]')?.value === '冲突本地标题'`, "restore preserved article local side");
    await evaluate(client, `(() => { window.confirm=()=>true; const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key))); const record=records.find((item)=>item.conflictRole==='server-side-edit' && item.snapshot?.title==='冲突后文章新编辑'); const picker=document.querySelector('#articleDraftPicker'); picker.value=record.identity; document.querySelector('#restoreSelectedArticleDraftButton').click(); return true; })()`);
    await waitFor(client, `document.querySelector('#contentForm [name="title"]')?.value === '冲突后文章新编辑'`, "restore article conflict working side");
    logStage("article same-editor conflict preservation passed");
    await evaluate(client, `window.confirm=()=>true; setTimeout(()=>document.querySelector('#resetButton').click(),0); true`);
    await waitFor(client, `document.querySelector('#contentForm [name="title"]')?.value === ''`, "article editor reset before formula conflict");
    logStage("article editor reset passed");

    await evaluate(client, `(() => {
      const identity='formula.s64.browser'; const key='larkixmaker_admin_autodraft_v2:formula:'+identity;
      const record={version:2,kind:'formula',identity,savedAt:new Date().toISOString(),baseToken:'stale-formula-baseline',snapshot:{formulaId:identity,displayName:'冲突本地公式名',moduleKey:'power-electronics',categoryPath:'浏览器验收/基础',purpose:'冲突公式旧本地侧',tags:'scope:s64',latex:'V_{old}=1',markdownDerivation:'## 旧本地推导',revisionReason:'旧本地原因'}};
      localStorage.setItem(key,JSON.stringify(record)); const registry=JSON.parse(localStorage.getItem('larkixmaker_admin_autodraft_v2:registry')||'[]').filter((item)=>item!==key); registry.unshift(key); localStorage.setItem('larkixmaker_admin_autodraft_v2:registry',JSON.stringify(registry)); return true;
    })()`);
    logStage("formula stale draft injected");
    await evaluate(client, `location.hash='formulas'; true`);
    await waitFor(client, `document.querySelector('#formulas')?.hidden === false && Boolean(document.querySelector('[data-formula-action="edit"][data-formula-id="formula.s64.browser"]'))`, "formula conflict catalog");
    logStage("formula conflict catalog passed");
    await evaluate(client, `setTimeout(()=>document.querySelector('[data-formula-action="edit"][data-formula-id="formula.s64.browser"]').click(),0); true`);
    await waitFor(client, `document.querySelector('#formulaDraftConflictActions')?.hidden === false`, "formula conflict actions");
    logStage("formula conflict safe default passed");
    const formulaConflictBefore = await evaluate(client, `localStorage.getItem('larkixmaker_admin_autodraft_v2:formula:formula.s64.browser')`);
    assert.equal(await evaluate(client, `document.querySelector('#formulaCardEditor [name="displayName"]').value`), "S64 浏览器公式");
    await evaluate(client, `(() => { const field=document.querySelector('#formulaCardEditor [name="purpose"]'); field.value='冲突后公式新编辑'; field.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const formulaConflictEdits = await evaluate(client, `(() => { const stable=localStorage.getItem('larkixmaker_admin_autodraft_v2:formula:formula.s64.browser'); const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key))); return {stable,working:records.find((record)=>record.conflictRole==='server-side-edit' && record.sourceIdentity==='formula.s64.browser')}; })()`);
    assert.equal(formulaConflictEdits.stable, formulaConflictBefore, "formula conflict stable local side must not be overwritten by same-editor autosave");
    assert.equal(formulaConflictEdits.working?.snapshot?.purpose, "冲突后公式新编辑");
    logStage("formula conflict working draft passed");
    await evaluate(client, `setTimeout(()=>document.querySelector('#keepServerFormulaDraftButton').click(),0); true`);
    await waitFor(client, `document.querySelector('#formulaDraftConflictActions')?.hidden === true`, "formula keep-server resolution");
    logStage("formula keep-server resolution passed");
    await evaluate(client, `window.__s64FormulaTransitionConfirmCalls=0; setTimeout(()=>{ window.confirm=()=>{ window.__s64FormulaTransitionConfirmCalls+=1; return true; }; try { document.querySelector('#newFormulaButton').click(); } finally { window.confirm=()=>true; } },0); true`);
    await waitFor(client, `document.querySelector('#formulaEditorTitle')?.textContent === '新建公式卡' && document.querySelector('#formulaCardEditor [name="displayName"]')?.value === ''`, "switch to clean formula identity before reload");
    const formulaTransitionConfirmCalls = await evaluate(client, `Number(window.__s64FormulaTransitionConfirmCalls||0)`);
    assert.equal(formulaTransitionConfirmCalls, 1, "dirty formula transition must prompt exactly once and continue after confirmation");
    logStage("formula working branch saved through new-formula transition");
    const articleCleanProbe = await evaluate(client, `(() => {
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:article:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      const summarize=(record)=>record ? {identity:record.identity,role:record.conflictRole||'stable',title:record.snapshot?.title||'',displayName:record.snapshot?.displayName||'',purpose:record.snapshot?.purpose||''} : null;
      let articleConfirmCalls=0;
      window.confirm=()=>{ articleConfirmCalls+=1; return false; };
      document.querySelector('#resetButton').click();
      window.confirm=()=>true;
      return {
        articleConfirmCalls,
        article:{stable:summarize(records.find((record)=>record.identity==='s64-large')),preserved:summarize(records.find((record)=>record.conflictRole==='preserved-local')),working:summarize(records.find((record)=>record.conflictRole==='server-side-edit'))}
      };
    })()`);
    assert.equal(articleCleanProbe.articleConfirmCalls, 0, `article dirty state must be clean before reload: ${JSON.stringify(articleCleanProbe)}`);
    logStage("article clean probe passed");
    const formulaCleanProbe = await evaluate(client, `(() => {
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      const summarize=(record)=>record ? {identity:record.identity,role:record.conflictRole||'stable',displayName:record.snapshot?.displayName||'',purpose:record.snapshot?.purpose||''} : null;
      return {
        formula:{stable:summarize(records.find((record)=>record.identity==='formula.s64.browser')),preserved:summarize(records.find((record)=>record.conflictRole==='preserved-local' && record.sourceIdentity==='formula.s64.browser')),working:summarize(records.find((record)=>record.conflictRole==='server-side-edit' && record.sourceIdentity==='formula.s64.browser'))}
      };
    })()`);
    assert.ok(formulaCleanProbe.formula?.preserved && formulaCleanProbe.formula?.working, `formula conflict records must remain prepared before clean navigation: ${JSON.stringify(formulaCleanProbe)}`);
    logStage("formula clean state prepared");
    await reloadPage(client);
    logStage("clean formula navigation passed");
    await waitFor(client, `document.querySelector('#dashboard')?.hidden === false`, "formula conflict records after reload");
    await waitFor(client, `(() => {
      const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key)));
      const old=records.find((record)=>record.conflictRole==='preserved-local' && record.sourceIdentity==='formula.s64.browser' && record.snapshot?.purpose==='冲突公式旧本地侧');
      const working=records.find((record)=>record.conflictRole==='server-side-edit' && record.sourceIdentity==='formula.s64.browser' && record.snapshot?.purpose==='冲突后公式新编辑');
      const options=new Set([...document.querySelectorAll('#formulaDraftPicker option')].map((option)=>option.value));
      return Boolean(old?.identity && working?.identity && options.has(old.identity) && options.has(working.identity));
    })()`, "formula preserved and working picker options ready");
    const formulaKept = await evaluate(client, `(() => { const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key))); return {old:records.find((record)=>record.conflictRole==='preserved-local' && record.snapshot?.purpose==='冲突公式旧本地侧'),working:records.find((record)=>record.conflictRole==='server-side-edit' && record.snapshot?.purpose==='冲突后公式新编辑')}; })()`);
    assert.ok(formulaKept.old?.identity);
    assert.ok(formulaKept.working?.identity);
    logStage("formula conflict records survived reload");
    await evaluate(client, `(() => { window.confirm=()=>true; const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key))); const record=records.find((item)=>item.conflictRole==='preserved-local' && item.snapshot?.purpose==='冲突公式旧本地侧'); const picker=document.querySelector('#formulaDraftPicker'); picker.value=record.identity; document.querySelector('#restoreSelectedFormulaDraftButton').click(); return true; })()`);
    await waitFor(client, `document.querySelector('#formulaCardEditor [name="purpose"]')?.value === '冲突公式旧本地侧'`, "restore preserved formula local side");
    logStage("formula preserved local side restored");
    await evaluate(client, `(() => { window.confirm=()=>true; const records=Object.keys(localStorage).filter((key)=>key.includes('autodraft_v2:formula:')).map((key)=>JSON.parse(localStorage.getItem(key))); const record=records.find((item)=>item.conflictRole==='server-side-edit' && item.snapshot?.purpose==='冲突后公式新编辑'); const picker=document.querySelector('#formulaDraftPicker'); picker.value=record.identity; document.querySelector('#restoreSelectedFormulaDraftButton').click(); return true; })()`);
    await waitFor(client, `document.querySelector('#formulaCardEditor [name="purpose"]')?.value === '冲突后公式新编辑'`, "restore formula conflict working side");
    logStage("formula same-editor conflict preservation passed");
    await evaluate(client, `window.confirm=()=>true; setTimeout(()=>document.querySelector('#newFormulaButton').click(),0); true`);
    await waitFor(client, `document.querySelector('#formulaEditorTitle')?.textContent === '新建公式卡' && document.querySelector('#formulaCardEditor [name="displayName"]')?.value === ''`, "switch to clean formula identity after conflict recovery");
    logStage("formula recovery transition passed");

    await evaluate(client, `(() => {
      const option=[...document.querySelectorAll('#articleDraftPicker option')].find((item)=>JSON.parse(localStorage.getItem('larkixmaker_admin_autodraft_v2:article:'+item.value)||'{}').snapshot?.title==='新建文章 A');
      document.querySelector('#articleDraftPicker').value=option.value; document.querySelector('#restoreSelectedArticleDraftButton').click(); return true;
    })()`);
    await waitFor(client, `document.querySelector('#contentForm [name="title"]')?.value === '新建文章 A'`, "restore selected article draft");
    await evaluate(client, `(() => {
      const option=[...document.querySelectorAll('#formulaDraftPicker option')].find((item)=>JSON.parse(localStorage.getItem('larkixmaker_admin_autodraft_v2:formula:'+item.value)||'{}').snapshot?.displayName==='新建公式 B');
      document.querySelector('#formulaDraftPicker').value=option.value; document.querySelector('#restoreSelectedFormulaDraftButton').click(); return true;
    })()`);
    await waitFor(client, `document.querySelector('#formulaCardEditor [name="displayName"]')?.value === '新建公式 B'`, "restore selected formula draft");
    logStage("selected draft recovery passed");

    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(client, `location.hash='operations'; true`);
    await waitFor(client, `document.querySelector('#operations')?.hidden === false`, "mobile operations view");
    const mobile = await evaluate(client, `({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,groups:document.querySelectorAll('.common-level-group').length,slots:document.querySelectorAll('[data-homepage-focus-slot]').length})`);
    assert.ok(mobile.overflow <= 1, `mobile horizontal overflow: ${mobile.overflow}`);
    assert.equal(mobile.groups, 6);
    assert.equal(mobile.slots, 3);
    console.log("S64 isolated browser checks passed: multiple identities, same-editor two-sided conflict recovery, cross-editor preservation, reload pickers, six levels, three slots, mobile no-overflow");
  } finally {
    client?.close();
  }
}

async function main() {
  logStage(`fixture data ${tempRoot}`);
  const uploadDir = path.join(tempRoot, "uploads");
  const dbDir = path.join(tempRoot, "database");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, "s64-cover.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const db = createDatabase({ root: ROOT, dataDir: tempRoot, dbDir, dbPath: path.join(dbDir, "gokottamaker.sqlite"), uploadDir });
  const store = createContentStore(db);
  for (const item of [post("s64-large", "S64 大卡文章"), post("s64-small-1", "S64 小卡一"), post("s64-small-2", "S64 小卡二"), post("s64-draft", "S64 未发布文章", "draft")]) store.savePost(item);
  store.saveProject(project());
  store.saveKnowledgeNode(node("s64-derivation"));
  store.saveFormulaCard(formula());
  store.saveHomepageFocusSlots({ slots: [
    { slot: "large", postId: "s64-large", commonLevel: 5 },
    { slot: "small-1", postId: "s64-small-1", commonLevel: 5 },
    { slot: "small-2", postId: "s64-small-2", commonLevel: 5 }
  ] }, { id: "fixture", username: "fixture" });
  db.close();

  const port = await availablePort();
  child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "test", DATA_DIR: tempRoot, HOST: "127.0.0.1", PORT: String(port), ADMIN_USERNAME: USERNAME, ADMIN_PASSWORD: PASSWORD, PRIVATE_CMS_PATH: PRIVATE_PATH, ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.once("exit", (code) => { if (!cleaning) { console.error(output); cleanup(code || 1); } });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let healthy = false;
    try {
      healthy = (await fetch(`http://127.0.0.1:${port}/healthz`)).ok;
    } catch {}
    if (healthy) {
      const url = `http://127.0.0.1:${port}/${PRIVATE_PATH}/admin/index.html`;
      if (process.argv.includes("--verify")) {
        await Promise.race([
          verifyBrowser(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error("browser verification exceeded 70 seconds")), 70000))
        ]);
        cleanup(0);
        return;
      }
      console.log(JSON.stringify({ url, username: USERNAME, password: PASSWORD, dataDir: tempRoot }));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${output}`);
}

process.on("SIGINT", () => cleanup(130));
process.on("SIGTERM", () => cleanup(143));
process.on("uncaughtException", (error) => { console.error(error); cleanup(1); });
main().catch((error) => { console.error(error); cleanup(1); });
