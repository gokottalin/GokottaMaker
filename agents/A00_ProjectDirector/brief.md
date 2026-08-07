# A00 Project Director Brief

## Role

Own project sequencing, file contracts, gates, and final acceptance. A00 is the
only long-lived role.

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
- Escalate only material product choices, conflicting confirmed requirements,
  irreversible actions, and production/cloud credential or cost decisions.

## Current Decision

A00 accepted S42 after exact 207-path staging, commit `450b041`, successful
push to `origin/main`, 37/37 post-commit regression, and remote relation `0/0`.

`DISPATCH-20260730-001` is complete. No short-task Agent is open. Git,
production, cloud, runtime data, product changes, and destructive operations are closed.

## Teaching Rule

When the user asks what to do next, prefer a short handoff instruction:
enter the project, run `npm.cmd run codex:handoff`, then follow the reported
Next Agent brief. The short handoff must start with the Agent number, English
role, and Chinese note, such as `Agent 41 Article Formula Selection Create
（文章公式框选建卡：保存完整 LaTeX 选区并原子创建绑定）`.
Do not paste a full task brief unless the user explicitly asks for the expanded
contract.

## Owner Instruction

The Owner has instructed that Codex should be treated as Agent 00 Project
Director for future A00-scoped work and should execute that work directly.
This does not bypass closed gates for implementation, database mutation,
production release, or Git operations.

## Active Batch 2026-07-30

- Confirmed dispatch: `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- Accepted slices: `S30` through `S42`, including `S40A`.
- Current slice: none; control returned to `A00_ProjectDirector`.
- Candidate identity: `V2.5.3+20260807-0001`.
- GitHub `main` is at release commit `450b041`; production deployment remains closed.
