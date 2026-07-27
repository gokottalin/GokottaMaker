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

## Automatic Handoff Continuation Rule

Handoffs are continuous by default. After an Agent completes its brief, writes
the required handoff, and passes the declared checks, Codex must continue in
the same task without waiting for the Owner to type "continue", "继续", or paste
the next launch prompt.

The continuation loop is:

1. Resolve the task to the matching functional Agent in the active registry and
   dispatch the brief directly to that Agent in the same task. Do not leave the
   handoff as text for the Owner to forward.
2. If no matching functional Agent or brief exists, immediately act as
   `A00_ProjectDirector`, create one narrow temporary workbench with an allowed
   file list and acceptance checks, register it, and dispatch the task to it.
   A missing Agent is not a stop condition.
3. If the completed Agent returns to `A00_ProjectDirector`, immediately act as
   A00 in the same task and perform acceptance, gate checks, registry updates,
   and next-task routing.
4. Run `npm.cmd run codex:handoff` after the routing state is updated.
5. Read the reported Next Agent brief and dispatch it directly to the named
   functional Agent.
6. Repeat the handoff, A00 acceptance, routing, dispatch, and execution cycle one Agent at
   a time until the active queue is complete or a stop condition is reached.

Do not ask the Owner to relay handoff text between Agents, start a new chat, or
send a routine continuation message. Do not stop merely because the named Agent
does not yet exist; A00 must create the missing temporary Agent and continue.
Provide concise Chinese progress updates at Agent boundaries while continuing
the work.

Automatic continuation does not bypass gates or expand authority. Stop and
report the exact blocker when:

- the next gate is closed and the current governance state does not authorize
  A00 to open it;
- the next step needs a material Owner decision, requirement confirmation,
  credential, external approval, or new scope;
- the next step would perform production/current-data mutation, cloud writes,
  deployment, destructive rollback, or Git staging/commit/push without the
  explicit authorization required by the active governance files;
- a required check fails and cannot be repaired safely within the active
  Agent's file and scope contract.

Context-window limits are not a stop condition. Preserve the current handoff
and continue from the active governance pointers in the next automatic turn.

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

## Requirement Confirmation Gate

`A18_RequirementClarifier` is an on-demand requirement-intake workbench, not a
second manager and not an implementation Agent. It interviews the Owner in
Chinese, records one requirement per structured package, and sends only a
compact machine-readable pointer to `A00_ProjectDirector`.

- Ask one to three high-impact questions per round and distinguish confirmed
  facts, assumptions, and unresolved questions.
- Do not invent product decisions merely to close the interview.
- Do not dispatch a requirement until the Owner explicitly confirms the final
  requirement summary.
- Any material change after confirmation invalidates the old digest and returns
  the package to `awaiting_user_confirmation`.
- Only `A00_ProjectDirector` may turn a confirmed requirement into sequence,
  file boundaries, acceptance gates, and implementation Agent assignments.
- Internal requirement IDs, interview notes, confirmation records, and handoff
  metadata must not appear in visitor-facing content.

The package contract is `schemas/requirement-brief.schema.json`. The operating
protocol is `docs/codex-workline/requirements/README.md`. Use
`npm.cmd run codex:requirement -- emit <package.json>` to produce the compact
handoff envelope after confirmation.

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
