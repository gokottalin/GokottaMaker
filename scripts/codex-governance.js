const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const configPath = ".codex/larkix-governance.json";
const jsonCache = new Map();

function rootPath(relativePath) {
  return path.join(root, relativePath);
}

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function exists(relativePath) {
  return fs.existsSync(rootPath(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(rootPath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath).replace(/^\uFEFF/, ""));
}

function getValue(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, object);
}

function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizePathForCompare(value) {
  return toPosix(path.resolve(value)).replace(/\/$/, "").toLowerCase();
}

function displayPath(value) {
  return toPosix(path.resolve(value)).replace(/\/$/, "");
}

function createReport() {
  return {
    passed: [],
    warnings: [],
    failures: [],
    pass(message) {
      this.passed.push(message);
    },
    warn(message) {
      this.warnings.push(message);
    },
    fail(message) {
      this.failures.push(message);
    }
  };
}

function printReport(title, report) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  for (const message of report.failures) console.log(`FAIL ${message}`);
  for (const message of report.warnings) console.log(`WARN ${message}`);
  for (const message of report.passed) console.log(`OK   ${message}`);
  console.log(
    `\nSummary: ${report.passed.length} passed, ${report.warnings.length} warnings, ${report.failures.length} failures.`
  );
  if (report.failures.length) process.exitCode = 1;
}

function loadConfig(report) {
  try {
    return readJson(configPath);
  } catch (error) {
    report.fail(`${configPath} cannot be read or parsed: ${error.message}`);
    return null;
  }
}

function assertEqual(report, label, actual, expected) {
  if (actual === expected) {
    report.pass(`${label} is ${JSON.stringify(expected)}`);
    return;
  }
  report.fail(`${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function assertPathEqual(report, label, actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") {
    report.fail(`${label} is ${JSON.stringify(actual)}, expected path ${JSON.stringify(expected)}`);
    return;
  }

  if (normalizePathForCompare(actual) === normalizePathForCompare(expected)) {
    report.pass(`${label} is ${displayPath(expected)} (actual ${displayPath(actual)})`);
    return;
  }

  report.fail(`${label} is ${displayPath(actual)}, expected ${displayPath(expected)}`);
}

function assertFileExists(report, relativePath) {
  if (exists(relativePath)) {
    report.pass(`${relativePath} exists`);
    return;
  }
  report.fail(`${relativePath} is missing`);
}

function assertArrayIncludes(report, label, actual, expected) {
  if (!Array.isArray(actual)) {
    report.fail(`${label} is not an array`);
    return;
  }

  if (actual.includes(expected)) {
    report.pass(`${label} includes ${JSON.stringify(expected)}`);
    return;
  }

  report.fail(`${label} is missing ${JSON.stringify(expected)}`);
}

function assertArrayEquals(report, label, actual, expected) {
  if (!Array.isArray(actual)) {
    report.fail(`${label} is not an array`);
    return;
  }

  const same = actual.length === expected.length && actual.every((value, index) => value === expected[index]);

  if (same) {
    report.pass(`${label} matches expected list`);
    return;
  }

  report.fail(`${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function assertArrayMinLength(report, label, actual, minLength) {
  if (!Array.isArray(actual)) {
    report.fail(`${label} is not an array`);
    return;
  }

  if (actual.length >= minLength) {
    report.pass(`${label} has ${actual.length} entries`);
    return;
  }

  report.fail(`${label} has ${actual.length} entries, expected at least ${minLength}`);
}

function assertTextIncludes(report, label, text, fragment) {
  if (text.includes(fragment)) {
    report.pass(`${label} contains ${JSON.stringify(fragment)}`);
    return;
  }

  report.fail(`${label} is missing required text ${JSON.stringify(fragment)}`);
}

function tryReadJson(report, relativePath) {
  if (jsonCache.has(relativePath)) return jsonCache.get(relativePath);

  try {
    const json = readJson(relativePath);
    report.pass(`${relativePath} parses as JSON`);
    jsonCache.set(relativePath, json);
    return json;
  } catch (error) {
    report.fail(`${relativePath} cannot be parsed as JSON: ${error.message}`);
    jsonCache.set(relativePath, null);
    return null;
  }
}

function gitLines(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return null;
  }
}

function gitOneLine(args) {
  const lines = gitLines(args);
  return lines && lines.length ? lines[0] : null;
}

function checkPackageScripts(report, scripts) {
  const packageJson = tryReadJson(report, "package.json");
  if (!packageJson) return;

  for (const [scriptName, expected] of Object.entries(scripts)) {
    assertEqual(report, `package.json scripts.${scriptName}`, packageJson.scripts?.[scriptName], expected);
  }
}

function checkGitignore(report, requiredEntries) {
  if (!exists(".gitignore")) {
    report.fail(".gitignore is missing");
    return;
  }

  const text = readText(".gitignore");
  for (const entry of requiredEntries) {
    if (text.includes(entry)) {
      report.pass(`.gitignore contains ${entry}`);
    } else {
      report.warn(`.gitignore does not contain ${entry}`);
    }
  }
}

function checkRequiredText(report, relativePath, fragments) {
  if (!Array.isArray(fragments) || !fragments.length) return;

  if (!exists(relativePath)) {
    report.fail(`${relativePath} is missing`);
    return;
  }

  const text = readText(relativePath);
  for (const fragment of fragments) {
    assertTextIncludes(report, relativePath, text, fragment);
  }
}

function checkA01Completion(report, config) {
  const rules = config.contractChecker.a01Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  const sourceRegistryPath = "docs/codex-workline/source_registry.json";
  const resourceIndexPath = "docs/codex-workline/resource_index.md";
  const handoffPath = "docs/codex-workline/A01_ProjectStateRetriever_handoff.md";
  const sourceRegistry = tryReadJson(report, sourceRegistryPath);

  if (sourceRegistry) {
    assertEqual(report, "A01 source registry schema", sourceRegistry.schema, rules.schema);
    assertEqual(report, "A01 source registry producer", sourceRegistry.producer, rules.producer);
    assertEqual(report, "A01 source registry status", sourceRegistry.status, rules.status);
    assertPathEqual(report, "A01 source registry workspaceRoot", sourceRegistry.workspaceRoot, rules.workspaceRoot);
    assertArrayEquals(report, "A01 generatedArtifacts", sourceRegistry.generatedArtifacts, rules.generatedArtifacts);

    for (const [field, expected] of Object.entries(rules.runControls || {})) {
      assertEqual(report, `A01 runControls.${field}`, getValue(sourceRegistry, `runControls.${field}`), expected);
    }

    for (const [field, expected] of Object.entries(rules.projectState || {})) {
      assertEqual(report, `A01 projectState.${field}`, getValue(sourceRegistry, `projectState.${field}`), expected);
    }

    for (const sourceClass of rules.requiredSourceClasses || []) {
      assertArrayIncludes(report, "A01 sourceClasses", sourceRegistry.sourceClasses, sourceClass);
    }

    const sources = Array.isArray(sourceRegistry.sources) ? sourceRegistry.sources : [];
    const sourceIds = sources.map((source) => source.id);
    for (const sourceId of rules.requiredSourceIds || []) {
      assertArrayIncludes(report, "A01 sources", sourceIds, sourceId);
    }

    const postCheck = rules.postA01CodexCheck || {};
    assertEqual(
      report,
      "A01 post-check command",
      getValue(sourceRegistry, "resourceStats.postA01CodexCheck.command"),
      postCheck.command
    );
    assertEqual(
      report,
      "A01 post-check exitCode",
      getValue(sourceRegistry, "resourceStats.postA01CodexCheck.exitCode"),
      postCheck.exitCode
    );
    assertEqual(
      report,
      "A01 post-check contract failures",
      getValue(sourceRegistry, "resourceStats.postA01CodexCheck.contract.failures"),
      postCheck.contractFailures
    );
    assertEqual(
      report,
      "A01 post-check resource failures",
      getValue(sourceRegistry, "resourceStats.postA01CodexCheck.resources.failures"),
      postCheck.resourceFailures
    );
  }

  checkRequiredText(report, resourceIndexPath, rules.resourceIndexRequiredText);
  checkRequiredText(report, handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A01 completion confirmed by source_registry.json, resource_index.md, and handoff");
  }
}

function checkA05Completion(report, config) {
  const rules = config.contractChecker.a05Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  const slicesPath = "docs/codex-workline/implementation_slices.json";
  const handoffPath = "docs/codex-workline/A05_ImplementationSlicePlanner_handoff.md";
  const slicesFile = tryReadJson(report, slicesPath);

  if (slicesFile) {
    assertEqual(report, "A05 implementation slices schema", slicesFile.schema, rules.schema);
    assertEqual(report, "A05 implementation slices producer", slicesFile.producer, rules.producer);
    assertEqual(report, "A05 implementation slices status", slicesFile.status, rules.status);
    assertPathEqual(report, "A05 implementation slices workspaceRoot", slicesFile.workspaceRoot, rules.workspaceRoot);

    for (const [field, expected] of Object.entries(rules.requiredCurrentGate || {})) {
      assertEqual(report, `A05 currentGate.${field}`, getValue(slicesFile, `currentGate.${field}`), expected);
    }

    const slices = Array.isArray(slicesFile.slices) ? slicesFile.slices : [];
    assertArrayMinLength(report, "A05 slices", slices, rules.minSliceCount || 1);
    const sliceIds = slices.map((slice) => slice.id);
    for (const sliceId of rules.requiredSliceIds || []) {
      assertArrayIncludes(report, "A05 slice ids", sliceIds, sliceId);
    }

    const requiredArrayFields = ["reads", "mayEdit", "outputs", "verification", "dependencies", "forbidden"];
    for (const slice of slices) {
      if (!slice.id) {
        report.fail("A05 slice is missing id");
        continue;
      }
      if (slice.agent) {
        report.pass(`A05 ${slice.id} declares agent ${slice.agent}`);
      } else {
        report.fail(`A05 ${slice.id} is missing agent`);
      }
      if (slice.status) {
        report.pass(`A05 ${slice.id} declares status ${slice.status}`);
      } else {
        report.fail(`A05 ${slice.id} is missing status`);
      }
      for (const field of requiredArrayFields) {
        assertArrayMinLength(report, `A05 ${slice.id}.${field}`, slice[field], 1);
      }
    }
  }

  checkRequiredText(report, handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A05 completion confirmed by implementation_slices.json and handoff");
  }
}

function checkA06Completion(report, config) {
  const rules = config.contractChecker.a06Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  checkRequiredText(report, rules.contractPath, rules.contractRequiredText);
  checkRequiredText(report, rules.handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A06 completion confirmed by S01 contract and handoff");
  }
}

function checkA07Completion(report, config) {
  const rules = config.contractChecker.a07Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  for (const [relativePath, fragments] of Object.entries(rules.migrationRequiredText || {})) {
    checkRequiredText(report, relativePath, fragments);
  }
  checkRequiredText(report, rules.handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A07 completion confirmed by migration files and S02 handoff");
  }
}

function checkA08Completion(report, config) {
  const rules = config.contractChecker.a08Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  for (const [relativePath, fragments] of Object.entries(rules.sourceRequiredText || {})) {
    checkRequiredText(report, relativePath, fragments);
  }
  checkRequiredText(report, rules.handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A08 completion confirmed by API/runtime files and S03 handoff");
  }
}

function checkA09Completion(report, config) {
  const rules = config.contractChecker.a09Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  for (const [relativePath, fragments] of Object.entries(rules.sourceRequiredText || {})) {
    checkRequiredText(report, relativePath, fragments);
  }
  checkRequiredText(report, rules.handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A09 completion confirmed by Markdown/DOCX files and S04 handoff");
  }
}

function checkA10Completion(report, config) {
  const rules = config.contractChecker.a10Completion;
  if (!rules) return;

  const failuresBefore = report.failures.length;
  for (const [relativePath, fragments] of Object.entries(rules.sourceRequiredText || {})) {
    checkRequiredText(report, relativePath, fragments);
  }
  checkRequiredText(report, rules.handoffPath, rules.handoffRequiredText);

  if (report.failures.length === failuresBefore) {
    report.pass("A10 completion confirmed by CMS files and S05 handoff");
  }
}

function checkTaskRegistryState(report, registry, worklineConfig) {
  const taskAgents = Array.isArray(registry.taskAgents) ? registry.taskAgents : [];
  if (taskAgents.length > 0) {
    report.pass(`workline declares ${taskAgents.length} short task agents`);
  } else {
    report.fail("workline declares no short task agents");
    return;
  }

  const byId = new Map(taskAgents.map((task) => [task.id, task]));
  for (const [taskId, expectedStatus] of Object.entries(worklineConfig.expectedTaskStatuses || {})) {
    assertEqual(report, `workline ${taskId} status`, byId.get(taskId)?.status, expectedStatus);
  }

  const nextTasks = taskAgents.filter((task) => task.status === "next").map((task) => task.id);
  if (worklineConfig.onlyNextTask) {
    assertArrayEquals(report, "workline next task list", nextTasks, [worklineConfig.onlyNextTask]);
  } else if (Number.isInteger(worklineConfig.expectedNextTaskCount)) {
    assertEqual(report, "workline next task count", nextTasks.length, worklineConfig.expectedNextTaskCount);
  }

  if (worklineConfig.nextController) {
    const longLivedRoleIds = Array.isArray(registry.longLivedRoles)
      ? registry.longLivedRoles.map((role) => role.id)
      : [];
    assertArrayIncludes(report, "workline long-lived roles", longLivedRoleIds, worklineConfig.nextController);
  }
}

function runContract() {
  const report = createReport();
  const config = loadConfig(report);
  if (!config) {
    printReport("Codex contract check", report);
    return;
  }

  for (const file of config.contractChecker.requiredFiles) {
    assertFileExists(report, file);
    if (file.endsWith(".json") && exists(file)) {
      tryReadJson(report, file);
    }
  }

  checkRequiredText(report, "AGENTS.md", config.contractChecker.agentsGuideRequiredText);
  checkRequiredText(report, "PROJECT_WINDOW.md", config.contractChecker.projectWindowRequiredText);
  checkRequiredText(report, "docs/prompts/next_agents.md", config.contractChecker.nextAgentsRequiredText);

  for (const expert of config.temporaryExperts || []) {
    assertFileExists(report, expert.file);
  }

  if (config.workspaceRoot) {
    const actualRoot = gitOneLine(["rev-parse", "--show-toplevel"]);
    if (actualRoot) {
      assertPathEqual(report, "workspace root", actualRoot, config.workspaceRoot);
    } else {
      report.fail("workspace root cannot be resolved with git rev-parse --show-toplevel");
    }
  }

  const maintenance = tryReadJson(report, "PROJECT_MAINTENANCE.json");
  const dispatch = tryReadJson(report, "ACTIVE_AGENT_DISPATCH.json");
  const architect = tryReadJson(report, "TOP_ARCHITECT_HANDOFF.json");

  if (maintenance) {
    assertEqual(
      report,
      "PROJECT_MAINTENANCE activeDispatch.status",
      getValue(maintenance, "activeDispatch.status"),
      config.contractChecker.expectedProjectState
    );
    assertEqual(
      report,
      "PROJECT_MAINTENANCE implementationGate.status",
      getValue(maintenance, "implementationGate.status"),
      config.contractChecker.expectedImplementationGateStatus
    );
    assertEqual(
      report,
      "PROJECT_MAINTENANCE agent0LatestBatch1Pause.status",
      getValue(maintenance, "agent0LatestBatch1Pause.status"),
      config.contractChecker.expectedProjectState
    );

    for (const [field, expected] of Object.entries(config.contractChecker.pausedBooleanFields)) {
      assertEqual(report, `PROJECT_MAINTENANCE agent0LatestBatch1Pause.${field}`, getValue(maintenance, `agent0LatestBatch1Pause.${field}`), expected);
    }
  }

  if (dispatch) {
    assertEqual(report, "ACTIVE_AGENT_DISPATCH status", dispatch.status, config.contractChecker.expectedProjectState);
    assertEqual(
      report,
      "ACTIVE_AGENT_DISPATCH agent0LatestBatch1Pause.status",
      getValue(dispatch, "agent0LatestBatch1Pause.status"),
      config.contractChecker.expectedProjectState
    );

    for (const [field, expected] of Object.entries(config.contractChecker.pausedBooleanFields)) {
      assertEqual(report, `ACTIVE_AGENT_DISPATCH agent0LatestBatch1Pause.${field}`, getValue(dispatch, `agent0LatestBatch1Pause.${field}`), expected);
    }
  }

  if (architect) {
    assertEqual(report, "TOP_ARCHITECT_HANDOFF status", architect.status, config.contractChecker.expectedTopArchitectStatus);
  }

  if (config.workline?.taskRegistry) {
    const registry = tryReadJson(report, config.workline.taskRegistry);
    if (registry) {
      assertEqual(report, "workline operatingModel", registry.operatingModel, config.workline.mode);
      assertEqual(report, "workline legacyAgentDocsMode", registry.legacyAgentDocsMode, config.workline.legacyAgentDocsMode);
      const longLivedRoles = Array.isArray(registry.longLivedRoles) ? registry.longLivedRoles : [];
      assertEqual(report, "workline long-lived role count", longLivedRoles.length, 1);
      assertEqual(report, "workline only long-lived role", longLivedRoles[0]?.id, config.workline.onlyLongLivedRole);

      checkTaskRegistryState(report, registry, config.workline);
    }
  }

  checkA01Completion(report, config);
  checkA05Completion(report, config);
  checkA06Completion(report, config);
  checkA07Completion(report, config);
  checkA08Completion(report, config);
  checkA09Completion(report, config);
  checkA10Completion(report, config);
  checkPackageScripts(report, config.contractChecker.packageScripts);
  checkGitignore(report, config.resourceManager.requiredGitignoreEntries);
  printReport("Codex contract check", report);
}

function walkFiles(relativeDir, excludedTopLevel) {
  const files = [];
  const absoluteDir = rootPath(relativeDir);
  if (!fs.existsSync(absoluteDir)) return files;

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = toPosix(path.join(relativeDir, entry.name));
    const topLevel = relativePath.split("/")[0];
    if (excludedTopLevel.has(topLevel)) continue;

    if (entry.isDirectory()) {
      files.push(...walkFiles(relativePath, excludedTopLevel));
    } else if (entry.isFile()) {
      const stats = fs.statSync(rootPath(relativePath));
      files.push({ path: relativePath, bytes: stats.size });
    }
  }

  return files;
}

function scanOnePath(relativePath) {
  const absolutePath = rootPath(relativePath);
  if (!fs.existsSync(absolutePath)) return { exists: false, files: 0, bytes: 0 };

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) return { exists: true, files: 1, bytes: stats.size };

  const files = walkFiles(relativePath, new Set([".git", "node_modules"]));
  return {
    exists: true,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0)
  };
}

function topLevelSummary(files) {
  const summary = new Map();
  for (const file of files) {
    const top = file.path.includes("/") ? file.path.split("/")[0] : "(root)";
    const current = summary.get(top) || { files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += file.bytes;
    summary.set(top, current);
  }
  return [...summary.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
}

function runResources() {
  const report = createReport();
  const config = loadConfig(report);
  if (!config) {
    printReport("Codex resource inventory", report);
    return;
  }

  const excluded = new Set(config.resourceManager.scanExcludeTopLevel);
  const files = walkFiles("", excluded);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  report.pass(`source scan covers ${files.length} files, ${humanBytes(totalBytes)} excluding protected/runtime roots`);

  for (const [top, data] of topLevelSummary(files).slice(0, 12)) {
    report.pass(`${top}: ${data.files} files, ${humanBytes(data.bytes)}`);
  }

  const largeFiles = files
    .filter((file) => file.bytes >= config.resourceManager.largeFileWarningBytes)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);

  if (largeFiles.length) {
    for (const file of largeFiles) {
      report.warn(`large source/evidence file ${file.path} is ${humanBytes(file.bytes)}`);
    }
  } else {
    report.pass("no scanned source file exceeds the large-file warning threshold");
  }

  for (const protectedPath of config.resourceManager.protectedPaths) {
    const data = scanOnePath(protectedPath);
    if (!data.exists) {
      report.warn(`protected path ${protectedPath} does not exist locally`);
    } else {
      report.pass(`protected path ${protectedPath}: ${data.files} files, ${humanBytes(data.bytes)}`);
    }
  }

  const tracked = gitLines(["ls-files", "--", ...config.resourceManager.protectedPaths]);
  if (tracked) {
    const allowed = new Set(config.resourceManager.allowedTrackedProtectedPaths);
    const unexpected = tracked.filter((file) => !allowed.has(toPosix(file)));
    if (unexpected.length) {
      for (const file of unexpected) report.fail(`protected path is tracked by Git: ${toPosix(file)}`);
    } else {
      report.pass("Git tracks no protected runtime files beyond explicit allowlist");
    }
  } else {
    report.warn("could not inspect Git tracked protected files");
  }

  checkGitignore(report, config.resourceManager.requiredGitignoreEntries);
  printReport("Codex resource inventory", report);
}

const command = process.argv[2] || "all";

if (command === "contract") {
  runContract();
} else if (command === "resources") {
  runResources();
} else if (command === "all") {
  runContract();
  runResources();
} else {
  console.error("Usage: node scripts/codex-governance.js [contract|resources|all]");
  process.exitCode = 1;
}
