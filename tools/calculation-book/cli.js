#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateBookFile } = require("./validator");
const { writeLarkixPackage } = require("./larkix-generator");
const { validateMathcad, writeMathcad } = require("./mathcad-generator");
const { validateConsistency } = require("./consistency");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_BOOK = path.join(ROOT, "content/calculation-books/ccm-flyback-reference/calculation-book.json");
const DEFAULT_SCHEMA = path.join(ROOT, "schemas/calculation-book-master.schema.json");

function optionsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function publicValidationReport(book, semantic, mathcad, larkix, consistency, paths) {
  return {
    schemaVersion: "larkix.calculation-book-validation.v1",
    bookId: book.bookId,
    revision: book.revision,
    status: semantic.ok && mathcad.ok && larkix.ok && consistency.ok ? "pass" : "fail",
    paths,
    sourceCoverage: {
      registeredSources: semantic.summary.sources,
      sourceTracedValues: semantic.summary.sourceTracedValues,
      assumptionTracedValues: semantic.summary.assumptionTracedValues,
      formulas: semantic.summary.formulas,
      formulaTraces: semantic.summary.formulaTraces,
      missingTracePaths: semantic.errors.filter((entry) => /trace|source|assumption|derivation/.test(entry)),
      unresolvedMandatory: semantic.summary.unresolvedMandatory
    },
    dependencyAndUnits: {
      acyclic: !semantic.errors.some((entry) => /cyclic/.test(entry)),
      definedSymbols: !semantic.errors.some((entry) => /Undefined symbol|dependencies/.test(entry)),
      unitClosure: !semantic.errors.some((entry) => /unit|dimension/.test(entry))
    },
    derivationLevels: {
      L1: book.equations.length,
      L2: book.derivations.filter((entry) => entry.level === "L2_engineering_derivation").map((entry) => entry.slug),
      L3: book.derivations.filter((entry) => entry.level === "L3_foundation_derivation").map((entry) => entry.slug)
    },
    mathcad,
    larkix,
    consistency,
    canonicalPublication: book.publication.canonical,
    previewPolicy: book.publication.previewOverride,
    signoff: book.design.signoff
  };
}

function main() {
  const [command = "validate", ...args] = process.argv.slice(2);
  const options = optionsFrom(args);
  const bookPath = path.resolve(options.book || DEFAULT_BOOK);
  const schemaPath = path.resolve(options.schema || DEFAULT_SCHEMA);
  const validated = validateBookFile(bookPath, schemaPath);
  if (!validated.report.ok) {
    console.error(JSON.stringify({ ok: false, errors: validated.report.errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (command === "validate") {
    console.log(JSON.stringify({ ok: true, summary: validated.report.summary }, null, 2));
    return;
  }
  if (command !== "generate") throw new Error(`Unknown command: ${command}`);

  const bookDir = path.dirname(bookPath);
  const larkix = writeLarkixPackage(validated.book, validated.report.evaluation, bookDir);
  if (!larkix.validation.ok) throw new Error(`Larkix validation failed: ${larkix.validation.errors.join("; ")}`);
  const mathcadPath = path.resolve(options.mathcad || path.join("E:/User", validated.book.outputs.mathcad.filename));
  writeMathcad(validated.book, validated.report.evaluation, mathcadPath, options.template || validated.book.outputs.mathcad.template);
  const mathcadValidation = validateMathcad(validated.book, mathcadPath);
  if (!mathcadValidation.ok) throw new Error(`Mathcad validation failed: ${mathcadValidation.errors.join("; ")}`);
  const consistency = validateConsistency(validated.book, validated.report.evaluation, mathcadValidation, larkix.package);
  if (!consistency.ok) throw new Error(`Consistency validation failed: ${consistency.errors.join("; ")}`);

  const generatedReportPath = path.join(bookDir, "generated/validation-report.json");
  const validationFilename = `${path.parse(validated.book.outputs.mathcad.filename).name}_validation.json`;
  const externalReportPath = path.resolve(options.validation || path.join("E:/User", validationFilename));
  const report = publicValidationReport(
    validated.book,
    validated.report,
    mathcadValidation,
    larkix.validation,
    consistency,
    {
      master: path.relative(ROOT, bookPath).replaceAll("\\", "/"),
      mathcad: mathcadPath,
      larkixPackage: path.relative(ROOT, larkix.outputPath).replaceAll("\\", "/")
    }
  );
  fs.mkdirSync(path.dirname(generatedReportPath), { recursive: true });
  fs.mkdirSync(path.dirname(externalReportPath), { recursive: true });
  const encoded = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(generatedReportPath, encoded, "utf8");
  fs.writeFileSync(externalReportPath, encoded, "utf8");
  console.log(JSON.stringify({ ok: true, master: bookPath, mathcad: mathcadPath, larkix: larkix.outputPath, validation: externalReportPath, sentinels: consistency.sentinelCount }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
