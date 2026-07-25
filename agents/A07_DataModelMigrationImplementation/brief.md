# A07 DataModelMigrationImplementation Brief

## Role

Implement the accepted S01 data-model contract as additive SQLite migration
files. A07 is a narrow migration implementation Agent.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S01_data_model_migration_contract.md`
- `docs/codex-workline/slices/S01_data_model_migration_contract_handoff.md`
- `PROJECT_MAINTENANCE.json`
- `ACTIVE_AGENT_DISPATCH.json`
- `TOP_ARCHITECT_HANDOFF.json`
- `lib/db.js`
- `migrations/`

## Allowed Outputs

- `migrations/011_knowledge_nodes.js`
- `migrations/012_knowledge_links.js`
- `migrations/013_public_focus_mode_default.js`
- `docs/codex-workline/slices/S02_data_model_migration_implementation_handoff.md`

## Scope

- Create additive migrations matching the S01 contract.
- Keep `public_focus_mode.enabled` false by default.
- Use isolated `DATA_DIR` verification only, such as `.verify-api-data`.
- Record exact commands, resulting migration rows, integrity check result, and
  protected-path status in the handoff.

## Forbidden

- Do not edit `server.js`, CMS files, visitor frontend files, Markdown/DOCX
  renderer files, release scripts, deployment scripts, or Git state.
- Do not mutate current `database/`, `runtime-data/`, `uploads/`, `.env`, or
  `.codex-logs/`.
- Do not run production or current-data migrations.
- Do not stage, commit, push, deploy, or roll back.
- Stop and return to A00 if the migration cannot be implemented without
  editing source integration code beyond the three migration files.

## Done When

- The three migration files are present, additive, and match S01 table, field,
  index, status, and default-setting contracts.
- The isolated `DATA_DIR` smoke proves the new migrations run without touching
  protected runtime data.
- Existing version and Markdown regressions still pass.
- `npm.cmd run codex:contract` passes with zero failures.
- The S02 handoff records status, scope, files changed, decisions, risks,
  checks, and the next handoff back to A00.
