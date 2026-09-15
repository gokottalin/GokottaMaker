"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const runnerDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s67-runner-"));
const timeoutMs = 20 * 60 * 1000;
const maxFailureOutput = 12000;
const expectedS60Digest = "sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3";
const tempPrefixes = [
  "larkix-s67-runner-",
  "larkix-s66-browser-",
  "larkix-s66-cdp-",
  "larkix-s65-browser-",
  "larkix-s64-browser-",
  "larkix-s64-cdp-",
  "larkix-discovery-migration-",
  "larkix-discovery-authority-",
  "larkix-formula-cms-consolidated-",
  "larkix-s60-",
];

function nodeCheck(id, label, file, args = []) {
  return { id, label, command: process.execPath, args: [...args, file] };
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

const checks = [
  nodeCheck("s66-static", "S66 card, theme, footer and version static contract", "scripts/test-public-card-theme-footer-version.js"),
  nodeCheck("s66-browser", "S66 real browser: first-frame theme, public/CMS boundary and 390px layout", "scripts/run-public-card-theme-footer-browser-fixture.js", ["--experimental-sqlite"]),
  nodeCheck("s65-static", "S65 public search and home composition static contract", "scripts/test-public-search-home-composition.js"),
  nodeCheck("s65-browser", "S65 real browser: five-type search, eight formulas and three slots", "scripts/run-public-search-home-browser-fixture.js", ["--experimental-sqlite"]),
  nodeCheck("s64-static", "S64 CMS draft operations static contract", "scripts/test-cms-draft-operations-controls.js"),
  { ...nodeCheck("s64-browser", "S64 real browser: draft conflict recovery and CMS controls", "scripts/run-cms-draft-operations-browser-fixture.js", ["--experimental-sqlite"]), args: ["--experimental-sqlite", "scripts/run-cms-draft-operations-browser-fixture.js", "--verify"] },
  nodeCheck("s63-migration", "S63 isolated discovery migration", "scripts/test-cross-content-discovery-migration.js", ["--experimental-sqlite"]),
  nodeCheck("s63-authority", "S63 discovery authority API", "scripts/test-cross-content-discovery-authority.js", ["--experimental-sqlite"]),
  nodeCheck("s62-consolidated", "S62 consolidated formula CMS", "scripts/test-formula-cms-consolidated.js", ["--experimental-sqlite"]),
  nodeCheck("s60-regression", "S60 formula workline regression", "scripts/run-formula-workline-regression.js"),
  nodeCheck("s50-regression", "S50 security and formula regression", "scripts/run-security-formula-regression.js"),
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
      DATA_DIR: runnerDataDir,
      NODE_ENV: "test",
      NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1",
    },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
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

function gitOutput(args) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error([result.error?.message, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout.trim();
}

function relatedProcesses() {
  if (process.platform !== "win32") return [];
  const script = [
    "$items = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -match '^(node|msedge|chrome)(\\.exe)?$' -and",
    "  $_.CommandLine -match 'larkix-(s64|s65|s66|s67|discovery|formula-cms)'",
    "};",
    "$items | ForEach-Object { \"$($_.ProcessId):$($_.Name)\" }",
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error([result.error?.message, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function tempResidues(excludeRunner = false) {
  const runnerName = path.basename(runnerDataDir);
  return fs.readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => tempPrefixes.some((prefix) => name.startsWith(prefix)))
    .filter((name) => !excludeRunner || name !== runnerName)
    .sort();
}

function safeCleanup() {
  const resolved = path.resolve(runnerDataDir);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)
      || !path.basename(resolved).startsWith("larkix-s67-runner-")) {
    throw new Error(`Refusing to remove non-S67 data directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

console.log(`S67 discovery experience regression: ${checks.length} checks`);
console.log(`Isolated DATA_DIR: ${runnerDataDir}`);
const initialResidues = tempResidues(true);
const results = [];
let boundaryPassed = false;
let boundaryDetails = "";

try {
  for (const check of checks) {
    const result = run(check);
    results.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id} (${result.durationMs} ms, exit ${result.exitCode ?? "null"}) - ${result.label}`);
    if (check.id === "s60-regression") {
      const digest = result.output.match(/S60 evidence digest:\s*(sha256:[a-f0-9]{64})/i)?.[1] || "missing";
      result.s60Digest = digest;
      console.log(`S60 digest observed: ${digest}`);
      if (digest !== expectedS60Digest) {
        result.passed = false;
        console.error(`S60 digest mismatch: expected ${expectedS60Digest}, got ${digest}`);
      }
    }
    if (!result.passed && result.output) {
      const safe = redact(result.output);
      console.error(safe.length > maxFailureOutput ? `${safe.slice(0, maxFailureOutput)}\n...[truncated]` : safe);
    }
  }

  const protectedDiff = gitOutput(["diff", "--name-only", "--", ".env", "database", "runtime-data", "uploads"]);
  const cachedDiff = gitOutput(["diff", "--cached", "--name-only"]);
  const finalResidues = tempResidues(true);
  const newResidues = finalResidues.filter((name) => !initialResidues.includes(name));
  const processes = relatedProcesses();
  boundaryPassed = !protectedDiff && !cachedDiff && newResidues.length === 0 && processes.length === 0;
  boundaryDetails = [
    `protected-path diff: ${protectedDiff || "empty"}`,
    `cached diff: ${cachedDiff || "empty"}`,
    `new temporary residues: ${newResidues.length ? newResidues.join(", ") : "0"}`,
    `related Node/Edge/Chrome processes: ${processes.length ? processes.join(", ") : "0"}`,
  ].join("; ");
  console.log(`${boundaryPassed ? "PASS" : "FAIL"} protected-boundary - ${boundaryDetails}`);
} catch (error) {
  boundaryDetails = redact(error?.stack || error);
  console.error(`FAIL protected-boundary - ${boundaryDetails}`);
} finally {
  try {
    safeCleanup();
    console.log("S67 runner DATA_DIR cleanup: complete");
  } catch (error) {
    boundaryPassed = false;
    console.error(`S67 runner DATA_DIR cleanup failed: ${redact(error?.stack || error)}`);
  }
}

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
const digest = results.find((result) => result.id === "s60-regression")?.s60Digest || "missing";
console.log(`S60 evidence digest: ${digest}`);
console.log(`S67 protected-boundary: ${boundaryPassed ? "PASS" : "FAIL"} - ${boundaryDetails}`);
console.log(`S67 summary: ${passed} passed, ${failed} failed, protected-boundary ${boundaryPassed ? "passed" : "failed"}`);
if (failed || !boundaryPassed) process.exitCode = 1;
