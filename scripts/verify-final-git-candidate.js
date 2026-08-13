const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const defaultRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const rootArgIndex = process.argv.indexOf("--root");
const root = rootArgIndex >= 0 ? path.resolve(process.argv[rootArgIndex + 1]) : defaultRoot;
const manifestPath = path.join(root, "docs", "final-git-manifest-20260813.json");
const auditPath = path.join(root, "docs", "final-repository-audit-20260813.md");
const stagingPath = path.join(root, "docs", "final-git-staging-plan-20260813.md");
const refresh = args.has("--refresh-manifest");
const candidateMode = args.has("--candidate");
const failures = [];
const passes = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  passes.push(message);
}

function note(message) {
  notes.push(message);
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: options.encoding || "utf8",
    env: options.env || process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(`${command} ${commandArgs.join(" ")} failed (${result.status}): ${detail}`);
  }
  return result;
}

function parsePorcelain(buffer) {
  const records = buffer.toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const status = record.slice(0, 2);
    let relativePath = record.slice(3);
    if (status.includes("R") || status.includes("C")) {
      const target = records[index + 1];
      if (!target) throw new Error(`Missing rename/copy target for ${relativePath}`);
      relativePath = target;
      index += 1;
    }
    entries.push({ status, path: toPosix(relativePath) });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function liveStatus() {
  const result = run("git", ["status", "--porcelain=v1", "-z", "-uall"], { encoding: "buffer" });
  return parsePorcelain(result.stdout);
}

function classify(entry) {
  if (/^docs\/Agent[^/]*\//u.test(entry.path)) {
    return {
      decision: "exclude",
      owner: "historical-legacy-docs",
      reason: "untracked pyramid-era Agent document; retained locally but excluded as historical noise",
    };
  }

  const value = entry.path;
  if (/^\.codex\/agents\//.test(value) || /^agents\//.test(value)) {
    return { decision: "include", owner: "Codex-workline", reason: "active temporary Agent contract" };
  }
  if (/^docs\/codex-workline\/requirements\//.test(value)) {
    return { decision: "include", owner: "requirements", reason: "confirmed requirement or dispatch package" };
  }
  if (/^docs\/codex-workline\//.test(value) || /^(\.codex\/larkix-governance\.json|PROJECT_WINDOW\.md)$/.test(value)) {
    return { decision: "include", owner: "A00-governance", reason: "active project governance and handoff state" };
  }
  if (/^admin\//.test(value)) {
    return { decision: "include", owner: "CMS", reason: "accepted CMS implementation" };
  }
  if (/^migrations\//.test(value)) {
    return { decision: "include", owner: "database-schema", reason: "accepted additive migration" };
  }
  if (/^scripts\/(?:test-|run-|verify-)/.test(value)) {
    return { decision: "include", owner: "QA", reason: "accepted test or release verifier" };
  }
  if (/^(\.env\.example|deploy\/|scripts\/gokottamaker\.env\.example)/.test(value)) {
    return { decision: "include", owner: "operations-template", reason: "secret-free environment or deployment template" };
  }
  if (/^docs\//.test(value)) {
    return { decision: "include", owner: "documentation", reason: "release, deployment, security, or repository documentation" };
  }
  return { decision: "include", owner: "product", reason: "accepted product or release identity file" };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function manifestDigest(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  clone.validation.manifestSha256 = "";
  return sha256(`${JSON.stringify(clone, null, 2)}\n`);
}

function ignoredAudit() {
  const result = run("git", ["status", "--ignored", "--porcelain=v1", "-z", "--untracked-files=normal"], {
    encoding: "buffer",
  });
  const reasons = [
    [/^\.env$/, "local secret environment"],
    [/^(database\/|runtime-data\/|uploads\/)/, "runtime/current data"],
    [/^node_modules\//, "installed dependencies"],
    [/^(\.codex-logs\/|\.tmp\/)/, "temporary/log evidence"],
  ];
  const entries = parsePorcelain(result.stdout)
    .filter((entry) => entry.status === "!!")
    .map((entry) => ({
      ...entry,
      decision: "exclude",
      reason: (reasons.find(([pattern]) => pattern.test(entry.path)) || [null, "ignored local artifact"])[1],
    }));
  return { count: entries.length, entries };
}

function buildManifest() {
  const status = liveStatus();
  const include = [];
  const exclude = [];
  const review = [];
  for (const entry of status) {
    const classification = classify(entry);
    const output = { status: entry.status, path: entry.path, owner: classification.owner, reason: classification.reason };
    if (classification.decision === "include") include.push(output);
    else if (classification.decision === "exclude") exclude.push(output);
    else review.push(output);
  }
  const branch = run("git", ["branch", "--show-current"]).stdout.trim();
  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  const remote = run("git", ["remote", "get-url", "origin"], { allowFailure: true }).stdout.trim();
  const manifest = {
    schemaVersion: "larkix.final-git-manifest.v2",
    manifestId: "FINAL-GIT-20260813-S55",
    generatedAt: new Date().toISOString(),
    repository: { root: toPosix(root), branch, head, remote },
    policy: {
      statusCommand: "git status --porcelain=v1 -z -uall",
      partitionRule: "Every live status path appears exactly once in include, exclude, or review.",
      includeRule: "Include accepted product, CMS, tests, migrations, secret-free templates, confirmed requirements, active governance, Agent briefs/configs, handoffs, and final release evidence.",
      excludeRule: "Exclude only untracked pyramid-era docs/Agent* history in the live status set; do not delete it.",
      reviewRule: "Must be empty before release candidate staging.",
      gitWriteAuthorized: true,
      gitWriteBoundary: "Only A64 exact pathspec staging, one release commit, one optional governance-closure commit, and ordinary fast-forward push to the existing origin/main are authorized.",
    },
    counts: { liveStatus: status.length, include: include.length, exclude: exclude.length, review: review.length },
    include,
    exclude,
    review,
    ignoredAudit: ignoredAudit(),
    globalExclusions: [
      ".env", "database/*.sqlite*", "runtime-data/", "uploads/", ".codex-logs/", ".tmp/",
      "node_modules/", "*.log", "certificates and private keys", "unencrypted backups or exported production/current data",
    ],
    validation: {
      uniqueStatusPaths: true,
      partitionCountMatches: true,
      reviewEmpty: review.length === 0,
      manifestSha256: "",
    },
  };
  manifest.validation.manifestSha256 = manifestDigest(manifest);
  return manifest;
}

function quotePowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function writeGeneratedDocuments(manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const paths = manifest.include.map((entry) => `  ${quotePowerShell(entry.path)}`).join(",\n");
  const staging = `# Final Git Staging Plan 20260813\n\n` +
    `Candidate: \`V2.5.4+20260814-0001\`\n\n` +
    `This plan contains ${manifest.counts.include} exact pathspecs. It deliberately does not use wildcard or repository-wide staging. ` +
    `A64 must revalidate the manifest against live status before using it.\n\n` +
    `\`\`\`powershell\n$paths = @(\n${paths}\n)\n\n` +
    `git add -- $paths\n\`\`\`\n\n` +
    `After staging, A64 must prove that \`git diff --cached --name-only\` equals this array exactly and that every excluded path remains unstaged.\n`;
  fs.writeFileSync(stagingPath, staging, "utf8");

  const audit = `# Final Repository Audit 20260813\n\n` +
    `Generated from \`git status --porcelain=v1 -z -uall\` for HEAD \`${manifest.repository.head}\`.\n\n` +
    `- Live status: ${manifest.counts.liveStatus}\n` +
    `- Include: ${manifest.counts.include}\n` +
    `- Exclude: ${manifest.counts.exclude}\n` +
    `- Review: ${manifest.counts.review}\n` +
    `- Ignored entries audited: ${manifest.ignoredAudit.count}\n` +
    `- Manifest digest: \`${manifest.validation.manifestSha256}\`\n\n` +
    `All live paths occur exactly once. The only live exclusions are ${manifest.counts.exclude} untracked pyramid-era \`docs/Agent*\` records retained locally as historical noise. ` +
    `Ignored secrets, runtime databases, dependencies, logs, and temporary data remain outside the candidate. ` +
    `Only the S55 exact-path Git operations recorded in the active governance are authorized.\n`;
  fs.writeFileSync(auditPath, audit, "utf8");
}

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function verifyPartition(manifest) {
  const live = liveStatus();
  const listed = [...manifest.include, ...manifest.exclude, ...manifest.review];
  const liveMap = new Map(live.map((entry) => [entry.path, entry.status]));
  const listedMap = new Map();
  for (const entry of listed) {
    if (listedMap.has(entry.path)) fail(`Manifest path appears more than once: ${entry.path}`);
    listedMap.set(entry.path, entry.status);
  }
  for (const [relativePath, status] of liveMap) {
    if (!listedMap.has(relativePath)) fail(`Live status path missing from manifest: ${relativePath}`);
    else if (listedMap.get(relativePath) !== status) fail(`Status mismatch for ${relativePath}`);
  }
  for (const relativePath of listedMap.keys()) {
    if (!liveMap.has(relativePath)) fail(`Manifest path is not in live status: ${relativePath}`);
  }
  if (manifest.review.length !== 0) fail(`Manifest review is not empty (${manifest.review.length})`);
  if (manifest.counts.liveStatus !== live.length || listed.length !== live.length) fail("Manifest counts do not match live status");
  if (manifest.validation.manifestSha256 !== manifestDigest(manifest)) fail("Manifest digest mismatch");
  if (!failures.length) pass(`manifest partition ${manifest.include.length}/${manifest.exclude.length}/0 exactly matches ${live.length} live paths`);
}

function walk(relative = "") {
  const absolute = path.join(root, relative);
  const output = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = toPosix(path.join(relative, entry.name));
    if ([".git", "node_modules", "database", "runtime-data", "uploads", ".tmp", ".codex-logs"].includes(entry.name)) continue;
    if (entry.isDirectory()) output.push(...walk(child));
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

function verifyCandidateFiles(manifest) {
  const files = candidateMode
    ? walk()
    : manifest.include.map((entry) => entry.path).filter((relativePath) => fs.existsSync(path.join(root, relativePath)));
  const sensitivePath = /(^|\/)(?:\.env(?!\.example$)|[^/]+\.(?:key|pem|p12|pfx|sqlite(?:-wal|-shm)?|bak|zip))$/i;
  const textExtensions = new Set([".css", ".csv", ".html", ".js", ".json", ".md", ".ps1", ".toml", ".txt", ".xml", ".yaml", ".yml"]);
  const highConfidenceSecrets = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  ];
  const forbiddenRuntimePath = /(?:[A-Za-z]:[\\/](?:Users|Project)[\\/]|\/(?:home|Users)\/[^/]+\/)/;
  let bomCount = 0;

  for (const relativePath of files) {
    const absolute = path.join(root, relativePath);
    const stat = fs.statSync(absolute);
    if (sensitivePath.test(relativePath)) fail(`Sensitive candidate path: ${relativePath}`);
    if (stat.size > 10 * 1024 * 1024) fail(`Candidate file exceeds 10 MiB: ${relativePath} (${stat.size})`);
    if (!textExtensions.has(path.extname(relativePath).toLowerCase()) && !["AGENTS.md", ".env.example"].includes(relativePath)) continue;
    const bytes = fs.readFileSync(absolute);
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail(`Text file is not valid UTF-8: ${relativePath}`);
      continue;
    }
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bomCount += 1;
    if (highConfidenceSecrets.some((pattern) => pattern.test(text))) fail(`High-confidence secret pattern in ${relativePath}`);
    const operationalPath = /^(?:\.env\.example|package(?:-lock)?\.json|server\.js|api\/|deploy\/|lib\/|migrations\/|scripts\/)/.test(relativePath);
    if (operationalPath && forbiddenRuntimePath.test(text)) {
      fail(`Machine-specific absolute path outside historical governance evidence: ${relativePath}`);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  if (packageJson.version !== "2.5.4") fail(`package.json version is ${packageJson.version}, expected 2.5.4`);
  if (packageLock.version !== packageJson.version || packageLock.packages?.[""]?.version !== packageJson.version) fail("package-lock version does not match package.json");
  const governance = JSON.parse(fs.readFileSync(path.join(root, ".codex", "larkix-governance.json"), "utf8"));
  if (governance.workspaceRoot && path.resolve(governance.workspaceRoot).toLowerCase() !== root.toLowerCase()) {
    fail(`Governance workspaceRoot is machine-specific (${governance.workspaceRoot}); candidate root is ${toPosix(root)}`);
  }
  if (packageJson.dependencies?.katex !== "0.16.22") fail("KaTeX dependency is not locked to 0.16.22");
  const katexPackage = path.join(root, "node_modules", "katex", "package.json");
  if (fs.existsSync(katexPackage)) {
    const katex = JSON.parse(fs.readFileSync(katexPackage, "utf8"));
    if (katex.license !== "MIT") fail(`Unexpected KaTeX license: ${katex.license}`);
    else pass("dependency license audit: katex 0.16.22 MIT");
  } else if (candidateMode) {
    fail("Installed KaTeX metadata is missing; run npm ci before candidate audit");
  }
  note(`valid UTF-8 audit covered ${files.length} files; ${bomCount} retained UTF-8 BOM file(s) were observed`);
  if (!failures.length) pass(`candidate file audit passed for ${files.length} files`);
}

if (refresh) {
  if (root !== defaultRoot) throw new Error("--refresh-manifest is only allowed in the active checkout");
  const manifest = buildManifest();
  writeGeneratedDocuments(manifest);
  console.log(`Refreshed manifest: ${manifest.counts.include} include / ${manifest.counts.exclude} exclude / ${manifest.counts.review} review`);
  process.exit(0);
}

const manifest = readManifest();
if (!candidateMode) verifyPartition(manifest);
verifyCandidateFiles(manifest);

for (const message of passes) console.log(`PASS ${message}`);
for (const message of notes) console.log(`NOTE ${message}`);
for (const message of failures) console.error(`FAIL ${message}`);
if (failures.length) {
  console.error(`Final candidate audit failed: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`Final candidate audit passed: ${passes.length} check group(s)`);
