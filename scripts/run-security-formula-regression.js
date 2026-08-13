"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd"] : [];
const timeoutMs = 15 * 60 * 1000;

function redact(value) {
  return String(value || "")
    .replace(/(PRIVATE_CMS_PATH\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/("?(?:csrfToken|password|token|cookie|authorization)"?\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

const checks = [
  ["test:public-surface", "公开表面最小化"],
  ["test:private-cms-gateway", "私有 CMS 网关"],
  ["test:formula-binding-authority", "公式绑定权威"],
  ["test:formula-relationship-projection", "公式关系投影"],
  ["test:article-formula-authoring", "文章公式创作"],
  ["test:formula-reference-versioning", "公式引用版本"],
  ["test:formula-publication", "公式发布生命周期"],
  ["test:linear-derivation-graph", "线性推导图"],
  ["test:branching-derivation-graph", "分支推导图与 DAG"],
  ["test:legacy-formula-migration", "旧公式迁移"],
  ["test:formula-binding-marker", "公式绑定角标"],
  ["test:formula-marker-graph-ui", "公式角标与图谱 UI"],
  ["test:formula-map-flow-layout", "公式图谱桌面与移动布局"],
  ["test:markdown", "Markdown 渲染"],
  ["codex:contract", "项目契约"],
];

function run(script, label) {
  const startedAt = Date.now();
  const result = spawnSync(command, [...prefix, "run", script], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1" },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
  });
  const passed = !result.error && result.status === 0;
  return {
    script,
    label,
    passed,
    durationMs: Date.now() - startedAt,
    exitCode: result.status,
    output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
  };
}

console.log(`S50 security/formula regression: ${checks.length} checks`);
const results = [];
for (const [script, label] of checks) {
  const result = run(script, label);
  results.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${script} (${result.durationMs} ms) - ${label}`);
  if (!result.passed && result.output) console.error(redact(result.output).slice(0, 12000));
}

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
console.log(`S50 summary: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
