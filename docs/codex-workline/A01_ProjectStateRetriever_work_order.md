# A01 ProjectStateRetriever Work Order

You are a short task agent, not a permanent project department.

## Read

Read only the minimum set first:

1. `AGENTS.md`
2. `PROJECT_MAINTENANCE.json`
3. `ACTIVE_AGENT_DISPATCH.json`
4. `TOP_ARCHITECT_HANDOFF.json`
5. `docs/Agent0+总控与集成/AGENT_UPDATE_INDEX.json`
6. `docs/codex-workline/task_registry.json`

Then sample old `docs/Agent*` files only when needed to identify source value.

## Do

Create:

- `docs/codex-workline/source_registry.json`
- `docs/codex-workline/resource_index.md`
- `docs/codex-workline/A01_ProjectStateRetriever_handoff.md`

The registry should classify sources as:

- `authoritative_gate`
- `historical_agent_evidence`
- `runtime_source`
- `protected_runtime_data`
- `visual_or_evidence_asset`
- `external_reference`

## Do Not

- Do not change business code.
- Do not create or run migrations.
- Do not deploy.
- Do not stage, commit, or push.
- Do not promote old Agent folders back into departments.

## Done When

- `source_registry.json` is valid JSON.
- `resource_index.md` lists the protected runtime paths and the top cleanup
  candidates.
- `handoff.md` names one next task and its verification command.
- `npm.cmd run codex:check` passes with zero failures.
