# A42 DerivationWorkflowRecovery Brief

## Role

Temporary short-task workbench.

Chinese role note:
`推导关系恢复：无环图、旧关系迁移和待修复队列`

## Mission

Restore the complete formula authoring-to-public derivation workflow and migrate unambiguous legacy relations on isolated copies while queuing unresolved evidence.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-008.json`
- `docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md`
- `docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md`
- `migrations/021_branching_derivation_graph.js`
- `migrations/023_legacy_formula_migration_support.js`
- `lib/legacy-formula-migration.js`
- `scripts/migrate-legacy-formulas.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`

## Allowed Edits

- `migrations/027_formula_relation_repairs.js`
- `lib/legacy-formula-relation-migration.js`
- `scripts/migrate-legacy-formula-relations.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `post.js`
- `scripts/test-branching-derivation-graph.js`
- `scripts/test-legacy-formula-migration.js`
- `scripts/test-legacy-formula-relation-migration.js`
- `docs/legacy-formula-relation-recovery.md`
- `docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md`

You are the only active writer for this list while S36_derivation_workflow_recovery is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- one source-to-dependency DAG contract with existence, duplicate, self, dangling, and cycle validation
- published-revision-only public traversal with draft and archived boundaries
- idempotent isolated migration of stable IDs, existing shortcodes, and relation records
- append-only unresolved repair queue without guessed targets or legacy deletion

## Verification

- multi-parent, multi-child, merge, deep-cycle, draft, archived, and dangling graph fixtures
- isolated backup, checksum, count, direction, path, binding, idempotency, and zero-deletion evidence
- CMS repair queue and public step-by-step navigation checks
- formula publication, binding, migration, API, and contract regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S35_article_formula_selection_create`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- editing old migrations or immutable legacy mapping evidence
- guessing ambiguous targets, mutating current/production data, or invoking physical cleanup
- moving published pointers outside validated reverse-topological order

## Handoff

Write `docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
