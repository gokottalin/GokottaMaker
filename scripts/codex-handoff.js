const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function rootPath(relativePath) {
  return path.join(root, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(rootPath(relativePath), "utf8").replace(/^\uFEFF/, "");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function displayPath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function displayWindowsPath(value) {
  return value.replace(/\//g, "\\");
}

function splitWords(value) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeInitialisms(value) {
  const initialisms = new Map([
    ["api", "API"],
    ["cms", "CMS"],
    ["docx", "DOCX"],
    ["qa", "QA"],
    ["seo", "SEO"],
    ["ui", "UI"]
  ]);
  return value
    .split(" ")
    .map((word) => initialisms.get(word.toLowerCase()) || word)
    .join(" ");
}

function formatAgentTitle(agentId) {
  const match = agentId.match(/^A(\d+[a-z]?)[_-]?(.*)$/i);
  if (!match) return agentId;

  const number = match[1];
  const role = normalizeInitialisms(splitWords(match[2] || ""));
  return `Agent ${number}${role ? ` ${role}` : ""}`;
}

function unwrapValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function projectWindowValue(text, label) {
  const prefix = `- ${label}:`;
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((item) => item.startsWith(prefix));
  if (index < 0) return "";

  const parts = [lines[index].slice(prefix.length).trim()];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim() || /^[-#]/.test(line.trimStart())) break;
    if (!/^\s+/.test(line)) break;
    parts.push(line.trim());
  }
  return unwrapValue(parts.filter(Boolean).join(" "));
}

function listItems(label, values) {
  console.log(label);
  if (!values || values.length === 0) {
    console.log("- none");
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

function findLongLivedRole(registry, roleId) {
  const roles = Array.isArray(registry.longLivedRoles) ? registry.longLivedRoles : [];
  return roles.find((role) => role.id === roleId) || null;
}

function findNextEntries(governance, registry) {
  const taskAgents = Array.isArray(registry.taskAgents) ? registry.taskAgents : [];
  const nextTasks = taskAgents.filter((task) => task.status === "next");

  if (nextTasks.length > 0) {
    return {
      kind: nextTasks.length === 1 ? "task" : "parallel tasks",
      entries: nextTasks
    };
  }

  const controllerId = governance.workline?.nextController;
  if (!controllerId) {
    throw new Error("Expected at least one next task or a workline.nextController.");
  }

  const controller = findLongLivedRole(registry, controllerId);
  if (!controller) {
    throw new Error(`workline.nextController ${controllerId} is not declared in longLivedRoles.`);
  }

  return { kind: "controller", entries: [controller] };
}

function agentRoleNote(governance, agentId) {
  return governance.workline?.agentRoleNotes?.[agentId] || "";
}

function taskForbidden(entry) {
  try {
    const workline = readJson("docs/codex-workline/implementation_slices.json");
    const slice = (workline.slices || []).find((item) => item.agent === entry.id);
    if (Array.isArray(slice?.forbidden) && slice.forbidden.length > 0) {
      return slice.forbidden;
    }
  } catch {
    // The task registry remains sufficient when implementation slices are absent.
  }

  return [
    "files outside the declared allowed outputs",
    "current or production data mutation",
    "cloud writes, deployment, or Git staging/commit/push"
  ];
}

function shortPrompt(governance, entry, promptRoot) {
  const title = formatAgentTitle(entry.id);
  const note = agentRoleNote(governance, entry.id);
  const noteText = note ? `（${note}）` : "";
  const briefText = entry.brief ? `，然后执行 ${displayWindowsPath(entry.brief)}` : "";
  return `${title}${noteText}：请进入 ${promptRoot}，运行 npm.cmd run codex:handoff 核验路由${briefText}；使用中文交接，遵守 AGENTS.md 门禁；完成后直接回传 A00，不等待用户转发或发送“继续”。`;
}

function printEntryDetails(entry, index, total) {
  const suffix = total > 1 ? ` ${index + 1}` : "";
  console.log(`Next Agent${suffix}: ${entry.id}`);
  console.log(`Next Agent brief${suffix}: ${entry.brief || "not declared"}`);
  console.log(`Expected handoff${suffix}: ${entry.handoff || entry.activeHandoff || "not declared"}`);
  console.log(`Scope${suffix}: ${entry.scope || entry.purpose || "not declared"}`);
  console.log("");
  listItems(`Read first${suffix}:`, entry.reads);
  console.log("");
  listItems(`Allowed outputs${suffix}:`, entry.mayEdit);
  console.log("");
  listItems(`Done when${suffix}:`, entry.doneWhen);
  console.log("");
  listItems(`Forbidden${suffix}:`, taskForbidden(entry));
}

function main() {
  try {
    const governance = readJson(".codex/larkix-governance.json");
    const registry = readJson(governance.workline.taskRegistry);
    const projectWindow = readText("PROJECT_WINDOW.md");
    const { kind, entries } = findNextEntries(governance, registry);
    const primaryEntry = entries[0];

    const workspaceRoot = governance.workspaceRoot || displayPath(root);
    const currentPhase = projectWindowValue(projectWindow, "Current phase") || primaryEntry.id;
    const lastHandoff = projectWindowValue(projectWindow, "Last accepted handoff") || "none";
    const gate = projectWindowValue(projectWindow, "Current gate") || "see PROJECT_WINDOW.md";
    const promptRoot = displayWindowsPath(workspaceRoot);

    console.log("LarkixMaker handoff");
    console.log("===================");
    console.log("");
    console.log(entries.length === 1
      ? "Short prompt for a fresh Codex session:"
      : "Short prompts for parallel Codex sessions:");
    for (const entry of entries) {
      console.log(shortPrompt(governance, entry, promptRoot));
    }
    console.log("");
    console.log(`Project root: ${workspaceRoot}`);
    console.log(`Current phase: ${currentPhase}`);
    console.log(`Next ${kind}: ${entries.map((entry) => entry.id).join(", ")}`);
    console.log(`Last accepted handoff: ${lastHandoff}`);
    console.log(`Gate: ${gate}`);
    console.log("");
    entries.forEach((entry, index) => printEntryDetails(entry, index, entries.length));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
