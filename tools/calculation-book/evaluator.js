"use strict";

const UNIT_DEFINITIONS = Object.freeze({
  "1": { scale: 1, dims: {} },
  "%": { scale: 0.01, dims: {} },
  V: { scale: 1, dims: { kg: 1, m: 2, s: -3, A: -1 } },
  A: { scale: 1, dims: { A: 1 } },
  W: { scale: 1, dims: { kg: 1, m: 2, s: -3 } },
  J: { scale: 1, dims: { kg: 1, m: 2, s: -2 } },
  H: { scale: 1, dims: { kg: 1, m: 2, s: -2, A: -2 } },
  Ω: { scale: 1, dims: { kg: 1, m: 2, s: -3, A: -2 } },
  F: { scale: 1, dims: { kg: -1, m: -2, s: 4, A: 2 } },
  Hz: { scale: 1, dims: { s: -1 } },
  s: { scale: 1, dims: { s: 1 } },
  m2: { scale: 1, dims: { m: 2 } },
  K: { scale: 1, dims: { K: 1 } },
  "K/W": { scale: 1, dims: { kg: -1, m: -2, s: 3, K: 1 } },
  T: { scale: 1, dims: { kg: 1, s: -2, A: -1 } },
  C: { scale: 1, dims: { A: 1, s: 1 } },
  kHz: { scale: 1e3, dims: { s: -1 } },
  "μH": { scale: 1e-6, dims: { kg: 1, m: 2, s: -2, A: -2 } },
  "μF": { scale: 1e-6, dims: { kg: -1, m: -2, s: 4, A: 2 } },
  "μs": { scale: 1e-6, dims: { s: 1 } },
  "μJ": { scale: 1e-6, dims: { kg: 1, m: 2, s: -2 } },
  nH: { scale: 1e-9, dims: { kg: 1, m: 2, s: -2, A: -2 } }
});

function cleanDims(dims) {
  const result = {};
  for (const [key, value] of Object.entries(dims || {})) {
    const normalized = Math.abs(value) < 1e-12 ? 0 : value;
    if (normalized) result[key] = normalized;
  }
  return result;
}

function combineDims(left, right, direction = 1) {
  const result = { ...(left || {}) };
  for (const [key, value] of Object.entries(right || {})) result[key] = (result[key] || 0) + direction * value;
  return cleanDims(result);
}

function scaleDims(dims, exponent) {
  return cleanDims(Object.fromEntries(Object.entries(dims || {}).map(([key, value]) => [key, value * exponent])));
}

function dimsEqual(left, right) {
  const a = cleanDims(left);
  const b = cleanDims(right);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => Math.abs((a[key] || 0) - (b[key] || 0)) < 1e-12);
}

function unitInfo(unit) {
  const info = UNIT_DEFINITIONS[unit];
  if (!info) throw new Error(`Unsupported unit: ${unit}`);
  return info;
}

function evaluateAst(node, symbols) {
  if (!node || typeof node !== "object") throw new Error("Expression node must be an object");
  const args = node.args || [];
  if (node.op === "literal") {
    const unit = node.unit || "1";
    const info = unitInfo(unit);
    return { value: Number(node.value) * info.scale, dims: { ...info.dims }, refs: [] };
  }
  if (node.op === "ref") {
    const resolved = symbols.get(node.symbol);
    if (!resolved) throw new Error(`Undefined symbol: ${node.symbol}`);
    return { value: resolved.value, dims: { ...resolved.dims }, refs: [node.symbol] };
  }

  const evaluated = args.map((entry) => evaluateAst(entry, symbols));
  const refs = [...new Set(evaluated.flatMap((entry) => entry.refs))];
  if (node.op === "negate") {
    if (evaluated.length !== 1) throw new Error("negate requires one argument");
    return { value: -evaluated[0].value, dims: evaluated[0].dims, refs };
  }
  if (node.op === "sqrt") {
    if (evaluated.length !== 1 || evaluated[0].value < 0) throw new Error("sqrt requires one non-negative argument");
    return { value: Math.sqrt(evaluated[0].value), dims: scaleDims(evaluated[0].dims, 0.5), refs };
  }
  if (node.op === "power") {
    if (evaluated.length !== 2 || Object.keys(evaluated[1].dims).length) throw new Error("power requires a dimensionless exponent");
    return { value: evaluated[0].value ** evaluated[1].value, dims: scaleDims(evaluated[0].dims, evaluated[1].value), refs };
  }
  if (["add", "subtract", "min", "max"].includes(node.op)) {
    if (evaluated.length < 2) throw new Error(`${node.op} requires at least two arguments`);
    if (!evaluated.every((entry) => dimsEqual(entry.dims, evaluated[0].dims))) throw new Error(`${node.op} arguments must have identical dimensions`);
    let value;
    if (node.op === "add") value = evaluated.reduce((sum, entry) => sum + entry.value, 0);
    if (node.op === "subtract") value = evaluated.slice(1).reduce((current, entry) => current - entry.value, evaluated[0].value);
    if (node.op === "min") value = Math.min(...evaluated.map((entry) => entry.value));
    if (node.op === "max") value = Math.max(...evaluated.map((entry) => entry.value));
    return { value, dims: evaluated[0].dims, refs };
  }
  if (node.op === "multiply") {
    if (!evaluated.length) throw new Error("multiply requires arguments");
    return {
      value: evaluated.reduce((product, entry) => product * entry.value, 1),
      dims: evaluated.reduce((dims, entry) => combineDims(dims, entry.dims), {}),
      refs
    };
  }
  if (node.op === "divide") {
    if (evaluated.length !== 2 || evaluated[1].value === 0) throw new Error("divide requires two arguments and a non-zero divisor");
    return { value: evaluated[0].value / evaluated[1].value, dims: combineDims(evaluated[0].dims, evaluated[1].dims, -1), refs };
  }
  throw new Error(`Unsupported operator: ${node.op}`);
}

function expressionRefs(node, output = []) {
  if (node?.op === "ref") output.push(node.symbol);
  for (const child of node?.args || []) expressionRefs(child, output);
  return [...new Set(output)];
}

function roundForDisplay(valueSi, rounding) {
  const unit = rounding?.displayUnit || "1";
  const scaled = valueSi / unitInfo(unit).scale;
  const digits = Number(rounding?.digits ?? 4);
  if (rounding?.mode === "significant_figures") return Number(scaled.toPrecision(digits));
  return Number(scaled.toFixed(digits));
}

function formatDisplay(valueSi, rounding) {
  const rounded = roundForDisplay(valueSi, rounding);
  return `${rounded} ${rounding.displayUnit === "1" ? "" : rounding.displayUnit}`.trim();
}

function evaluateBook(book) {
  const symbols = new Map();
  for (const entry of [...book.inputs, ...book.constants]) {
    if (entry.status === "unresolved" || entry.value === undefined) continue;
    const info = unitInfo(entry.unit);
    symbols.set(entry.symbol, { value: entry.value * info.scale, dims: { ...info.dims }, source: entry.id });
  }

  const pending = new Map(book.equations.map((equation) => [equation.id, equation]));
  const evaluatedEquations = [];
  let progressed = true;
  while (pending.size && progressed) {
    progressed = false;
    for (const [id, equation] of [...pending]) {
      const refs = expressionRefs(equation.expression);
      if (!refs.every((symbol) => symbols.has(symbol))) continue;
      const evaluated = evaluateAst(equation.expression, symbols);
      const declaredDims = unitInfo(equation.unit).dims;
      if (!dimsEqual(evaluated.dims, declaredDims)) {
        throw new Error(`${equation.id}: calculated dimensions do not match declared unit ${equation.unit}`);
      }
      const item = { ...equation, value: evaluated.value, displayValue: roundForDisplay(evaluated.value, equation.rounding), refs };
      symbols.set(equation.symbol, { value: evaluated.value, dims: evaluated.dims, source: equation.id });
      evaluatedEquations.push(item);
      pending.delete(id);
      progressed = true;
    }
  }
  if (pending.size) throw new Error(`Unresolved or cyclic equations: ${[...pending.keys()].join(", ")}`);

  return { symbols, equations: evaluatedEquations };
}

module.exports = {
  UNIT_DEFINITIONS,
  combineDims,
  dimsEqual,
  evaluateAst,
  evaluateBook,
  expressionRefs,
  formatDisplay,
  roundForDisplay,
  unitInfo
};
