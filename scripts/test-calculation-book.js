"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn, spawnSync } = require("node:child_process");
const { createContentStore } = require("../lib/content");
const { createDatabase } = require("../lib/db");
const { validateKnowledgeNodePayload } = require("../lib/validators");
const { validateBookFile } = require("../tools/calculation-book/validator");
const { buildMathcadXml, validateMathcad } = require("../tools/calculation-book/mathcad-generator");
const { dottedSubscriptMath, generateLarkixPackage, validateLarkixPackage } = require("../tools/calculation-book/larkix-generator");
const { validateConsistency } = require("../tools/calculation-book/consistency");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "schemas/calculation-book-master.schema.json");
const TEMPLATE_BOOK = path.join(ROOT, "content/calculation-books/template/calculation-book.json");
const REFERENCE_BOOK = path.join(ROOT, "content/calculation-books/ccm-flyback-reference/calculation-book.json");
const BUCK_BOOST_BOOK = path.join(ROOT, "content/calculation-books/four-switch-buck-boost-reva/calculation-book.json");
const EVIDENCE = path.join(ROOT, "content/calculation-books/ccm-flyback-reference/generated/isolated-preview-report.json");
const BUCK_BOOST_EVIDENCE = path.join(ROOT, "content/calculation-books/four-switch-buck-boost-reva/generated/isolated-preview-report.json");

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`isolated preview server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("isolated preview server did not become healthy");
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

function renderMarkdown(markdown) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data/markdown-renderer.js"), "utf8"), sandbox);
  return sandbox.window.LarkixMarkdown.render(markdown).html;
}

function safeRemoveTemp(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const base = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${base}${path.sep}`) || !path.basename(resolved).startsWith("larkix-calculation-book-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

function seedIsolatedDataDir(dataDir, payloadPath) {
  const dbDir = path.join(dataDir, "database");
  const dbPath = path.join(dbDir, "gokottamaker.sqlite");
  const uploadDir = path.join(dataDir, "uploads");
  const db = createDatabase({ root: ROOT, dataDir, dbDir, dbPath, uploadDir });
  const store = createContentStore(db);
  const nodes = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  for (const node of nodes) store.saveKnowledgeNode(validateKnowledgeNodePayload(node));
  db.close();
}

async function main() {
  const template = validateBookFile(TEMPLATE_BOOK, SCHEMA);
  assert.equal(template.report.ok, true, template.report.errors.join("\n"));
  const reference = validateBookFile(REFERENCE_BOOK, SCHEMA);
  assert.equal(reference.report.ok, true, reference.report.errors.join("\n"));
  assert.equal(reference.report.summary.coverageCategories, 12);
  assert.equal(reference.report.summary.formulas, 21);
  assert.equal(reference.report.summary.formulaTraces, 21);
  assert.equal(reference.report.summary.unresolvedMandatory, 7);
  const buckBoostReference = validateBookFile(BUCK_BOOST_BOOK, SCHEMA);
  assert.equal(buckBoostReference.report.ok, true, buckBoostReference.report.errors.join("\n"));
  assert.equal(buckBoostReference.report.summary.coverageCategories, 12);
  assert.equal(buckBoostReference.report.summary.formulas, 39);
  assert.equal(buckBoostReference.report.summary.formulaTraces, 39);
  assert.equal(buckBoostReference.report.summary.unresolvedMandatory, 9);

  const book = reference.book;
  const evaluation = reference.report.evaluation;
  const canonicalA = generateLarkixPackage(book, evaluation);
  const canonicalB = generateLarkixPackage(book, evaluation);
  assert.equal(JSON.stringify(canonicalA), JSON.stringify(canonicalB), "Larkix generation must be deterministic");
  assert.equal(canonicalA.nodes.every((node) => node.publishStatus === "draft" && node.visibilityStatus === "private"), true);
  const canonicalValidation = validateLarkixPackage(book, canonicalA);
  assert.equal(canonicalValidation.ok, true, canonicalValidation.errors.join("\n"));

  const preview = generateLarkixPackage(book, evaluation, { preview: true });
  assert.equal(preview.nodes.every((node) => node.publishStatus === "published" && node.visibilityStatus === "unlisted"), true);
  const previewValidation = validateLarkixPackage(book, preview);
  assert.equal(previewValidation.ok, true, previewValidation.errors.join("\n"));
  assert.deepEqual(preview.nodes.map((node) => node.slug), [
    "ccm-flyback-reference-calculation-sheet",
    "ccm-flyback-current-chain-derivation",
    "triangular-wave-rms-foundation"
  ]);

  const rendered = renderMarkdown(preview.nodes[0].markdown);
  assert.equal(dottedSubscriptMath("P.out = V.in / R.sense"), "P_{out} = V_{in} / R_{sense}");
  assert.match(rendered, /formula-jump-sup/);
  assert.match(rendered, /data-derive-slug="ccm-flyback-current-chain-derivation"/);
  assert.match(rendered, /data-derive-slug="triangular-wave-rms-foundation"/);
  assert.match(rendered, /P<sub>out<\/sub>/);
  assert.match(rendered, /V<sub>in<\/sub>/);
  assert.doesNotMatch(rendered, /\b(?:[PVILRDETMGANX]|d[A-Z]|mu|[krtf])\.[A-Za-z]/);
  assert.doesNotMatch(rendered, /\ufffd|\?\?\?|[A-Z]:[\\/]/);

  const buckBoostBook = buckBoostReference.book;
  const buckBoostEvaluation = buckBoostReference.report.evaluation;
  const buckBoostCanonicalA = generateLarkixPackage(buckBoostBook, buckBoostEvaluation);
  const buckBoostCanonicalB = generateLarkixPackage(buckBoostBook, buckBoostEvaluation);
  assert.equal(JSON.stringify(buckBoostCanonicalA), JSON.stringify(buckBoostCanonicalB), "BUCK-BOOST Larkix generation must be deterministic");
  assert.equal(buckBoostCanonicalA.nodes.every((node) => node.publishStatus === "draft" && node.visibilityStatus === "private"), true);
  const buckBoostCanonicalValidation = validateLarkixPackage(buckBoostBook, buckBoostCanonicalA);
  assert.equal(buckBoostCanonicalValidation.ok, true, buckBoostCanonicalValidation.errors.join("\n"));
  const buckBoostPreview = generateLarkixPackage(buckBoostBook, buckBoostEvaluation, { preview: true });
  assert.equal(buckBoostPreview.nodes.every((node) => node.publishStatus === "published" && node.visibilityStatus === "unlisted"), true);
  assert.deepEqual(buckBoostPreview.nodes.map((node) => node.slug), [
    "four-switch-buck-boost-reva-calculation-sheet",
    "four-switch-buck-boost-transition-derivation",
    "inductor-volt-second-ripple-foundation"
  ]);
  const buckBoostMarkdown = buckBoostPreview.nodes[0].markdown;
  const buckBoostRendered = renderMarkdown(buckBoostMarkdown);
  assert.match(buckBoostRendered, /data-derive-slug="four-switch-buck-boost-transition-derivation"/);
  assert.match(buckBoostRendered, /data-derive-slug="inductor-volt-second-ripple-foundation"/);
  assert.match(buckBoostRendered, /我先冻结 VIN、VOUT、IOUT、Pout 与 fsw/);
  assert.match(buckBoostRendered, /V<sub>intrans<\/sub>[\s\S]*只用于比较两种调制，不是新增额定输入/);
  assert.match(buckBoostMarkdown, /dI_\{trans\} = V_\{intrans\}[^]*?其中，\$dI_\{trans\}\$[^]*?\$V_\{intrans\}\$[^]*?我代入 \$V_\{intrans\}\$ = 36 V/);
  assert.doesNotMatch(buckBoostRendered, /\b(?:[PVILRDETMGANX]|d[A-Z]|mu|[krtf])\.[A-Za-z]/);
  assert.doesNotMatch(buckBoostMarkdown, /### 专用符号/);
  assert.match(buckBoostRendered, /设计规格与功率边界[\s\S]*工作模式与占空比[\s\S]*主电感与电流应力[\s\S]*功率器件与驱动[\s\S]*输入输出电容[\s\S]*电流采样与保护[\s\S]*控制与过渡区专项校核[\s\S]*损耗与热设计/);
  assert.doesNotMatch(buckBoostRendered, /CCM 反激|Agent\d*|A13_CalculationBookEngineering|用户|跨输出哨兵结果|未解决警告|input\.prepcb-evidence|风险与验证|计划执行以下验证|\ufffd|\?\?\?|[A-Z]:[\\/]/i);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-calculation-book-"));
  const tempDataDir = path.join(tempRoot, "data");
  const tempMathcad = path.join(tempRoot, "ccm-flyback-test.xmcd");
  const tempBuckBoostMathcad = path.join(tempRoot, "four-switch-buck-boost-test.xmcd");
  let child = null;
  try {
    const templateXml = fs.readFileSync(book.outputs.mathcad.template, "utf8");
    const mathcadA = buildMathcadXml(book, evaluation, templateXml);
    const mathcadB = buildMathcadXml(book, evaluation, templateXml);
    assert.equal(mathcadA.xml, mathcadB.xml, "Mathcad generation must be deterministic");
    fs.writeFileSync(tempMathcad, mathcadA.xml, "utf8");
    const mathcadValidation = validateMathcad(book, tempMathcad);
    assert.equal(mathcadValidation.ok, true, mathcadValidation.errors.join("\n"));
    assert.equal(mathcadValidation.areaErrors.length, 0);
    assert.deepEqual(mathcadValidation.formulaExplanationDiffs, [39]);
    assert.equal(mathcadValidation.hasSqrt, true);
    assert.equal(mathcadValidation.hasLiteralSubscripts, true);
    assert.equal(mathcadValidation.hasUnitedResults, true);

    const consistency = validateConsistency(book, evaluation, mathcadValidation, canonicalA);
    assert.equal(consistency.ok, true, consistency.errors.join("\n"));
    assert.equal(consistency.sentinelCount >= 3, true);

    const buckBoostTemplateXml = fs.readFileSync(buckBoostBook.outputs.mathcad.template, "utf8");
    const buckBoostMathcadA = buildMathcadXml(buckBoostBook, buckBoostEvaluation, buckBoostTemplateXml);
    const buckBoostMathcadB = buildMathcadXml(buckBoostBook, buckBoostEvaluation, buckBoostTemplateXml);
    assert.equal(buckBoostMathcadA.xml, buckBoostMathcadB.xml, "BUCK-BOOST Mathcad generation must be deterministic");
    fs.writeFileSync(tempBuckBoostMathcad, buckBoostMathcadA.xml, "utf8");
    const buckBoostMathcadValidation = validateMathcad(buckBoostBook, tempBuckBoostMathcad);
    assert.equal(buckBoostMathcadValidation.ok, true, buckBoostMathcadValidation.errors.join("\n"));
    assert.equal(buckBoostMathcadValidation.areaErrors.length, 0);
    assert.deepEqual(buckBoostMathcadValidation.formulaExplanationDiffs, [32]);
    assert.equal(buckBoostMathcadValidation.hasLiteralSubscripts, true);
    assert.equal(buckBoostMathcadValidation.hasUnitedResults, true);
    assert.match(buckBoostMathcadA.xml, /V\.intrans 表示[^<]*不是新增额定输入/);
    assert.match(buckBoostMathcadA.xml, /dI\.trans 表示[^<]*V\.intrans 表示[^<]*我得到 dI\.trans/);
    assert.doesNotMatch(buckBoostMathcadA.xml, /未解决警告|input\.prepcb-evidence|unresolved:|风险 \[/);
    const buckBoostConsistency = validateConsistency(buckBoostBook, buckBoostEvaluation, buckBoostMathcadValidation, buckBoostCanonicalA);
    assert.equal(buckBoostConsistency.ok, true, buckBoostConsistency.errors.join("\n"));
    assert.equal(buckBoostConsistency.sentinelCount, 18);

    const previewPayloadPath = path.join(tempRoot, "preview-nodes.json");
    fs.writeFileSync(previewPayloadPath, JSON.stringify([...preview.nodes, ...buckBoostPreview.nodes]), "utf8");
    const seed = spawnSync(process.execPath, ["--experimental-sqlite", __filename, "--seed", tempDataDir, previewPayloadPath], {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(seed.status, 0, seed.stderr || seed.stdout || "isolated preview seed failed");

    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATA_DIR: tempDataDir,
        PORT: String(port),
        HOST: "127.0.0.1",
        ADMIN_PASSWORD: "isolated-calculation-book-test-only",
        SITE_URL: baseUrl
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let serverOutput = "";
    child.stdout.on("data", (chunk) => { serverOutput += chunk; });
    child.stderr.on("data", (chunk) => { serverOutput += chunk; });
    await waitForServer(baseUrl, child);

    const routeChecks = [];
    for (const node of [...preview.nodes, ...buckBoostPreview.nodes]) {
      const apiResponse = await fetch(`${baseUrl}/api/knowledge-nodes/${node.slug}`);
      assert.equal(apiResponse.status, 200, `${node.slug} API route`);
      const apiNode = (await apiResponse.json()).node;
      assert.equal(apiNode.slug, node.slug);
      assert.equal(apiNode.title, node.title);
      const pageResponse = await fetch(`${baseUrl}/derive.html?slug=${node.slug}`);
      assert.equal(pageResponse.status, 200, `${node.slug} page route`);
      const page = await pageResponse.text();
      assert.match(page, /renderKnowledgeNodePage/);
      assert.doesNotMatch(page, /\ufffd|\?\?\?/);
      routeChecks.push({ slug: node.slug, api: 200, page: 200 });
    }
    assert.doesNotMatch(serverOutput, /SQLITE_CORRUPT|Migration .* failed/);
    await stopChild(child);
    child = null;

    const evidence = {
      schemaVersion: "larkix.calculation-book-isolated-preview.v1",
      status: "pass",
      dataDirPolicy: "fresh operating-system temporary directory; removed after test",
      productionOrCurrentDataTouched: false,
      canonicalStatus: book.publication.canonical,
      previewOverride: book.publication.previewOverride,
      nodes: routeChecks,
      formulaJumpTargets: ["ccm-flyback-current-chain-derivation", "triangular-wave-rms-foundation"],
      sentinelCount: consistency.sentinelCount,
      serverClosed: true,
      temporaryDataRemoved: true
    };
    fs.writeFileSync(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    const buckBoostEvidence = {
      schemaVersion: "larkix.calculation-book-isolated-preview.v1",
      status: "pass",
      dataDirPolicy: "fresh operating-system temporary directory; removed after test",
      productionOrCurrentDataTouched: false,
      canonicalStatus: buckBoostBook.publication.canonical,
      previewOverride: buckBoostBook.publication.previewOverride,
      nodes: routeChecks.filter((entry) => buckBoostPreview.nodes.some((node) => node.slug === entry.slug)),
      formulaJumpTargets: ["four-switch-buck-boost-transition-derivation", "inductor-volt-second-ripple-foundation"],
      sentinelCount: buckBoostConsistency.sentinelCount,
      serverClosed: true,
      temporaryDataRemoved: true
    };
    fs.writeFileSync(BUCK_BOOST_EVIDENCE, `${JSON.stringify(buckBoostEvidence, null, 2)}\n`, "utf8");
  } finally {
    if (child) await stopChild(child);
    safeRemoveTemp(tempRoot);
  }

  console.log("Calculation-book schema, traceability, Mathcad, Larkix, isolated DATA_DIR, and consistency tests passed.");
}

if (process.argv[2] === "--seed") {
  try {
    seedIsolatedDataDir(path.resolve(process.argv[3]), path.resolve(process.argv[4]));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
} else {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
