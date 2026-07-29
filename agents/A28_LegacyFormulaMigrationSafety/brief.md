# A28 Legacy Formula Migration Safety Brief

## Role

Temporary legacy formula migration safety workbench.

Chinese role note:
`旧公式迁移安全：先备份和逐项验证，再只在隔离副本证明迁移、重定向与物理清理`.

## Mission

Implement the isolated proof portion of `REQ-20260728-004` after A00 accepts
S20. Build a backup-first, deterministic migration path from legacy formula
and derivation-node data to the accepted formula-card, immutable revision,
article-binding, and branching dependency model. Prove physical cleanup only
inside a disposable fixture. Do not touch current or production data, and do
not authorize the separately gated A35 cleanup apply.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-004.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S14_formula_reference_versioning_handoff.md`
- `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`
- `docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md`
- `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md`
- `migrations/014_formula_catalog.js`
- `migrations/015_article_formula_bindings.js`
- `migrations/016_formula_reference_decisions.js`
- `migrations/017_linear_derivation_graph.js`
- `migrations/021_branching_derivation_graph.js`
- `migrations/022_formula_revision_presentation_snapshot.js`
- `agents/A28_LegacyFormulaMigrationSafety/brief.md`

## Allowed Edits

- `migrations/023_legacy_formula_migration_support.js`
- `lib/legacy-formula-migration.js`
- `lib/content.js`
- `lib/validators.js`
- `server.js`
- `scripts/migrate-legacy-formulas.js`
- `scripts/test-legacy-formula-migration.js`
- `package.json`
- `docs/legacy-formula-migration.md`
- `docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md`

Do not edit `styles/20-content.css`; it is reserved and contains pre-existing
local work.

## Required Architecture

- Migration `023` may add mapping, backup-manifest, verification, redirect, and
  audit support. It must never delete legacy rows during normal startup.
- Keep the migration engine in `lib/legacy-formula-migration.js`; the CLI is a
  thin operator surface with dry-run as the default.
- Every source record receives a deterministic disposition: uniquely mapped,
  intentionally merged, or unresolved. Unresolved or ambiguous records block
  cleanup and remain in the report.
- Preserve source Markdown and mathematical meaning byte-for-byte where
  possible. Record normalized comparisons separately; never silently rewrite
  LaTeX to make verification pass.
- Preserve publication, visibility, immutable revision, article reference, and
  dependency semantics. Multiple legacy nodes may map to one card only when the
  report proves an explicit deterministic merge.
- Persist old-public-route to new-formula-slug mappings. Redirects must be
  permanent, bounded, loop-free, and expose no draft target.
- Backup manifest includes source database/files, size, SHA-256, row counts,
  schema/migration state, creation time, and restore instructions.

## Destructive Safety Contract

- S21 may physically delete legacy rows only in a newly created disposable
  fixture beneath the system temporary directory.
- The proof CLI must reject cleanup unless all are true: explicit disposable
  proof mode, backup exists, backup checksum matches, isolated restore passed,
  mapping/quantity/content/reference/relation/status verification passed,
  unresolved count is zero, and the exact report digest is supplied.
- Manufacture mismatch, missing mapping, ambiguous merge, checksum failure,
  redirect loop, and count drift fixtures. Every failure must leave all legacy
  rows intact.
- Current/production cleanup is not implemented or executed in S21. A35 remains
  blocked until A00 shows the exact affected-row report and receives fresh
  Owner confirmation.

## Verification

- Add and run `npm.cmd run test:legacy-formula-migration`.
- Run the CLI in default dry-run mode against a fresh disposable fixture.
- Restore the backup into a second isolated directory and compare integrity,
  schema, counts, source rows, mappings, formulas, Markdown, bindings,
  dependencies, publication state, and redirects.
- Prove successful disposable cleanup deletes only verified legacy rows while
  preserving formula cards, immutable revisions, bindings, mappings, audit
  report, and backup.
- Run formula catalog, article authoring, formula versioning, publication,
  branching graph, Markdown, API, and contract regressions.
- Perform isolated public redirect checks for status, destination, draft
  isolation, missing target, and loop rejection.

## Forbidden

- Current or production database/runtime data.
- Any numbered startup migration that deletes legacy rows.
- Current/production cleanup flags, cloud writes, deployment, restore,
  rollback, Git staging, commit, push, or branch/remote changes.
- Formula drawer, cover crop, reading time, inline math, media fit, dark theme,
  or unrelated refactors.
- `styles/20-content.css`.
- Deleting backups, mappings, audit reports, new formula revisions, article
  history, or unresolved legacy records.

## Handoff

Write
`docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md` in
Chinese with status, source inventory, backup manifest and checksum evidence,
mapping rules, unresolved report, restore rehearsal, before/after count and
content comparisons, redirect matrix, disposable cleanup proof, failure
fixtures, files, commands, risks, cleanup boundaries, and direct
`next_handoff` to `A00_ProjectDirector`.
