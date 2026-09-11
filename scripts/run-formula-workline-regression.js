"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s60-"));
const timeoutMs = 15 * 60 * 1000;
const maxFailureOutput = 12000;

function nodeCheck(id, label, file, sqlite = false) {
  return {
    id,
    label,
    command: process.execPath,
    args: [...(sqlite ? ["--experimental-sqlite"] : []), file],
  };
}

function npmCheck(id, label, script) {
  if (process.platform === "win32") {
    return {
      id,
      label,
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "run", script],
    };
  }
  return { id, label, command: "npm", args: ["run", script] };
}

function responsiveMathCheck() {
  const sourcePath = path.join(root, "scripts/test-adaptive-formula-height.js");
  const bootstrap = [
    "const fs=require('node:fs');",
    "const Module=require('node:module');",
    `const file=${JSON.stringify(sourcePath)};`,
    "const source=fs.readFileSync(file,'utf8').replace('for (const width of [390, 1366])','for (const width of [390, 768, 1366, 1920])').replace('12 browser surface/theme/width combinations','24 browser surface/theme/width combinations');",
    "const mod=new Module(file,module); mod.filename=file; mod.paths=Module._nodeModulePaths(require('node:path').dirname(file)); mod._compile(source,file);",
  ].join("");
  return {
    id: "responsive-high-math",
    label: "Complex high math at 390/768/1366/1920 in light and dark modes",
    command: process.execPath,
    args: ["-e", bootstrap],
  };
}

const checks = [
  nodeCheck("map-contract", "Canonical contract, six-level branch/merge DAG and projection negatives", "scripts/test-formula-derivation-map-contract.js"),
  nodeCheck("branching-dag", "Runtime branching DAG and public/CMS projections", "scripts/test-branching-derivation-graph.js", true),
  npmCheck("relationship-projection", "Formula relationship projection", "test:formula-relationship-projection"),
  npmCheck("binding-authority", "Formula binding authority", "test:formula-binding-authority"),
  nodeCheck("metadata-lifecycle", "Metadata categories, revisions, migration, archive, restore and protected delete", "scripts/test-formula-metadata-management.js", true),
  nodeCheck("detail-page", "Canonical formula page, continuation, publication privacy and legacy routing", "scripts/test-formula-detail-page.js", true),
  responsiveMathCheck(),
  npmCheck("math-rendering", "Shared math rendering", "test:math-rendering"),
  nodeCheck("inline-math", "Inline/block math separation", "scripts/test-inline-math-layout.js"),
  npmCheck("graph-layout", "Responsive graph layout, interaction, dark mode and accessibility", "test:formula-map-flow-layout"),
  npmCheck("graph-ui", "Formula marker and graph navigation UI", "test:formula-marker-graph-ui"),
  npmCheck("public-surface", "Anonymous public surface and 404 minimization", "test:public-surface"),
  npmCheck("private-cms", "Anonymous CMS 404, authentication and CSRF boundary", "test:private-cms-gateway"),
  npmCheck("markdown", "Shared Markdown and DOCX rendering", "test:markdown"),
  npmCheck("contract", "Project governance contract", "codex:contract"),
];

function redact(value) {
  return String(value || "")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*/g, "[REDACTED PRIVATE KEY]")
    .replace(/("?(?:csrfToken|password|token|cookie|authorization)"?\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

function run(check) {
  const startedAt = Date.now();
  const result = spawnSync(check.command, check.args, {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      NODE_ENV: "test",
      NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1",
    },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
  });
  return {
    ...check,
    passed: !result.error && result.status === 0,
    durationMs: Date.now() - startedAt,
    exitCode: result.status,
    output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
  };
}

function safeCleanup() {
  const resolved = path.resolve(dataDir);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)
      || !path.basename(resolved).startsWith("larkix-s60-")) {
    throw new Error(`Refusing to remove non-S60 data directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

console.log(`S60 formula workline regression: ${checks.length} checks`);
console.log(`Isolated DATA_DIR: ${dataDir}`);
const results = [];
try {
  for (const check of checks) {
    const result = run(check);
    results.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} (${result.durationMs} ms) - ${result.label}`);
    if (!result.passed && result.output) {
      const safe = redact(result.output);
      console.error(safe.length > maxFailureOutput ? `${safe.slice(0, maxFailureOutput)}\n...[truncated]` : safe);
    }
  }
} finally {
  safeCleanup();
}

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
const digest = crypto.createHash("sha256")
  .update(results.map(({ id, passed: ok }) => `${id}:${ok ? "pass" : "fail"}`).join("\n"))
  .digest("hex");
console.log(`S60 evidence digest: sha256:${digest}`);
console.log(`S60 summary: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
