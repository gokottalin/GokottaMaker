# A05 Implementation Slice Planner Brief

## Role

Split the accepted product direction into small, verifiable implementation
slices. A05 is a planning Agent only: it does not implement product behavior.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/source_registry.json`
- `docs/codex-workline/resource_index.md`
- `PROJECT_MAINTENANCE.json`
- `ACTIVE_AGENT_DISPATCH.json`
- `TOP_ARCHITECT_HANDOFF.json`
- `agents/A04_RuntimeBaseline/handoff.md`

## Allowed Outputs

- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/A05_ImplementationSlicePlanner_handoff.md`
- `agents/A05_ImplementationSlicePlanner/brief.md` only when repairing or
  clarifying this task contract.

## Scope

- Convert the formula-variable derivation network and focused
  power-electronics mode into short task slices.
- Each slice must declare read files, allowed edit files, outputs,
  verification, dependencies, and stop conditions.
- Keep Batch1 closed unless the Owner and A00 explicitly open it in governance
  files.

## Done When

- `implementation_slices.json` is valid JSON and contains the future slices.
- The handoff records status, scope, changed files, decisions, risks, checks,
  and next handoff.
- `npm.cmd run codex:check` passes with zero failures.

## Forbidden

- Do not modify business code, UI, CMS/API behavior, database files,
  migrations, runtime data, deployment files, or Git state.
- Do not stage, commit, push, deploy, roll back, or run migrations.
