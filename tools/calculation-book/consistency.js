"use strict";

function validateConsistency(book, evaluation, mathcadReport, larkixPackage) {
  const errors = [];
  const evaluated = new Map(evaluation.equations.map((entry) => [entry.id, entry]));
  const larkix = new Map(larkixPackage.calculations.map((entry) => [entry.equationId, entry]));
  const comparisons = [];

  for (const sentinel of book.results.filter((entry) => entry.sentinel)) {
    const jsonEquation = evaluated.get(sentinel.equationId);
    const mathcadValue = mathcadReport.formulaResults[sentinel.equationId];
    const larkixValue = larkix.get(sentinel.equationId)?.valueSi;
    const jsonValue = jsonEquation?.value;
    const tolerance = Math.max(1e-12, Math.abs(jsonValue || 0) * 1e-12);
    const mathcadDifference = Number.isFinite(mathcadValue) ? Math.abs(jsonValue - mathcadValue) : null;
    const larkixDifference = Number.isFinite(larkixValue) ? Math.abs(jsonValue - larkixValue) : null;
    const status = mathcadDifference !== null && larkixDifference !== null && mathcadDifference <= tolerance && larkixDifference <= tolerance ? "pass" : "fail";
    if (status === "fail") errors.push(`${sentinel.equationId}: cross-output mismatch`);
    comparisons.push({
      resultId: sentinel.id,
      equationId: sentinel.equationId,
      symbol: sentinel.symbol,
      unit: sentinel.unit,
      jsonValueSi: jsonValue,
      mathcadValueSi: mathcadValue,
      larkixValueSi: larkixValue,
      larkixDisplay: larkix.get(sentinel.equationId)?.displayValue,
      tolerance,
      mathcadDifference,
      larkixDifference,
      status
    });
  }
  if (comparisons.length < 3) errors.push("fewer than three sentinel comparisons");
  return { ok: errors.length === 0, errors, sentinelCount: comparisons.length, comparisons };
}

module.exports = { validateConsistency };
