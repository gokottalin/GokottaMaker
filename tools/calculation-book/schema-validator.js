"use strict";

function typeMatches(value, expected) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "integer") return Number.isInteger(value);
  return typeof value === expected;
}

function pointerResolve(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`Only local schema refs are supported: ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .reduce((node, token) => node?.[token.replaceAll("~1", "/").replaceAll("~0", "~")], root);
}

function validateJsonSchema(instance, schema) {
  const errors = [];

  function walk(value, rule, instancePath) {
    if (!rule || typeof rule !== "object") return;
    if (rule.$ref) {
      const target = pointerResolve(schema, rule.$ref);
      if (!target) errors.push(`${instancePath}: unresolved schema ref ${rule.$ref}`);
      else walk(value, target, instancePath);
      return;
    }

    if (rule.const !== undefined && value !== rule.const) {
      errors.push(`${instancePath}: expected constant ${JSON.stringify(rule.const)}`);
    }
    if (Array.isArray(rule.enum) && !rule.enum.some((entry) => entry === value)) {
      errors.push(`${instancePath}: expected one of ${rule.enum.map((entry) => JSON.stringify(entry)).join(", ")}`);
    }

    const expectedTypes = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : [];
    if (expectedTypes.length && !expectedTypes.some((type) => typeMatches(value, type))) {
      errors.push(`${instancePath}: expected type ${expectedTypes.join("|")}`);
      return;
    }

    if (typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${instancePath}: string is shorter than ${rule.minLength}`);
      if (rule.maxLength !== undefined && value.length > rule.maxLength) errors.push(`${instancePath}: string is longer than ${rule.maxLength}`);
      if (rule.pattern && !new RegExp(rule.pattern, "u").test(value)) errors.push(`${instancePath}: does not match ${rule.pattern}`);
    }

    if (Array.isArray(value)) {
      if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${instancePath}: expected at least ${rule.minItems} items`);
      if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${instancePath}: expected at most ${rule.maxItems} items`);
      if (rule.uniqueItems) {
        const encoded = value.map((entry) => JSON.stringify(entry));
        if (new Set(encoded).size !== encoded.length) errors.push(`${instancePath}: items must be unique`);
      }
      if (rule.items) value.forEach((entry, index) => walk(entry, rule.items, `${instancePath}/${index}`));
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const key of rule.required || []) {
        if (!Object.hasOwn(value, key)) errors.push(`${instancePath}/${key}: required property is missing`);
      }
      for (const [key, child] of Object.entries(value)) {
        if (rule.properties?.[key]) walk(child, rule.properties[key], `${instancePath}/${key}`);
        else if (rule.additionalProperties === false) errors.push(`${instancePath}/${key}: additional property is not allowed`);
        else if (rule.additionalProperties && typeof rule.additionalProperties === "object") walk(child, rule.additionalProperties, `${instancePath}/${key}`);
      }
    }

    for (const alternativesKey of ["allOf", "anyOf", "oneOf"]) {
      if (!Array.isArray(rule[alternativesKey])) continue;
      if (alternativesKey === "allOf") {
        rule.allOf.forEach((entry) => walk(value, entry, instancePath));
        continue;
      }
      const matches = rule[alternativesKey].filter((entry) => {
        const before = errors.length;
        walk(value, entry, instancePath);
        const matched = errors.length === before;
        errors.splice(before);
        return matched;
      }).length;
      if ((alternativesKey === "anyOf" && matches === 0) || (alternativesKey === "oneOf" && matches !== 1)) {
        errors.push(`${instancePath}: ${alternativesKey} did not match`);
      }
    }
  }

  walk(instance, schema, "$");
  return errors;
}

module.exports = { validateJsonSchema };
