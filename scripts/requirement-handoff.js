"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "larkix.requirement-brief.v1";
const PROTOCOL = "larkix.requirement-handoff.v1";
const CONFIRMED_STATUSES = new Set(["user_confirmed", "dispatched"]);
const ALL_STATUSES = new Set([
  "draft",
  "questioning",
  "awaiting_user_confirmation",
  "user_confirmed",
  "dispatched",
  "superseded",
  "cancelled",
]);
const DIGEST_KEYS = [
  "schemaVersion",
  "requirementId",
  "title",
  "priority",
  "intent",
  "scope",
  "behavior",
  "acceptanceCriteria",
  "constraints",
  "evidence",
  "openQuestions",
  "assumptions",
  "risks",
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function digestRequirement(requirement) {
  const payload = {};
  for (const key of DIGEST_KEYS) {
    payload[key] = requirement[key];
  }
  const hash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `sha256:${hash}`;
}

function requireObject(value, label, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object`);
    return false;
  }
  return true;
}

function requireArray(value, label, failures, minItems = 0) {
  if (!Array.isArray(value)) {
    failures.push(`${label} must be an array`);
    return false;
  }
  if (value.length < minItems) {
    failures.push(`${label} must contain at least ${minItems} item(s)`);
  }
  return true;
}

function validateRequirement(requirement) {
  const failures = [];
  if (!requireObject(requirement, "requirement", failures)) {
    return failures;
  }

  if (requirement.schemaVersion !== SCHEMA_VERSION) {
    failures.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!/^REQ-\d{8}-\d{3}$/.test(requirement.requirementId || "")) {
    failures.push("requirementId must match REQ-YYYYMMDD-NNN");
  }
  if (typeof requirement.title !== "string" || !requirement.title.trim()) {
    failures.push("title must be a non-empty string");
  }
  if (!ALL_STATUSES.has(requirement.status)) {
    failures.push("status is not supported");
  }

  requireObject(requirement.intent, "intent", failures);
  requireObject(requirement.scope, "scope", failures);
  requireObject(requirement.behavior, "behavior", failures);
  requireObject(requirement.constraints, "constraints", failures);
  requireArray(requirement.acceptanceCriteria, "acceptanceCriteria", failures, 1);
  requireArray(requirement.evidence, "evidence", failures);
  requireArray(requirement.openQuestions, "openQuestions", failures);
  requireArray(requirement.assumptions, "assumptions", failures);
  requireArray(requirement.risks, "risks", failures);
  requireObject(requirement.confirmation, "confirmation", failures);
  requireObject(requirement.dispatch, "dispatch", failures);

  if (requirement.dispatch?.targetRole !== "A00_ProjectDirector") {
    failures.push("dispatch.targetRole must be A00_ProjectDirector");
  }

  if (CONFIRMED_STATUSES.has(requirement.status)) {
    if (requirement.confirmation?.confirmed !== true) {
      failures.push("confirmation.confirmed must be true");
    }
    for (const key of ["confirmedBy", "confirmedAt", "confirmationText", "digest"]) {
      if (typeof requirement.confirmation?.[key] !== "string" || !requirement.confirmation[key].trim()) {
        failures.push(`confirmation.${key} must be a non-empty string`);
      }
    }
    const unresolved = (requirement.openQuestions || []).filter(
      (question) => question?.status === "open",
    );
    if (unresolved.length > 0) {
      failures.push("confirmed requirements cannot contain open questions");
    }
    const expectedDigest = digestRequirement(requirement);
    if (requirement.confirmation?.digest !== expectedDigest) {
      failures.push(`confirmation.digest mismatch; expected ${expectedDigest}`);
    }
  }

  if (requirement.status === "dispatched" && !requirement.dispatch?.dispatchedAt) {
    failures.push("dispatch.dispatchedAt is required for dispatched status");
  }

  return failures;
}

function machineEnvelope(requirement, filePath) {
  return {
    protocol: PROTOCOL,
    event: "requirement.user_confirmed",
    requirementId: requirement.requirementId,
    briefPath: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
    digest: requirement.confirmation.digest,
    target: "A00_ProjectDirector",
  };
}

function loadRequirement(fileArgument) {
  if (!fileArgument) {
    throw new Error("A requirement package path is required.");
  }
  const filePath = path.resolve(process.cwd(), fileArgument);
  return {
    filePath,
    requirement: JSON.parse(fs.readFileSync(filePath, "utf8")),
  };
}

function assertValid(requirement) {
  const failures = validateRequirement(requirement);
  if (failures.length > 0) {
    throw new Error(failures.map((failure) => `- ${failure}`).join("\n"));
  }
}

function makeSelfTestRequirement() {
  const requirement = {
    schemaVersion: SCHEMA_VERSION,
    requirementId: "REQ-20260726-001",
    title: "Self-test requirement",
    status: "user_confirmed",
    priority: "normal",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    intent: {
      problem: "A protocol needs executable gate coverage.",
      desiredOutcome: "Reject changed or unconfirmed requirement packages.",
      targetUsers: ["Owner"],
    },
    scope: { in: ["Gate validation"], out: ["Business implementation"] },
    behavior: {
      current: [],
      expected: ["Emit only a confirmed package."],
      edgeCases: ["A confirmed field changes after approval."],
    },
    acceptanceCriteria: [
      {
        id: "ac.emit",
        statement: "Confirmed packages emit a compact envelope.",
        verification: "Run selftest.",
      },
    ],
    constraints: {
      languages: ["zh-CN"],
      platforms: [],
      compatibility: [],
      data: [],
      security: [],
      operations: [],
      deadline: null,
    },
    evidence: [],
    openQuestions: [],
    assumptions: [],
    risks: [],
    confirmation: {
      confirmed: true,
      confirmedBy: "Owner",
      confirmedAt: "2026-07-26T00:00:00.000Z",
      confirmationText: "确认该需求包",
      digest: null,
    },
    dispatch: {
      targetRole: "A00_ProjectDirector",
      recommendedWorkbenches: [],
      dependencies: [],
      dispatchedAt: null,
    },
  };
  requirement.confirmation.digest = digestRequirement(requirement);
  return requirement;
}

function runSelfTest() {
  const requirement = makeSelfTestRequirement();
  assertValid(requirement);

  requirement.intent.desiredOutcome = "Changed after confirmation.";
  const failures = validateRequirement(requirement);
  if (!failures.some((failure) => failure.startsWith("confirmation.digest mismatch"))) {
    throw new Error("selftest expected digest mismatch after a substantive change");
  }

  console.log("Requirement handoff self-test: PASS");
}

function main() {
  const [command, fileArgument] = process.argv.slice(2);

  if (command === "selftest") {
    runSelfTest();
    return;
  }

  const { filePath, requirement } = loadRequirement(fileArgument);
  if (command === "digest") {
    console.log(digestRequirement(requirement));
    return;
  }
  if (command === "validate") {
    assertValid(requirement);
    console.log(`Requirement package valid: ${requirement.requirementId}`);
    return;
  }
  if (command === "emit") {
    assertValid(requirement);
    if (!CONFIRMED_STATUSES.has(requirement.status)) {
      throw new Error("emit requires status user_confirmed or dispatched");
    }
    console.log(JSON.stringify(machineEnvelope(requirement, filePath)));
    return;
  }

  throw new Error(
    "Usage: requirement-handoff.js <digest|validate|emit|selftest> [package.json]",
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
