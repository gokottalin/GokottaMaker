# LarkixMaker Codex Guide

This repository is the LarkixMaker site: a Node.js HTTP service, SQLite-backed
content system, CMS, static visitor pages, miniapps, visual assets, deployment
scripts, and Agent governance documents.

Active project root: `E:/Project/2607-LarkixWeb`.

## Startup

Before changing files, read the current governance state in this order:

1. `PROJECT_WINDOW.md`
2. `docs/PROJECT_CHARTER.md`
3. `docs/codex-workline/task_registry.json`
4. `PROJECT_MAINTENANCE.json`
5. `ACTIVE_AGENT_DISPATCH.json`
6. `TOP_ARCHITECT_HANDOFF.json`
7. `docs/Agent0+总控与集成/AGENT_UPDATE_INDEX.json`
8. The latest Agent or task handoff referenced by those files

Then run:

```powershell
npm.cmd run codex:contract
```

Treat the checker output as the live project gate. At the time this guide was
added, Batch1 was paused by Owner and business implementation was closed.

## Operating Model

The old `docs/Agent*` folders are historical evidence, not active departments.
Do not revive the pyramid model where permanent backend/frontend/CMS/visual
Agents hand work down to sub-Agents.

Use the current workline instead:

- `A00_ProjectDirector` is the only long-lived role. It chooses the next small
  task, file contract, and acceptance check.
- All other Agents are temporary workbenches. Each one has a short read list,
  a narrow allowed edit list, explicit output files, and a handoff.
- `PROJECT_WINDOW.md` is the short top-level window for new sessions. Keep it
  pointer-only.
- The active task registry lives at `docs/codex-workline/task_registry.json`.
- Human-readable Agent briefs live at `agents/<agent_id>/brief.md`.
- Project-scoped Codex tool configuration lives at `.codex/agents/`.

## A00 Direct Execution Rule

When the current request is within `A00_ProjectDirector` scope, Codex should act
as Agent 00 and execute the project-director work directly. This includes
sequence decisions, gate checks, task acceptance, handoff repair, prompt
updates, and governance pointer maintenance.

This rule does not open business implementation, database mutation, production
release, deployment, Git staging, commit, or push. Those scopes still require
explicit Owner/A00 governance opening in the project files.

## Agent Protocol

Every task Agent must read:

1. `AGENTS.md`
2. `PROJECT_WINDOW.md`
3. `docs/PROJECT_CHARTER.md`
4. `docs/codex-workline/task_registry.json`
5. The task-specific brief under `agents/<agent_id>/brief.md`

Every task handoff must include:

- `status`
- `scope_completed`
- `files_created_or_changed`
- `decisions`
- `risks`
- `tests_or_checks`
- `next_handoff`

Recommended handoff and coordination language: Chinese. Use English only when
an existing file contract, command output, or third-party API term requires it.

For fresh handoff sessions, the user should not need to paste a long task
brief. Prefer the short prompt "enter the project and run
`npm.cmd run codex:handoff`"; the next Agent must then read the reported brief
and current project window.
The short prompt must begin with the current Agent number, English role, and a
concise Chinese role note, for example
`Agent 00 Project Director（项目导演：负责顺序、门禁和下一步裁决）`.

## Encoding Rules

- New and edited text files should be UTF-8 without BOM unless an existing file
  clearly uses another encoding and the task is only making a local edit.
- Agent briefs, handoffs, governance Markdown, JSON, TOML, JavaScript, HTML,
  CSS, and source files should remain readable as UTF-8 in future Codex
  sessions.
- Chinese is allowed in human-facing handoffs, governance notes, site content,
  and UI copy, but verify it does not become mojibake or `???`.
- Prefer ASCII for code identifiers, JSON keys, TOML keys, command names,
  slugs, and machine-readable IDs unless an existing contract explicitly
  requires Chinese text.
- Do not bulk-convert historical Agent files only to normalize encoding unless
  the current task explicitly opens an encoding repair scope.
- When checking files in PowerShell, prefer explicit UTF-8 reads such as
  `Get-Content -Encoding UTF8 -Raw`. Avoid shell writes that may emit UTF-16,
  ANSI, or UTF-8 with BOM.
- After changing governance or Agent files, run `npm.cmd run codex:contract`.

## Hard Rules

- Do not run `git add .`; staging requires an explicit path list and Owner or
  Agent0 approval.
- Do not stage, commit, push, deploy, roll back, mutate production data, or run
  migrations unless the current governance files explicitly open that scope.
- Keep `.env`, `database/`, `runtime-data/`, `uploads/`, `.codex-logs/`, logs,
  screenshots, and temporary evidence out of Git unless a dedicated audit says
  otherwise.
- Do not overwrite central Agent0 control files unless the task is explicitly
  Agent0 governance maintenance.
- Keep changes small and local. Prefer adding focused helpers over expanding
  `server.js` or `admin/admin.js` without a batch plan.

## Commands

```powershell
npm.cmd run codex:handoff
npm.cmd run codex:contract
npm.cmd run codex:resources
npm.cmd run check:version
npm.cmd run test:markdown
node --experimental-sqlite server.js
```

`codex:handoff` prints the current short handoff and next Agent brief path.
`codex:contract` checks the current Agent gate and required project files.
`codex:resources` inventories source assets and protected runtime resources.

## Codex Structure

- `.codex/config.toml` keeps project-scoped Codex agent settings.
- `.codex/agents/` defines project-scoped A00+ short-task agents for the new
  director + short-task workline.
- `.codex/larkix-governance.json` is the machine-readable source used by
  `scripts/codex-governance.js`.
- `docs/codex-workline/` is the active non-pyramid planning line.
- `docs/prompts/` contains copy-paste launch prompts for fresh Agent sessions.
- `agents/` contains the human-readable brief and handoff for each short task
  Agent.

Use subagents only when the user explicitly asks for parallel or delegated
work. Keep default work in the main thread.
