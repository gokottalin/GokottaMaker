const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "codex-handoff.js");

function run(...args) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8"
  }).replace(/\r\n/g, "\n");
}

const compact = run("--compact");
assert.match(compact, /Short prompt for a fresh Codex session:/);
assert.match(compact, /npm\.cmd run --silent codex:bootstrap/);
assert.match(compact, /Next Agent brief:/);
assert.match(compact, /Read policy: PROJECT_WINDOW\.md -> Next Agent brief -> brief Read First only\./);
assert.doesNotMatch(compact, /Done when:/);
assert.doesNotMatch(compact, /Allowed outputs:/);

const launch = run("--launch-only").trim();
assert.match(launch, /^Agent \d+/);
assert.match(launch, /npm\.cmd run --silent codex:bootstrap/);
assert.doesNotMatch(launch, /LarkixMaker handoff/);
assert.equal(launch.split("\n").length, 1);

const expanded = run();
assert.match(expanded, /Done when:/);
assert.match(expanded, /Allowed outputs:/);

console.log("Codex handoff modes: PASS");
