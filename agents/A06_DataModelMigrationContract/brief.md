# A06 DataModelMigrationContract Brief

## Role

Define the data-model and migration contract for the formula-variable
derivation knowledge network. A06 is a contract-design Agent only.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/S00_batch1_open_dispatch_handoff.md`
- `PROJECT_MAINTENANCE.json`
- `ACTIVE_AGENT_DISPATCH.json`
- `TOP_ARCHITECT_HANDOFF.json`
- `server.js`
- `lib/db.js`
- `lib/content.js`
- `lib/validators.js`
- `migrations/`

## Allowed Outputs

- `docs/codex-workline/slices/S01_data_model_migration_contract.md`
- `docs/codex-workline/slices/S01_data_model_migration_contract_handoff.md`

## Scope

- Define the proposed `knowledge_nodes`, `knowledge_links`, revision/audit, and
  focus-mode data contracts.
- Define migration safety boundaries, rollback assumptions, and isolated
  DATA_DIR test requirements.
- Name downstream needs for API, CMS, Markdown/DOCX, QA, release, and Git
  gates.

## Forbidden

- Do not create or edit migration files.
- Do not edit `server.js`, `lib/db.js`, `lib/content.js`, or validators.
- Do not modify business code, database files, runtime data, uploads, release
  scripts, or Git state.
- Do not run migrations, deploy, stage, commit, or push.

## Done When

- The contract file names every table/field/index/status concept needed for
  V0.
- The contract file declares read files, future edit files, outputs,
  verification, rollback expectations, and stop conditions for S02.
- The handoff includes status, scope, files changed, decisions, risks,
  tests/checks, and next handoff.
- `npm.cmd run codex:contract` passes with zero failures.
