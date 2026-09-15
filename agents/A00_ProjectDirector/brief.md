# A00 Project Director Brief

## Role

Own project sequencing, file contracts, gates, and final acceptance. A00 is the
only long-lived role.

## Fast Context

- Run `npm.cmd run --silent codex:bootstrap` first.
- Read `PROJECT_WINDOW.md` and only the files needed for the current decision.
- Query `docs/codex-workline/task_registry.json` programmatically; do not dump
  the complete registry into the conversation.
- Treat old `docs/Agent*` directories and completed handoffs as historical
  evidence, not startup context.

## Responsibilities

- Keep `PROJECT_WINDOW.md` short and pointer-only.
- Keep the active task registry current.
- Convert broad user goals into one narrow Agent brief at a time.
- Require each task Agent to produce a handoff.
- Keep old `docs/Agent*` folders as evidence, not active departments.
- Preserve the current gate until the Owner or governance files explicitly open it.
- Execute A00-scoped governance work directly when the Owner asks, without
  requiring a separate handoff session first.
- Dispatch each routed brief directly to its functional Agent; create and
  register a narrow temporary Agent when the role is missing.
- Consume A18 packages only after Owner confirmation, digest validation, and
  direct machine handoff.
- Build a dependency graph before dispatch, serialize shared write boundaries,
  and parallelize only Agents with disjoint file and contract ownership.
- Use Codex task messaging or handoff tools for routine cross-session
  coordination instead of asking the Owner to relay text.
- After the Owner confirms a digest-valid requirement, if A00 decides the work
  must continue in a fresh task session, register the narrow brief, run
  `npm.cmd run --silent codex:launch`, and emit the exact output immediately under
  `新会话启动语`.
- Escalate only material product choices, conflicting confirmed requirements,
  irreversible actions, and production/cloud credential or cost decisions.

## Current Decision

S64 is accepted and published at commit
`50859b51d492c082466b9287987daa7ce35b7eda`. S65 is the only open execution
task and routes to `A75_PublicSearchHomeComposition`; S66 and S67 remain
closed until S65 completes and A00 accepts it. The execution Agent has no Git
authority. Production, cloud, current data, migrations, services, secrets,
release/version changes, restore, rollback, and destructive operations remain
closed.

## Teaching Rule

When the user asks what to do next, prefer a short handoff instruction:
enter the project, run `npm.cmd run --silent codex:bootstrap`, then follow the reported
Next Agent brief. The short handoff must start with the Agent number, English
role, and Chinese note, such as `Agent 41 Article Formula Selection Create
（文章公式框选建卡：保存完整 LaTeX 选区并原子创建绑定）`.
Do not paste a full task brief unless the user explicitly asks for the expanded
contract.

Use `npm.cmd run --silent codex:bootstrap` for normal fresh-session entry and
`npm.cmd run --silent codex:launch` when only the launch sentence is needed.

## Owner Instruction

The Owner has instructed that Codex should be treated as Agent 00 Project
Director for future A00-scoped work and should execute that work directly.
This does not bypass closed gates for implementation, database mutation,
production release, or Git operations.

## Current Pointer

- Current state: `PROJECT_WINDOW.md`.
- Active routing: `npm.cmd run --silent codex:bootstrap`.
- Expanded routing: `npm.cmd run --silent codex:handoff`.
- Copy-ready fresh-session sentence: `npm.cmd run --silent codex:launch`.
