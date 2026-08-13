const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const GRAPH_PATH = path.join(ROOT, "formula-graph.js");
const DERIVE_PATH = path.join(ROOT, "derive.html");
const ADMIN_CSS_PATH = path.join(ROOT, "admin", "admin.css");

function loadGraphModule() {
  const source = fs.readFileSync(GRAPH_PATH, "utf8");
  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: GRAPH_PATH });
  return { api: sandbox.LarkixFormulaGraph, source };
}

function fixture() {
  const nodes = [
    { id: "source", slug: "source", displayName: "输入", latex: "V_{in}=24\\,\\mathrm{V}", current: false, rank: 0 },
    { id: "branch-a", slug: "branch-a", displayName: "分支 A", latex: "I_A=\\frac{V_{in}}{R_A}", current: false, rank: 1 },
    { id: "branch-b", slug: "branch-b", displayName: "分支 B", latex: "I_B=\\sqrt{\\frac{P_B}{R_B}}", current: false, rank: 1 },
    { id: "merge", slug: "merge", displayName: "汇合", latex: "I_{sum}=I_A+I_B", current: true, rank: 2 },
    { id: "nested", slug: "nested", displayName: "嵌套分式", latex: "G=\\frac{\\frac{R_1+R_2}{R_2}}{1+\\frac{s}{\\omega_p}}", current: false, rank: 3 },
    { id: "long", slug: "long", displayName: "长公式", latex: "V_{out}=V_{in}\\cdot\\frac{R_2}{R_1+R_2}+I_{bias}(R_1\\parallel R_2)+\\frac{V_{ripple}}{2\\pi f_s C_{out}}", current: false, rank: 4 },
    { id: "deep-1", slug: "deep-1", displayName: "深层 1", latex: "P_1=V_{out}I_{out}", current: false, rank: 5 },
    { id: "deep-2", slug: "deep-2", displayName: "深层 2", latex: "T_j=T_a+P_1\\theta_{JA}", current: false, rank: 6 }
  ];
  const pairs = [
    ["source", "branch-a"],
    ["source", "branch-b"],
    ["branch-a", "merge"],
    ["branch-b", "merge"],
    ["merge", "nested"],
    ["nested", "long"],
    ["long", "deep-1"],
    ["deep-1", "deep-2"]
  ];
  const edges = pairs.map(([source, target], index) => ({
    id: `edge-${index + 1}`,
    source,
    target
  }));
  return {
    currentNodeId: "merge",
    initialNodeIds: nodes.map((node) => node.id),
    nodes,
    edges,
    truncated: false
  };
}

function pureLayoutChecks(api, source) {
  assert.equal(typeof api.computeDepths, "function");
  assert.equal(typeof api.computeLayout, "function");
  const graph = fixture();
  const depths = api.computeDepths(graph.nodes, graph.edges);
  assert.equal(depths.cyclic, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(depths.depthById)),
    {
      source: 0,
      "branch-a": 1,
      "branch-b": 1,
      merge: 2,
      nested: 3,
      long: 4,
      "deep-1": 5,
      "deep-2": 6
    }
  );

  const sizes = {
    source: { width: 176, height: 76 },
    "branch-a": { width: 220, height: 88 },
    "branch-b": { width: 250, height: 96 },
    merge: { width: 210, height: 82 },
    nested: { width: 340, height: 154 },
    long: { width: 760, height: 104 },
    "deep-1": { width: 206, height: 82 },
    "deep-2": { width: 238, height: 82 }
  };
  const layout = api.computeLayout(graph.nodes, graph.edges, sizes, { depths });
  assert.equal(layout.cyclic, false);
  assert.deepEqual(Array.from(layout.depths[1]), ["branch-a", "branch-b"]);
  assert.equal(layout.positions["branch-a"].x, layout.positions["branch-b"].x);
  assert.ok(layout.positions.source.x < layout.positions.merge.x);
  assert.ok(layout.positions.merge.x < layout.positions.long.x);
  assert.ok(layout.nodeBounds.long.width >= 760);
  assert.ok(layout.nodeBounds.nested.height >= 154);
  assert.ok(layout.width > 2500, "deep and long fixture must create a navigable wide graph");
  assert.ok(
    layout.edgeDirections.every((edge) => edge.leftToRight && edge.targetX > edge.sourceX),
    "every source-to-dependency edge must clear both measured node boxes from left to right"
  );

  assert.match(source, /LarkixMath\?\.render/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /name: "preset"/);
  assert.match(source, /name: "breadthfirst"/);
  assert.match(source, /pointerdown/);
  assert.match(source, /panBy/);
  assert.match(source, /role="application"/);
  assert.match(source, /tabindex="0"/);
  assert.match(source, /role="toolbar"/);
  assert.match(source, /aria-current/);
  assert.doesNotMatch(source, /text-max-width/);
  assert.doesNotMatch(source, /data\(label\)/);
}

function staticContractChecks() {
  const derive = fs.readFileSync(DERIVE_PATH, "utf8");
  const adminCss = fs.readFileSync(ADMIN_CSS_PATH, "utf8");
  for (const source of [derive, adminCss]) {
    assert.match(source, /\.formula-graph-node-math/);
    assert.match(source, /width:\s*max-content/);
    assert.match(source, /white-space:\s*nowrap/);
    assert.match(source, /\.formula-graph-node\.is-current/);
    assert.match(source, /\[data-theme="dark"\] \.formula-graph-node/);
    assert.match(source, /\.formula-graph-node-layer\.is-measuring/);
  }
  assert.match(derive, /formula-graph\.js\?v=20260801-s37/);
  assert.match(derive, /prefers-reduced-motion/);
}

function browserExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

async function pollJson(url, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser debugging endpoint did not open: ${url}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed"
    );
  }
  return result.result?.value;
}

async function waitForGraphRuntime(client) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const ready = await evaluate(
      client,
      `Boolean(window.LarkixFormulaGraph && window.LarkixMath && window.cytoscape)`
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("formula graph browser dependencies did not load from derive.html");
}

async function installFixture(client, width, height, theme) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 500
  });
  const payload = JSON.stringify(fixture());
  await evaluate(
    client,
    `(async () => {
      window.__graphApi?.destroy?.();
      document.documentElement.dataset.theme = ${JSON.stringify(theme)};
      document.body.innerHTML = '<main style="width:min(1120px,calc(100vw - 32px));margin:20px auto"><section class="formula-graph-public"><div class="formula-graph-heading"><p></p></div><div id="fixtureGraph" class="formula-graph-host"></div></section></main>';
      window.__navigated = '';
      window.__graphApi = window.LarkixFormulaGraph.mount(
        document.querySelector('#fixtureGraph'),
        ${payload},
        {
          hrefPrefix: './derive.html?formula=',
          onNavigate: (href) => { window.__navigated = href; }
        }
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return Boolean(window.__graphApi);
    })()`
  );
}

async function visualMetrics(client) {
  return evaluate(
    client,
    `(() => {
      const host = document.querySelector('#fixtureGraph');
      const canvas = host.querySelector('.formula-graph-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      const nodes = [...host.querySelectorAll('.formula-graph-node')].map((node) => {
        const rect = node.getBoundingClientRect();
        const math = node.querySelector('.formula-graph-node-math');
        const mathRect = math.getBoundingClientRect();
        return {
          id: node.dataset.nodeId,
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
          math: { left: mathRect.left, right: mathRect.right, top: mathRect.top, bottom: mathRect.bottom, width: mathRect.width, height: mathRect.height },
          rendered: Boolean(math.querySelector('.katex')),
          invalid: math.classList.contains('is-invalid'),
          markerCount: node.querySelectorAll('.formula-dependency-ref, .derivation-link-icon, img[data-formula-marker]').length
        };
      });
      let paintedPixels = 0;
      for (const layer of host.querySelectorAll('.formula-graph-cytoscape canvas')) {
        const context = layer.getContext('2d', { willReadFrequently: true });
        if (!context || !layer.width || !layer.height) continue;
        const pixels = context.getImageData(0, 0, layer.width, layer.height).data;
        let count = 0;
        for (let index = 3; index < pixels.length; index += 16) {
          if (pixels[index] > 0) count += 1;
        }
        paintedPixels = Math.max(paintedPixels, count);
      }
      const current = host.querySelector('.formula-graph-node.is-current').getBoundingClientRect();
      return {
        canvas: { left: canvasRect.left, right: canvasRect.right, top: canvasRect.top, bottom: canvasRect.bottom, width: canvasRect.width, height: canvasRect.height },
        currentVisible: current.right > canvasRect.left && current.left < canvasRect.right && current.bottom > canvasRect.top && current.top < canvasRect.bottom,
        nodes,
        zoom: window.__graphApi.cy.zoom(),
        pan: window.__graphApi.cy.pan(),
        edgeDirections: window.__graphApi.getLayoutSnapshot().edgeDirections,
        paintedPixels,
        nodeCount: nodes.length
      };
    })()`
  );
}

function assertVisualMetrics(metrics, expectedWidth) {
  assert.equal(metrics.nodeCount, fixture().nodes.length);
  assert.ok(metrics.canvas.width <= expectedWidth && metrics.canvas.width >= expectedWidth - 48);
  assert.ok(metrics.canvas.height >= 340);
  assert.ok(metrics.currentVisible, "the bounded initial viewport must include the current node");
  assert.ok(metrics.zoom >= 0.47 && metrics.zoom <= 1.01);
  assert.ok(metrics.paintedPixels > 20, "Cytoscape edge canvases must contain nonblank pixels");
  assert.ok(metrics.edgeDirections.every((edge) => edge.leftToRight));
  assert.ok(
    metrics.nodes.every((node) => node.rendered && !node.invalid && node.markerCount === 0),
    JSON.stringify(metrics.nodes.filter((node) => !node.rendered || node.invalid || node.markerCount))
  );
  assert.ok(
    metrics.nodes.every(
      (node) =>
        node.math.left >= node.rect.left - 1 &&
        node.math.right <= node.rect.right + 1 &&
        node.math.top >= node.rect.top - 1 &&
        node.math.bottom <= node.rect.bottom + 1
    ),
    "rendered math must remain fully inside every measured node"
  );
  const longNode = metrics.nodes.find((node) => node.id === "long");
  const nestedNode = metrics.nodes.find((node) => node.id === "nested");
  const sourceNode = metrics.nodes.find((node) => node.id === "source");
  assert.ok(longNode.rect.width > sourceNode.rect.width * 1.8);
  assert.ok(nestedNode.rect.height > sourceNode.rect.height);
}

async function mouseInteractionChecks(client, metrics) {
  const centerX = metrics.canvas.left + metrics.canvas.width / 2;
  const centerY = metrics.canvas.top + metrics.canvas.height / 2;
  const panBefore = await evaluate(client, `window.__graphApi.cy.pan()`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: centerX,
    y: centerY,
    deltaX: 120,
    deltaY: 64
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const panAfter = await evaluate(client, `window.__graphApi.cy.pan()`);
  assert.ok(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y, "wheel input must pan the graph");

  const zoomBefore = await evaluate(client, `window.__graphApi.cy.zoom()`);
  await evaluate(client, `document.querySelector('[data-graph-action="zoom-in"]').click()`);
  const zoomAfter = await evaluate(client, `window.__graphApi.cy.zoom()`);
  assert.ok(zoomAfter > zoomBefore, "zoom control must increase canvas zoom");

  await evaluate(client, `window.__graphApi.centerCurrent()`);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const current = await evaluate(
    client,
    `(() => { const rect = document.querySelector('.formula-graph-node.is-current').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, position: window.__graphApi.cy.getElementById('merge').position() }; })()`
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: current.x,
    y: current.y,
    button: "left",
    buttons: 1,
    clickCount: 1
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: current.x + 58,
    y: current.y + 34,
    button: "left",
    buttons: 1
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: current.x + 58,
    y: current.y + 34,
    button: "left",
    buttons: 0,
    clickCount: 1
  });
  const moved = await evaluate(client, `window.__graphApi.cy.getElementById('merge').position()`);
  assert.ok(Math.hypot(moved.x - current.position.x, moved.y - current.position.y) > 20);
  assert.equal(await evaluate(client, `window.__navigated`), "", "dragging must not trigger navigation");

  await evaluate(client, `document.querySelector('[data-node-id="nested"]').click()`);
  assert.match(await evaluate(client, `window.__navigated`), /formula=nested$/);
}

async function touchInteractionChecks(client) {
  const blank = await evaluate(
    client,
    `(() => {
      const rect = document.querySelector('.formula-graph-canvas').getBoundingClientRect();
      for (let y = rect.top + 18; y < rect.bottom - 18; y += 24) {
        for (let x = rect.left + 18; x < rect.right - 18; x += 24) {
          if (!document.elementFromPoint(x, y)?.closest('.formula-graph-node')) return { x, y };
        }
      }
      return { x: rect.left + 12, y: rect.bottom - 12 };
    })()`
  );
  const panBefore = await evaluate(client, `window.__graphApi.cy.pan()`);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: blank.x, y: blank.y, radiusX: 2, radiusY: 2, force: 1, id: 7 }]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: blank.x + 46, y: blank.y + 28, radiusX: 2, radiusY: 2, force: 1, id: 7 }]
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const panAfter = await evaluate(client, `window.__graphApi.cy.pan()`);
  assert.ok(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y, "touch scrolling must pan the mobile graph");

  const pinchBefore = await evaluate(client, `window.__graphApi.cy.zoom()`);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: blank.x, y: blank.y, radiusX: 2, radiusY: 2, force: 1, id: 8 },
      { x: blank.x + 20, y: blank.y, radiusX: 2, radiusY: 2, force: 1, id: 9 }
    ]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: blank.x - 10, y: blank.y, radiusX: 2, radiusY: 2, force: 1, id: 8 },
      { x: blank.x + 52, y: blank.y, radiusX: 2, radiusY: 2, force: 1, id: 9 }
    ]
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const pinchAfter = await evaluate(client, `window.__graphApi.cy.zoom()`);
  assert.ok(pinchAfter > pinchBefore, "touch pinch must zoom the mobile graph");

  await evaluate(client, `window.__graphApi.centerCurrent()`);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const current = await evaluate(
    client,
    `(() => { const rect = document.querySelector('.formula-graph-node.is-current').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, position: window.__graphApi.cy.getElementById('merge').position() }; })()`
  );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: current.x, y: current.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: current.x + 42, y: current.y + 28, radiusX: 2, radiusY: 2, force: 1, id: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const moved = await evaluate(client, `window.__graphApi.cy.getElementById('merge').position()`);
  assert.ok(Math.hypot(moved.x - current.position.x, moved.y - current.position.y) > 12);

  const zoomBefore = await evaluate(client, `window.__graphApi.cy.zoom()`);
  await evaluate(client, `document.querySelector('[data-graph-action="zoom-out"]').click()`);
  const zoomAfter = await evaluate(client, `window.__graphApi.cy.zoom()`);
  assert.ok(zoomAfter < zoomBefore, "mobile zoom control must remain operable");
  await evaluate(client, `document.querySelector('[data-node-id="deep-1"]').click()`);
  assert.match(await evaluate(client, `window.__navigated`), /formula=deep-1$/);
}

async function browserChecks() {
  const executable = browserExecutable();
  assert.ok(executable, "Edge or Chrome is required for S37 visual interaction checks");
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s37-browser-"));
  const port = 43000 + Math.floor(Math.random() * 5000);
  const pageUrl = pathToFileURL(DERIVE_PATH).href;
  const browser = childProcess.spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileRoot}`,
      pageUrl
    ],
    { stdio: "ignore", windowsHide: true }
  );
  let client;
  try {
    const targets = await pollJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((candidate) => candidate.type === "page");
    assert.ok(target?.webSocketDebuggerUrl, "headless browser page target must be available");
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await waitForGraphRuntime(client);

    await installFixture(client, 1440, 900, "light");
    const desktop = await visualMetrics(client);
    assertVisualMetrics(desktop, 1120);
    await mouseInteractionChecks(client, desktop);
    const desktopShot = await client.send("Page.captureScreenshot", { format: "png" });
    assert.ok(Buffer.from(desktopShot.data, "base64").length > 12000);

    await installFixture(client, 768, 900, "light");
    const halfWidth = await visualMetrics(client);
    assertVisualMetrics(halfWidth, 736);
    const halfWidthShot = await client.send("Page.captureScreenshot", { format: "png" });
    assert.ok(Buffer.from(halfWidthShot.data, "base64").length > 9000);

    await installFixture(client, 390, 844, "dark");
    const mobile = await visualMetrics(client);
    assertVisualMetrics(mobile, 358);
    await touchInteractionChecks(client);
    const mobileShot = await client.send("Page.captureScreenshot", { format: "png" });
    assert.ok(Buffer.from(mobileShot.data, "base64").length > 7000);
  } finally {
    client?.close();
    browser.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (profileRoot.startsWith(os.tmpdir())) {
      try {
        fs.rmSync(profileRoot, { recursive: true, force: true });
      } catch {}
    }
  }
}

async function main() {
  const { api, source } = loadGraphModule();
  pureLayoutChecks(api, source);
  staticContractChecks();
  await browserChecks();
  console.log(
    "formula map flow layout checks passed: branch, merge, long math, nested fraction, deep path, measurement, edge direction, desktop/half-width/mobile pixels, pan, zoom, drag, click, dark theme and accessibility contracts"
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
