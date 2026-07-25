"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateJsonSchema } = require("./schema-validator");
const { evaluateBook, expressionRefs, unitInfo } = require("./evaluator");

const REQUIRED_COVERAGE = [
  "operating_states",
  "power_closure",
  "magnetics",
  "capacitors",
  "power_devices",
  "sensing",
  "gate_drive",
  "control",
  "tolerances",
  "thermal",
  "derating",
  "validation"
];

function loadJson(filename) {
  const raw = fs.readFileSync(filename, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) throw new Error(`${filename}: UTF-8 BOM is not allowed`);
  if (raw.includes("\ufffd") || raw.includes("???")) throw new Error(`${filename}: possible mojibake detected`);
  return JSON.parse(raw);
}

function uniqueIndex(items, label, errors) {
  const result = new Map();
  for (const item of items) {
    if (result.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
    result.set(item.id, item);
  }
  return result;
}

function sameSet(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((entry) => b.has(entry));
}

function validateTrace(owner, trace, indexes, errors) {
  if (!trace) return;
  const refs = trace.refs || [];
  if (trace.kind === "source" && (!refs.length || refs.some((ref) => !indexes.sources.has(ref)))) {
    errors.push(`${owner}: source trace must reference registered sources`);
  }
  if (trace.kind === "assumption" && (!refs.length || refs.some((ref) => !indexes.assumptions.has(ref)))) {
    errors.push(`${owner}: assumption trace must reference declared assumptions`);
  }
  if (trace.kind === "derivation" && (!refs.length || refs.some((ref) => !indexes.derivations.has(ref)))) {
    errors.push(`${owner}: derivation trace must reference declared derivations`);
  }
  if (trace.kind === "identity" && refs.length) errors.push(`${owner}: identity trace must not claim an external ref`);
  if (trace.kind === "unresolved" && refs.length) errors.push(`${owner}: unresolved trace must not claim a resolved ref`);
}

function validateBook(book, schema) {
  const errors = validateJsonSchema(book, schema);
  const warnings = [];
  const indexes = {
    sources: uniqueIndex(book.sources || [], "sources", errors),
    assumptions: uniqueIndex(book.assumptions || [], "assumptions", errors),
    inputs: uniqueIndex([...(book.inputs || []), ...(book.constants || [])], "inputs/constants", errors),
    equations: uniqueIndex(book.equations || [], "equations", errors),
    results: uniqueIndex(book.results || [], "results", errors),
    derivations: uniqueIndex(book.derivations || [], "derivations", errors),
    unresolved: uniqueIndex(book.unresolvedItems || [], "unresolvedItems", errors),
    validations: uniqueIndex(book.validations || [], "validations", errors)
  };

  if (book.bookKind === "instance" && !book.sources.length) errors.push("instance: at least one source is required");
  for (const source of book.sources || []) {
    if (!source.locator.trim()) errors.push(`${source.id}: precise source locator is required`);
  }

  const symbols = new Map();
  for (const input of [...(book.inputs || []), ...(book.constants || [])]) {
    if (symbols.has(input.symbol)) errors.push(`${input.id}: duplicate symbol ${input.symbol}`);
    symbols.set(input.symbol, input.id);
    try {
      unitInfo(input.unit);
    } catch (error) {
      errors.push(`${input.id}: ${error.message}`);
    }
    validateTrace(input.id, input.trace, indexes, errors);
    if (input.status === "unresolved") {
      if (input.value !== undefined) errors.push(`${input.id}: unresolved input must not contain a value`);
      if (input.trace?.kind !== "unresolved") errors.push(`${input.id}: unresolved input must use unresolved trace`);
      if (input.requiredForSignoff && !indexes.unresolved.has(input.id)) errors.push(`${input.id}: mandatory unresolved input must have a matching unresolvedItems id`);
    } else if (input.value === undefined) {
      errors.push(`${input.id}: resolved input requires a numeric value`);
    }
    if (["confirmed", "user_confirmed"].includes(input.status) && input.trace?.kind !== "source") {
      errors.push(`${input.id}: confirmed values require source trace`);
    }
    if (["assumption", "scenario"].includes(input.status) && input.trace?.kind !== "assumption") {
      errors.push(`${input.id}: assumptions and scenarios require assumption trace`);
    }
  }

  for (const equation of book.equations || []) {
    if (symbols.has(equation.symbol)) errors.push(`${equation.id}: duplicate symbol ${equation.symbol}`);
    symbols.set(equation.symbol, equation.id);
    try {
      unitInfo(equation.unit);
      unitInfo(equation.rounding.displayUnit);
    } catch (error) {
      errors.push(`${equation.id}: ${error.message}`);
    }
    const refs = expressionRefs(equation.expression);
    if (!sameSet(refs, equation.dependencies)) errors.push(`${equation.id}: dependencies must exactly match expression refs`);
    validateTrace(equation.id, equation.trace, indexes, errors);
    const mapping = equation.outputMappings?.larkix;
    if (mapping?.derivationSlug && ![...indexes.derivations.values()].some((item) => item.slug === mapping.derivationSlug)) {
      errors.push(`${equation.id}: Larkix derivation target ${mapping.derivationSlug} does not exist`);
    }
    if (mapping?.derivationSlug && !mapping.jumpLabel) errors.push(`${equation.id}: derivation jump requires a label`);
  }

  for (const result of book.results || []) {
    const equation = indexes.equations.get(result.equationId);
    if (!equation) errors.push(`${result.id}: equation ${result.equationId} does not exist`);
    else {
      if (result.symbol !== equation.symbol) errors.push(`${result.id}: symbol must match ${equation.id}`);
      if (result.unit !== equation.unit) errors.push(`${result.id}: unit must match ${equation.id}`);
      if (!sameSet(result.dependencies, equation.dependencies)) errors.push(`${result.id}: dependencies must match ${equation.id}`);
    }
  }

  const slugs = new Set([book.outputs?.larkix?.l1Slug]);
  for (const derivation of book.derivations || []) {
    if (slugs.has(derivation.slug)) errors.push(`${derivation.id}: duplicate Larkix slug ${derivation.slug}`);
    slugs.add(derivation.slug);
    if (!indexes.equations.has(derivation.parentFormulaId)) errors.push(`${derivation.id}: parent formula does not exist`);
    if (derivation.returnTarget !== book.outputs?.larkix?.l1Slug && ![...indexes.derivations.values()].some((item) => item.slug === derivation.returnTarget)) {
      errors.push(`${derivation.id}: return target does not exist`);
    }
    for (const assumptionId of derivation.assumptions) {
      if (!indexes.assumptions.has(assumptionId)) errors.push(`${derivation.id}: undeclared assumption ${assumptionId}`);
    }
    for (const step of derivation.steps) validateTrace(`${derivation.id}/${step.id}`, step.trace, indexes, errors);
  }

  const coverageCounts = new Map();
  for (const entry of book.coverage || []) {
    coverageCounts.set(entry.category, (coverageCounts.get(entry.category) || 0) + 1);
    for (const ref of entry.formulaRefs) if (!indexes.equations.has(ref)) errors.push(`coverage/${entry.category}: missing formula ${ref}`);
    for (const ref of entry.unresolvedRefs) if (!indexes.unresolved.has(ref)) errors.push(`coverage/${entry.category}: missing unresolved item ${ref}`);
    for (const ref of entry.validationRefs) if (!indexes.validations.has(ref)) errors.push(`coverage/${entry.category}: missing validation ${ref}`);
    if (entry.status === "not_applicable" && !entry.reason.trim()) errors.push(`coverage/${entry.category}: not_applicable requires a reason`);
  }
  for (const category of REQUIRED_COVERAGE) {
    if (coverageCounts.get(category) !== 1) errors.push(`coverage: ${category} must appear exactly once`);
  }

  const openMandatory = (book.unresolvedItems || []).filter((entry) => entry.mandatory && entry.status === "open");
  if (openMandatory.length) {
    if (book.design?.signoff?.status !== "blocked") errors.push("signoff must be blocked while mandatory unresolved items are open");
    const missingBlocks = openMandatory.filter((entry) => !book.design.signoff.blockedBy.includes(entry.id));
    if (missingBlocks.length) errors.push(`signoff.blockedBy misses: ${missingBlocks.map((entry) => entry.id).join(", ")}`);
  }

  let evaluation = null;
  if (book.bookKind === "instance" && !errors.length) {
    try {
      evaluation = evaluateBook(book);
      const evaluatedById = new Map(evaluation.equations.map((entry) => [entry.id, entry]));
      for (const result of book.results) {
        const actual = evaluatedById.get(result.equationId)?.value;
        const tolerance = Math.max(1e-12, Math.abs(result.expectedValue) * 1e-9);
        if (actual === undefined || Math.abs(actual - result.expectedValue) > tolerance) {
          errors.push(`${result.id}: expected ${result.expectedValue}, calculated ${actual}`);
        }
      }
    } catch (error) {
      errors.push(`evaluation: ${error.message}`);
    }
  }

  const sourceTraces = [...(book.inputs || []), ...(book.constants || [])].filter((entry) => entry.trace?.kind === "source").length;
  const assumptionTraces = [...(book.inputs || []), ...(book.constants || [])].filter((entry) => entry.trace?.kind === "assumption").length;
  const formulaTraceCount = (book.equations || []).filter((entry) => ["source", "derivation", "identity"].includes(entry.trace?.kind)).length;
  const sentinels = (book.results || []).filter((entry) => entry.sentinel);
  if (book.bookKind === "instance" && sentinels.length < 3) errors.push("at least three sentinel results are required");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    evaluation,
    summary: {
      sources: book.sources?.length || 0,
      sourceTracedValues: sourceTraces,
      assumptionTracedValues: assumptionTraces,
      formulas: book.equations?.length || 0,
      formulaTraces: formulaTraceCount,
      unresolvedMandatory: openMandatory.length,
      sentinels: sentinels.length,
      coverageCategories: coverageCounts.size
    }
  };
}

function validateBookFile(bookPath, schemaPath) {
  const resolvedBook = path.resolve(bookPath);
  const resolvedSchema = path.resolve(schemaPath);
  const book = loadJson(resolvedBook);
  const schema = loadJson(resolvedSchema);
  return { book, schema, report: validateBook(book, schema) };
}

module.exports = { REQUIRED_COVERAGE, loadJson, validateBook, validateBookFile };
