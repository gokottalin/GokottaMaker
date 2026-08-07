"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createDatabase } = require("../lib/db");
const {
  applyDisposableRelationMigration,
  dryRunRelationMigration
} = require("../lib/legacy-formula-relation-migration");
const {
  assertDisposableFixture,
  stableStringify
} = require("../lib/legacy-formula-migration");

function parseArgs(argv) {
  const options = { mode: "dry-run", fixtureDir: "", dbPath: "", reportPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") options.mode = "apply";
    else if (token === "--fixture") options.fixtureDir = argv[++index] || "";
    else if (token === "--db") options.dbPath = argv[++index] || "";
    else if (token === "--report") options.reportPath = argv[++index] || "";
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!options.fixtureDir) {
    throw new Error("--fixture is required; current and production data modes are unavailable");
  }
  options.fixtureDir = path.resolve(options.fixtureDir);
  options.dbPath = path.resolve(
    options.dbPath || path.join(options.fixtureDir, "database", "formula-relation-fixture.sqlite")
  );
  assertDisposableFixture(options.fixtureDir, options.dbPath);
  return options;
}

function writeReport(report, options) {
  const reportsDir = path.join(options.fixtureDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outputPath = path.resolve(
    options.reportPath ||
      path.join(
        reportsDir,
        `formula-relations-${options.mode}-${report.reportDigest.slice("sha256:".length, 23)}.json`
      )
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
  const db = createDatabase({
    root: path.resolve(__dirname, ".."),
    dataDir: options.fixtureDir,
    dbDir,
    dbPath: options.dbPath,
    uploadDir: path.join(options.fixtureDir, "uploads")
  });
  try {
    const report =
      options.mode === "apply"
        ? applyDisposableRelationMigration({
            db,
            dbPath: options.dbPath,
            fixtureDir: options.fixtureDir
          })
        : dryRunRelationMigration({
            db,
            dbPath: options.dbPath,
            fixtureDir: options.fixtureDir
          });
    const reportPath = writeReport(report, options);
    process.stdout.write(
      `${stableStringify(
        {
          mode: options.mode,
          reportDigest: report.reportDigest,
          reportPath,
          relationCount: report.plan.relations.length,
          repairCount: report.plan.repairs.length,
          insertedRelationCount: report.verification?.insertedRelationCount ?? 0,
          queuedRepairCount: report.verification?.queuedRepairCount ?? 0,
          zeroDeletion: report.verification?.zeroDeletion === true
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
  console.error(`Legacy formula relation migration blocked: ${error.message}`);
  process.exitCode = 1;
}
