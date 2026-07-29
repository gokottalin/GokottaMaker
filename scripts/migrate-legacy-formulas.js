"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createDatabase } = require("../lib/db");
const {
  applyDisposableMigration,
  assertDisposableFixture,
  cleanupDisposableLegacyRows,
  dryRunMigration,
  stableStringify
} = require("../lib/legacy-formula-migration");

function parseArgs(argv) {
  const options = {
    mode: "dry-run",
    fixtureDir: "",
    dbPath: "",
    mappingPath: "",
    reportPath: "",
    reportDigest: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") options.mode = "apply";
    else if (token === "--cleanup") options.mode = "cleanup";
    else if (token === "--fixture") options.fixtureDir = argv[++index] || "";
    else if (token === "--db") options.dbPath = argv[++index] || "";
    else if (token === "--mapping") options.mappingPath = argv[++index] || "";
    else if (token === "--report") options.reportPath = argv[++index] || "";
    else if (token === "--report-digest") options.reportDigest = argv[++index] || "";
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!options.fixtureDir) {
    throw new Error("--fixture is required; current and production data modes are intentionally unavailable");
  }
  options.fixtureDir = path.resolve(options.fixtureDir);
  options.dbPath = path.resolve(
    options.dbPath || path.join(options.fixtureDir, "database", "legacy-formula-fixture.sqlite")
  );
  assertDisposableFixture(options.fixtureDir, options.dbPath);
  if (options.mode === "cleanup" && !options.reportDigest) {
    throw new Error("--cleanup requires --report-digest from a cleanup-eligible apply report");
  }
  return options;
}

function readMappingRules(mappingPath) {
  if (!mappingPath) return {};
  const parsed = JSON.parse(fs.readFileSync(path.resolve(mappingPath), "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("mapping rules must be a JSON object keyed by legacy node id or slug");
  }
  return parsed;
}

function writeReport(report, options) {
  const reportsDir = path.join(options.fixtureDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outputPath = path.resolve(
    options.reportPath ||
      path.join(reportsDir, `${options.mode}-${report.reportDigest.slice("sha256:".length, 23)}.json`)
  );
  const relative = path.relative(options.fixtureDir, outputPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("report output must stay inside the disposable fixture");
  }
  fs.writeFileSync(outputPath, `${stableStringify(report, 2)}\n`, "utf8");
  return outputPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const dbDir = path.dirname(options.dbPath);
  const uploadDir = path.join(options.fixtureDir, "uploads");
  const db = createDatabase({
    root: path.resolve(__dirname, ".."),
    dataDir: options.fixtureDir,
    dbDir,
    dbPath: options.dbPath,
    uploadDir
  });
  try {
    let report;
    if (options.mode === "cleanup") {
      report = cleanupDisposableLegacyRows({
        db,
        dbPath: options.dbPath,
        fixtureDir: options.fixtureDir,
        reportDigest: options.reportDigest
      });
    } else {
      const mappingRules = readMappingRules(options.mappingPath);
      report =
        options.mode === "apply"
          ? applyDisposableMigration({
              db,
              dbPath: options.dbPath,
              fixtureDir: options.fixtureDir,
              mappingRules
            })
          : dryRunMigration({
              db,
              dbPath: options.dbPath,
              fixtureDir: options.fixtureDir,
              mappingRules
            });
    }
    const reportPath = writeReport(report, options);
    process.stdout.write(
      `${stableStringify(
        {
          mode: options.mode,
          reportDigest: report.reportDigest,
          reportPath,
          unresolvedCount:
            report.plan?.unresolvedCount ?? report.verification?.unresolvedCount ?? null,
          cleanupEligible: report.verification?.cleanupEligible === true,
          cleanupCompleted: report.verification?.cleanupCompleted === true
        },
        2
      )}\n`
    );
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`Legacy formula migration blocked: ${error.message}`);
  process.exitCode = 1;
}
