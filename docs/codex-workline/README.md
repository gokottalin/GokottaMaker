# LarkixMaker Codex Workline

This folder is the new non-pyramid planning line for LarkixMaker.

The old `docs/Agent*` folders are historical evidence and source material. They
are no longer treated as permanent departments. Future work should use one
project director plus short task agents with narrow, verifiable outputs.

## Operating Model

Long-lived role:

- `A00_ProjectDirector`: chooses the next task, keeps file boundaries small,
  checks gates, and defines acceptance criteria. It does not implement feature
  code.

Short task agents:

- Each task agent is a temporary workbench, not a department.
- Each task reads a short file list, may edit only its declared output files,
  and stops after writing a handoff.
- A task is complete only when its declared verification command or artifact
  exists.

## Current Gate

Business implementation remains closed while Batch1 is paused by Owner. This
workline can plan, index, validate, and inventory. It must not open Batch1,
write migrations, change CMS/API/frontend behavior, deploy, stage, commit, or
push.

## Files

- `task_registry.json`: active task sequence and file contracts.
- `A00_ProjectDirector_handoff.md`: current director handoff.
- `A01_ProjectStateRetriever_work_order.md`: completed A01 work order.
- `A01_ProjectStateRetriever_handoff.md`: completed A01 handoff.
- `A02_ContractValidator_handoff.md`: completed A02 handoff.
- Root `PROJECT_WINDOW.md`: pointer file for new Codex sessions.
- `docs/prompts/next_agents.md`: copy-paste prompt for the next Agent.
- `agents/<agent_id>/brief.md`: human-readable brief for a new task Agent.

Future task outputs should stay in this folder unless a task explicitly opens a
smaller file path.
