"use strict";

const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const runnerDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-s27-runner-"));
const npmCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const npmPrefix = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd"] : [];
const powershellCommand = process.platform === "win32" ? "powershell.exe" : "pwsh";
const runSecret = `s27-${crypto.randomBytes(18).toString("hex")}`;
const maxFailureOutput = 12000;
const checkTimeoutMs = 15 * 60 * 1000;

const protectedHashes = new Map([
  ["styles/20-content.css", "c201a6eca1a6d2d1ce4d7a105d4530571c869c84dcb17a3db2b82900c3dd0752"],
  ["admin/admin.css", "8ca8a5b700e43bccd2169057d71817de0c7a342c405cfb166a366f8e22c35c01"],
  ["styles/10-hero.css", "d2589f70e9e1d2145ebdc5dca95c499ad21e896ad15479a8dfbe4aa460418fe5"],
  ["styles/26-inline-math.css", "e257580e25fd9e9ec52eb0a55d9ad992da5d5b953e2db49bfde390d22b5f3d12"],
  ["styles/27-focused-content-media.css", "8424b6a8c99b7ce7a431ea8cc4e744f5befbe9aef439a2b3e56c7d3c316b8a30"],
]);

const acceptedImplementationFiles = [
  "migrations/020_formula_publication_workflow.js",
  "migrations/021_branching_derivation_graph.js",
  "migrations/022_formula_revision_presentation_snapshot.js",
  "migrations/023_legacy_formula_migration_support.js",
  "migrations/024_post_cover_coordinates.js",
  "migrations/025_post_reading_minutes.js",
  "lib/content.js",
  "lib/validators.js",
  "lib/legacy-formula-migration.js",
  "server.js",
  "data/markdown-renderer.js",
  "data/media.js",
  "data/posts.js",
  "admin/index.html",
  "admin/course-paths.html",
  "admin/admin.js",
  "admin/admin.css",
  "admin/admin-dark.css",
  "derive.html",
  "maker.html",
  "post.js",
  "main.js",
  "category-page.js",
  "formula-graph.js",
  "styles.css",
  "styles/25-cover-crop.css",
  "styles/26-inline-math.css",
  "styles/27-focused-content-media.css",
  "styles/28-full-site-dark.css",
  "scripts/migrate-legacy-formulas.js",
  "scripts/test-formula-publication-workflow.js",
  "scripts/test-branching-derivation-graph.js",
  "scripts/test-formula-authoring-drawer.js",
  "scripts/test-legacy-formula-migration.js",
  "scripts/test-post-cover-coordinates.js",
  "scripts/test-post-reading-minutes.js",
  "scripts/test-inline-math-layout.js",
  "scripts/test-focused-content-media.js",
  "scripts/test-full-site-dark-theme.js",
  "docs/calculation-book-authoring-guide.md",
  "docs/legacy-formula-migration.md",
  "docs/post-cover-coordinates.md",
  "docs/post-reading-minutes.md",
  "docs/inline-math-layout.md",
  "docs/focused-content-media.md",
  "docs/full-site-dark-theme.md",
  "package.json",
];

const syntaxFiles = acceptedImplementationFiles.filter((file) => file.endsWith(".js"));
const inheritedBomAllowlist = new Set(["admin/admin.js", "styles.css"]);

function npmCheck(id, label, script) {
  return { id, label, command: npmCommand, args: [...npmPrefix, "run", script] };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}

function assertProtectedHashes() {
  const mismatches = [];
  for (const [file, expected] of protectedHashes) {
    const actual = sha256(file);
    if (actual !== expected) mismatches.push(`${file}: expected ${expected}, got ${actual}`);
  }
  if (mismatches.length) throw new Error(mismatches.join("\n"));
}

function assertEncodingAndArtifacts() {
  const files = [...acceptedImplementationFiles, "scripts/run-batch-regression-evidence.js"]
    .filter((file, index, list) => list.indexOf(file) === index)
    .filter((file) => fs.existsSync(path.join(root, file)));
  const failures = [];
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(root, file));
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    if (hasBom && !inheritedBomAllowlist.has(file)) {
      failures.push(`${file}: UTF-8 BOM detected`);
    }
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      failures.push(`${file}: invalid UTF-8`);
      continue;
    }
    if (/\r(?!\n)/.test(text)) failures.push(`${file}: bare CR line ending detected`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function assertWhitespace() {
  const files = [...acceptedImplementationFiles, "scripts/run-batch-regression-evidence.js"]
    .filter((file, index, list) => list.indexOf(file) === index)
    .filter((file) => fs.existsSync(path.join(root, file)));
  const failures = [];
  for (const file of files) {
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
  const durationMs = Date.now() - startedAt;
  const passed = !result.error && result.status === 0;
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return {
    id: check.id,
    label: check.label,
    passed,
    durationMs,
    exitCode: result.status,
    error: result.error ? result.error.message : "",
    output,
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
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !path.basename(resolved).startsWith("larkix-s27-runner-")) {
    throw new Error(`Refusing to remove non-runner DATA_DIR: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

async function main() {
  const apiPort = await findFreePort();
  const checks = [
    npmCheck("markdown", "Markdown renderer", "test:markdown"),
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
    { id: "inline-math", label: "Inline math layout", command: process.execPath, args: ["scripts/test-inline-math-layout.js"] },
    { id: "focused-media", label: "Focused content media", command: process.execPath, args: ["scripts/test-focused-content-media.js"] },
    { id: "dark-theme", label: "Full-site dark theme", command: process.execPath, args: ["scripts/test-full-site-dark-theme.js"] },
    {
      id: "api",
      label: "Isolated API and CMS boundary",
      command: powershellCommand,
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts/verify-api.ps1",
        "-Port",
        String(apiPort),
        "-AdminUsername",
        "Larkix",
        "-AdminPassword",
        runSecret,
      ],
    },
    {
      id: "syntax",
      label: "JavaScript syntax",
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
    { id: "encoding", label: "UTF-8, BOM, and line endings", execute: assertEncodingAndArtifacts },
    { id: "whitespace", label: "Whitespace and conflict-marker audit", execute: assertWhitespace },
    npmCheck("contract", "Codex contract", "codex:contract"),
  ];

  const results = [];
  console.log(`S27 batch regression evidence: ${checks.length} checks`);
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
  console.log(`S27 summary: ${passed} passed, ${failed} failed`);
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
