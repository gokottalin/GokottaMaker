"use strict";

const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const runnerDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s40-runner-"));
const npmCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const npmPrefix = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd"] : [];
const powershellCommand = process.platform === "win32" ? "powershell.exe" : "pwsh";
const runSecret = `s40-${crypto.randomBytes(18).toString("hex")}`;
const maxFailureOutput = 12000;
const checkTimeoutMs = 15 * 60 * 1000;

const s40OutputFiles = [
  "package.json",
  "scripts/run-batch-regression-evidence.js",
  "docs/batch-regression-evidence.md",
  "docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md",
];

const s40aAcceptedFiles = [
  "scripts/verify-api.ps1",
  "scripts/test-api-verify-redirected-output.js",
  "docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md",
];

const protectedHashes = new Map([
  ["styles/20-content.css", "c201a6eca1a6d2d1ce4d7a105d4530571c869c84dcb17a3db2b82900c3dd0752"],
  ["lib/seo.js", "c80df366fbf9292d63951b57a2188bc0390c3282e4aaaf213202e0dd050e410f"],
  ["styles/10-hero.css", "d2589f70e9e1d2145ebdc5dca95c499ad21e896ad15479a8dfbe4aa460418fe5"],
]);

const inheritedBomAllowlist = new Set(["admin/admin.js", "styles.css"]);
const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".lock", ".md", ".ps1", ".sh",
  ".svg", ".toml", ".txt", ".xml", ".yaml", ".yml",
]);
const auditState = { changedPaths: 0, classifiedPaths: 0, stagedPaths: 0 };

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function npmCheck(id, label, script) {
  return { id, label, command: npmCommand, args: [...npmPrefix, "run", script] };
}

function nodeCheck(id, label, file, experimentalSqlite = false) {
  const args = experimentalSqlite ? ["--experimental-sqlite", file] : [file];
  return { id, label, command: process.execPath, args };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(normalize(path.relative(root, absolute)));
  }
  return files;
}

function expandPattern(pattern) {
  const normalized = normalize(pattern);
  if (normalized.endsWith("/**")) {
    return walkFiles(path.join(root, normalized.slice(0, -3)));
  }
  if (!normalized.includes("*")) return [normalized];
  throw new Error(`Unsupported scope glob: ${normalized}`);
}

function sliceScope(first, last) {
  const registry = readJson("docs/codex-workline/implementation_slices.json");
  const patterns = registry.slices
    .filter((slice) => {
      const match = /^S(\d+)_/.exec(slice.id);
      const number = match ? Number(match[1]) : -1;
      return number >= first && number <= last;
    })
    .flatMap((slice) => slice.mayEdit || []);
  return [...new Set(patterns.flatMap(expandPattern))];
}

function acceptedTextFiles() {
  return [...new Set([...sliceScope(30, 39), ...s40aAcceptedFiles, ...s40OutputFiles])]
    .filter((file) => fs.existsSync(path.join(root, file)))
    .filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
}

function assertProtectedHashes() {
  const mismatches = [];
  for (const [file, expected] of protectedHashes) {
    const actual = sha256(file);
    if (actual !== expected) mismatches.push(`${file}: expected ${expected}, got ${actual}`);
  }
  if (mismatches.length) throw new Error(mismatches.join("\n"));
}

function assertRequirementMappings() {
  const dispatch = readJson("docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json");
  const expected = Array.from({ length: 12 }, (_, index) => `REQ-20260730-${String(index + 1).padStart(3, "0")}`);
  const source = new Set(dispatch.sourceRequirements.map((item) => item.requirementId));
  const mapped = new Set(
    dispatch.executionOrder
      .filter((item) => /^S3\d_/.test(item.slice))
      .flatMap((item) => item.requirements || [])
  );
  const s40 = dispatch.executionOrder.find((item) => item.slice === "S40_batch_regression_evidence");
  const failures = [];
  if (dispatch.dispatchId !== "DISPATCH-20260730-001") failures.push("dispatch id mismatch");
  for (const id of expected) {
    if (!source.has(id)) failures.push(`${id}: missing source package`);
    if (!mapped.has(id)) failures.push(`${id}: missing S30-S39 mapping`);
    if (!s40 || !(s40.requirements || []).includes(id)) failures.push(`${id}: missing S40 coverage`);
    const active = path.join(root, "docs/codex-workline/requirements/active", `${id}.json`);
    if (!fs.existsSync(active)) failures.push(`${id}: active brief missing`);
  }
  for (let number = 30; number <= 39; number += 1) {
    const item = dispatch.executionOrder.find((entry) => entry.slice.startsWith(`S${number}_`));
    if (!item || item.status !== "completed") failures.push(`S${number}: not completed in dispatch`);
    const handoff = item && path.join(root, "docs/codex-workline/slices", `${item.slice}_handoff.md`);
    if (!handoff || !fs.existsSync(handoff)) failures.push(`S${number}: accepted handoff missing`);
  }
  const s40a = dispatch.executionOrder.find((entry) => entry.slice === "S40A_api_verify_redirected_output");
  if (!s40a || s40a.status !== "completed") failures.push("S40A: not completed in dispatch");
  if (!fs.existsSync(path.join(root, "docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md"))) {
    failures.push("S40A: accepted handoff missing");
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function assertEncodingAndArtifacts() {
  const failures = [];
  for (const file of acceptedTextFiles()) {
    const buffer = fs.readFileSync(path.join(root, file));
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    if (hasBom && !inheritedBomAllowlist.has(file)) failures.push(`${file}: UTF-8 BOM detected`);
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      failures.push(`${file}: invalid UTF-8`);
      continue;
    }
    const text = buffer.toString("utf8");
    if (/\r(?!\n)/.test(text)) failures.push(`${file}: bare CR line ending detected`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function assertWhitespace() {
  const failures = [];
  for (const file of acceptedTextFiles()) {
    const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (/[ \t]+$/.test(lines[index])) failures.push(`${file}:${index + 1}: trailing whitespace`);
      if (/^(?:<{7}|={7}|>{7})(?: |$)/.test(lines[index])) {
        failures.push(`${file}:${index + 1}: unresolved conflict marker`);
      }
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function assertNoSecrets() {
  const patterns = [
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
    ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
    ["GitHub token", /\bgh[ps]_[A-Za-z0-9]{30,}\b/],
    ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ];
  const failures = [];
  for (const file of acceptedTextFiles()) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const [label, pattern] of patterns) {
      if (pattern.test(text)) failures.push(`${file}: possible ${label}`);
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function globMatches(file, pattern) {
  const normalized = normalize(pattern);
  if (normalized.endsWith("/**")) return file.startsWith(normalized.slice(0, -3));
  if (!normalized.includes("*")) return file === normalized;
  const regex = normalized
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", ".*")
    .replaceAll("*", "[^/]*");
  return new RegExp(`^${regex}$`).test(file);
}

function gitPaths(args) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error([result.error && result.error.message, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout.split(/\r?\n/).map(normalize).filter(Boolean);
}

function assertChangedPathAudit() {
  const tracked = gitPaths(["diff", "--name-only", "--relative"]);
  const untracked = gitPaths(["ls-files", "--others", "--exclude-standard"]);
  const staged = gitPaths(["diff", "--cached", "--name-only", "--relative"]);
  const changed = [...new Set([...tracked, ...untracked])];
  const slices = readJson("docs/codex-workline/implementation_slices.json");
  const patterns = slices.slices.flatMap((slice) => slice.mayEdit || []).map(normalize);
  const exactGovernance = new Set([
    "AGENTS.md",
    "PROJECT_WINDOW.md",
    "README.md",
    ".codex/larkix-governance.json",
    "docs/prompts/next_agents.md",
    "docs/codex-workline/task_registry.json",
    "docs/codex-workline/implementation_slices.json",
    "docs/codex-workline/A00_ProjectDirector_handoff.md",
    "agents/A00_ProjectDirector/brief.md",
    "lib/seo.js",
    "styles/20-content.css",
  ]);
  const classified = (file) => patterns.some((pattern) => globMatches(file, pattern))
    || exactGovernance.has(file)
    || file.startsWith("docs/codex-workline/requirements/")
    || file.startsWith("agents/A")
    || file.startsWith(".codex/agents/")
    || file.startsWith("docs/Agent");
  const failures = changed.filter((file) => !classified(file));
  auditState.changedPaths = changed.length;
  auditState.classifiedPaths = changed.length - failures.length;
  auditState.stagedPaths = staged.length;
  if (staged.length) failures.unshift(`staged paths are forbidden: ${staged.join(", ")}`);
  if (failures.length) throw new Error(failures.join("\n"));
}

function redact(value) {
  return String(value || "")
    .split(runSecret).join("[REDACTED]")
    .replace(/("?(?:csrfToken|password|token|cookie|authorization)"?\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

function trimFailure(value) {
  const safe = redact(value).trim();
  if (safe.length <= maxFailureOutput) return safe;
  return `${safe.slice(0, maxFailureOutput)}\n...[failure output truncated]`;
}

function runCommand(check) {
  const startedAt = Date.now();
  const result = spawnSync(check.command, check.args, {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: runnerDataDir,
      NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1",
    },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: check.timeoutMs || checkTimeoutMs,
    killSignal: "SIGTERM",
  });
  return {
    id: check.id,
    label: check.label,
    passed: !result.error && result.status === 0,
    durationMs: Date.now() - startedAt,
    exitCode: result.status,
    error: result.error ? result.error.message : "",
    output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
  };
}

function runInternal(check) {
  const startedAt = Date.now();
  try {
    check.execute();
    return { id: check.id, label: check.label, passed: true, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      id: check.id,
      label: check.label,
      passed: false,
      durationMs: Date.now() - startedAt,
      exitCode: 1,
      error: error && error.stack ? error.stack : String(error),
      output: "",
    };
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function safeRemoveRunnerData() {
  const resolved = path.resolve(runnerDataDir);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)
      || !path.basename(resolved).startsWith("larkix-s40-runner-")) {
    throw new Error(`Refusing to remove non-runner DATA_DIR: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

async function main() {
  const apiPort = await findFreePort();
  const syntaxFiles = [...new Set([...sliceScope(30, 39), ...s40aAcceptedFiles])]
    .filter((file) => file.endsWith(".js") && fs.existsSync(path.join(root, file)));
  const checks = [
    npmCheck("version", "Version contract", "check:version"),
    npmCheck("markdown", "Markdown renderer", "test:markdown"),
    npmCheck("math-rendering", "Shared math rendering", "test:math-rendering"),
    npmCheck("calculation-book", "Calculation book", "test:calculation-book"),
    npmCheck("formula-catalog", "Formula catalog", "test:formula-catalog"),
    npmCheck("article-formula", "Article formula authoring", "test:article-formula-authoring"),
    npmCheck("authoring-drawer", "Formula authoring drawer", "test:formula-authoring-drawer"),
    npmCheck("formula-versioning", "Formula reference versioning", "test:formula-reference-versioning"),
    npmCheck("formula-publication", "Formula publication workflow", "test:formula-publication"),
    npmCheck("linear-graph", "Linear derivation graph compatibility", "test:linear-derivation-graph"),
    npmCheck("branching-graph", "Branching derivation graph", "test:branching-derivation-graph"),
    npmCheck("legacy-migration", "Legacy formula migration safety", "test:legacy-formula-migration"),
    npmCheck("cover-coordinates", "Post cover coordinates", "test:post-cover-coordinates"),
    npmCheck("reading-minutes", "Post reading minutes", "test:post-reading-minutes"),
    npmCheck("focus-mode", "Focus mode", "test:focus-mode"),
    npmCheck("carousel-buffer", "Carousel focus buffer", "test:carousel-focus-buffer"),
    nodeCheck("inline-math", "Inline math layout", "scripts/test-inline-math-layout.js"),
    nodeCheck("focused-media", "Focused content media", "scripts/test-focused-content-media.js"),
    nodeCheck("dark-theme", "Full-site dark theme", "scripts/test-full-site-dark-theme.js"),
    nodeCheck("formula-binding", "Formula binding marker", "scripts/test-formula-binding-marker.js"),
    nodeCheck("md2file-semantics", "MD2File DOCX semantics", "scripts/test-md2file-docx-semantics.js"),
    nodeCheck("carousel-authority", "Hero carousel slot authority", "scripts/test-hero-carousel-authority.js", true),
    nodeCheck("formula-selection", "Article selected-formula creation", "scripts/test-article-formula-selection-create.js", true),
    nodeCheck("relation-recovery", "Legacy formula relation recovery", "scripts/test-legacy-formula-relation-migration.js", true),
    nodeCheck("formula-map", "Formula map flow layout", "scripts/test-formula-map-flow-layout.js"),
    nodeCheck("cms-feedback", "CMS feedback and publish dock", "scripts/test-cms-floating-feedback-publish-bar.js"),
    nodeCheck("md2file-public", "MD2File public entry", "scripts/test-md2file-public-entry.js", true),
    nodeCheck("api-redirect", "Redirected PowerShell API verification", "scripts/test-api-verify-redirected-output.js"),
    {
      id: "api",
      label: "Isolated API and CMS boundary",
      command: powershellCommand,
      args: [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/verify-api.ps1",
        "-Port", String(apiPort), "-AdminUsername", "Larkix", "-AdminPassword", runSecret,
      ],
    },
    {
      id: "syntax",
      label: "S30-S40A JavaScript syntax",
      command: process.execPath,
      args: [
        "-e",
        "const {spawnSync}=require('child_process');"
          + `const files=${JSON.stringify(syntaxFiles)};`
          + "for(const file of files){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});"
          + "if(r.status!==0)process.exit(r.status||1)}",
      ],
    },
    { id: "protected-hashes", label: "Protected file hashes", execute: assertProtectedHashes },
    { id: "requirement-map", label: "Twelve-requirement dispatch mapping", execute: assertRequirementMappings },
    { id: "encoding", label: "UTF-8, BOM, and line endings", execute: assertEncodingAndArtifacts },
    { id: "whitespace", label: "Whitespace and conflict-marker audit", execute: assertWhitespace },
    { id: "secrets", label: "Credential and private-key scan", execute: assertNoSecrets },
    { id: "changed-paths", label: "Complete changed-path classification", execute: assertChangedPathAudit },
    npmCheck("contract", "Codex contract", "codex:contract"),
  ];

  const results = [];
  console.log(`S40 batch regression evidence: ${checks.length} checks`);
  console.log(`Isolated DATA_DIR: ${runnerDataDir}`);
  for (const check of checks) {
    const result = check.execute ? runInternal(check) : runCommand(check);
    results.push(result);
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(`${marker} ${result.id} (${result.durationMs} ms) - ${result.label}`);
    if (!result.passed) {
      const details = [result.error, result.output].filter(Boolean).join("\n");
      console.error(trimFailure(details));
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  console.log(`Changed-path audit: ${auditState.classifiedPaths}/${auditState.changedPaths} classified, ${auditState.stagedPaths} staged`);
  console.log(`S40 summary: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(trimFailure(error && error.stack ? error.stack : error));
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      safeRemoveRunnerData();
    } catch (error) {
      console.error(trimFailure(error && error.stack ? error.stack : error));
      process.exitCode = 1;
    }
  });
