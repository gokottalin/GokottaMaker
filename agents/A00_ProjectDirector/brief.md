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

## Current Decision

`A17_ReleaseGitGate` has been accepted after all 191 live status paths were
classified with no gap or overlap: 84 future explicit include, 107
review-required, and zero live protected-path hits. The automatic functional
Agent queue is complete. Local technical evidence passes, future staging is
conditional on new authorization and live revalidation, and production release
is not ready. Source changes, staging, commit, push, current/production data,
cloud, deployment, restore, and rollback remain closed.

## Teaching Rule

When the user asks what to do next, prefer a short handoff instruction:
enter the project, run `npm.cmd run codex:handoff`, then follow the reported
Next Agent brief. The short handoff must start with the Agent number, English
role, and Chinese note, such as `Agent 23 Carousel Focus Buffer（轮播聚焦缓冲：自动下架越界轮播项，保留原信息，并由作者手动恢复）`.
Do not paste a full task brief unless the user explicitly asks for the expanded
contract.

## Owner Instruction

The Owner has instructed that Codex should be treated as Agent 00 Project
Director for future A00-scoped work and should execute that work directly.
This does not bypass closed gates for implementation, database mutation,
production release, or Git operations.
