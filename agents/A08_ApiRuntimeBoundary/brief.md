# A08 ApiRuntimeBoundary Brief

## Role

Implement the public and admin API/runtime boundary for derivation knowledge
nodes on top of the accepted S02 migrations. A08 is a narrow API slice.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S01_data_model_migration_contract.md`
- `docs/codex-workline/slices/S02_data_model_migration_implementation_handoff.md`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `lib/uploads.js`
- `scripts/verify-api.ps1`

## Allowed Outputs

- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `lib/uploads.js`
- `scripts/verify-api.ps1`
- `docs/codex-workline/slices/S03_api_runtime_boundary_handoff.md`

## Scope

- Add public list/detail API behavior for `knowledge_nodes`.
- Add admin CRUD, soft-delete/restore, revision, and restore API behavior.
- Use canonical `publishStatus` and `visibilityStatus` response fields.
- Validate slug, cover, color token, node type, publish completeness, and
  public filtering.
- Keep save/revision/link sync/audit behavior transaction-safe.
- Use isolated `DATA_DIR` verification by default.

## Forbidden

- Do not edit CMS UI, visitor frontend pages, Markdown/DOCX rendering, SEO,
  deployment scripts, production data, or Git state.
- Do not run migrations against current or production data.
- Do not stage, commit, push, deploy, or roll back.
- Stop and return to A00 if this work requires changing public UI, CMS UI, or
  Markdown/DOCX behavior in the same slice.

## Done When

- Public API hides draft, archived, private, and soft-deleted node content.
- Admin API can save, publish, soft-delete, restore, and inspect revisions
  without leaking secrets in audit metadata.
- Link sync handles raw Markdown derive shortcodes according to the S01
  contract or records exact deferred behavior if Markdown parser work must wait
  for S04.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
  passes with isolated data.
- `npm.cmd run check:version`, `npm.cmd run test:markdown`, and
  `npm.cmd run codex:contract` pass.
- The S03 handoff records status, scope, files changed, decisions, risks,
  checks, and next handoff back to A00.
