# Project Charter

## Objective

Keep LarkixMaker as a compact, maintainable technical content website with a
local Node.js and SQLite runtime, CMS tools, visitor pages, miniapps, visual
assets, and release governance.

The immediate objective is not feature expansion. The current objective is to
stabilize the migrated project at `E:/Project/2607-LarkixWeb` so later work can
be assigned as small, verifiable tasks.

## Current Promise

The project should always be able to answer:

- What is the active gate?
- Which Agent is next?
- Which files may that Agent read?
- Which files may that Agent edit?
- What output proves completion?
- Which command verifies the result?

## AI-First Design Path

1. Keep a short top-level project window.
2. Keep durable rules in `AGENTS.md`.
3. Keep executable governance in `.codex/larkix-governance.json` and
   `scripts/codex-governance.js`.
4. Keep one-Agent-at-a-time briefs under `agents/<agent_id>/brief.md`.
5. Require every task Agent to write a handoff.
6. Open business implementation only after the Owner or active governance files
   explicitly open the gate.

## Non-Goals For The Current Phase

- No CMS/API/frontend feature implementation.
- No database migration or runtime data mutation.
- No production release, rollback, staging, commit, or push.
- No revival of the old pyramid Agent department model.
- No cleanup by deletion before resource classification.

## Current MVP For Governance

The governance layer is acceptable when a new session can read:

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- the next Agent brief under `agents/`

Then it can complete one narrow task and verify it with the declared command.
