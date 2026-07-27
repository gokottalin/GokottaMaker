# A14 Formula Catalog Management Brief

## Role

Temporary formula catalog foundation and CMS management workbench.

Chinese role note: `公式库基础：建立唯一公式卡、分类标签、搜索分页、修订归档与本地备份`.

Use Chinese for the handoff and administrator-facing copy. Keep IDs, slugs,
enum values, tag keys, filenames, and machine-readable fields in ASCII.

## Objective

Implement the formula-catalog foundation required by `REQ-20260726-003` while
preserving the previously accepted stable-identity, revision, archive, export,
and local-backup requirements. This slice creates the data/API/CMS foundation;
article-editor insertion belongs to A19 and derivation-chain relations belong
to A21.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260726-003.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`
- `docs/codex-workline/slices/S07_cms_formula_authoring_examples_handoff.md`
- `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`
- `docs/calculation-book-authoring-guide.md`
- `schemas/calculation-book-master.schema.json`
- `content/calculation-books/**/calculation-book.json`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`

## Allowed Outputs

- `migrations/014_formula_catalog.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/markdown-renderer.js`
- `post.js`
- `derive.html`
- `schemas/calculation-book-master.schema.json`
- `content/calculation-books/**`
- `tools/calculation-book/**`
- `scripts/test-formula-catalog.js`
- `scripts/test-calculation-book.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`

Migration `014` may be created and run only against a new isolated `DATA_DIR`.
Do not edit prior migrations, mutate current/production data, implement article
formula bindings, version decision queues, derivation graph edges, focus mode,
carousel behavior, cloud/deployment files, or Git state.

## Formula Card Contract

- Every formula card has one immutable globally unique ASCII `formulaId` and
  one unique route slug.
- The card stores a Chinese display name, required module, required custom
  category path, optional purpose, optional tags, archive state, and current
  immutable LaTeX revision.
- Module and custom category are independent. Custom categories remain
  extensible; do not hard-code a closed category list.
- LaTeX revisions are immutable and addressable. Metadata edits do not rewrite
  historical LaTeX.
- Duplicate identity/slug, malformed category path, and malformed namespaced
  tags fail with formula-specific messages.
- Archive is soft. Restore and revision history preserve stable identity.
- Existing accepted calculation-book formula identities map deterministically
  into the catalog without unsupported filler or duplicate cards.

## CMS Contract

- Formula management uses a left module/custom-category tree, top keyword
  search and tag filters, and a paginated formula-card list.
- Default view shows only the selected category, never every formula at once.
- Cards expose stable identity, name, module, category, purpose, tags, current
  revision, archive state, edit, archive, restore, and visitor preview.
- CRUD and validation remain usable at desktop, mobile, and half-width browser
  sizes with Chinese copy and no mojibake.
- Do not add article editor context-menu insertion in this slice.

## Backup Contract

- Provide deterministic catalog JSON export including identity, metadata,
  immutable revisions, archive state, and source calculation-book revision.
- Provide a local snapshot command that writes outside the source tree, excludes
  credentials, and refuses overwrite.
- Bulk import validates the entire package and creates a pre-change snapshot
  before any isolated-data mutation.

## Verification

- Run `node --check` on changed JavaScript.
- Run a fresh isolated `DATA_DIR` migration and integrity check.
- Test CRUD, search, tag filtering, category tree, pagination, revision,
  archive/restore, export/import, backup refusal, and duplicate validation.
- Import both accepted calculation books and prove stable identity with no
  duplicate cards or slugs.
- Run `npm.cmd run test:formula-catalog`,
  `npm.cmd run test:calculation-book`, `npm.cmd run test:markdown`, API
  regression, browser smoke, and `npm.cmd run codex:contract`.

## Stop Conditions

Stop and return to A00 before current/production data writes, article binding
implementation, formula update decision logic, derivation graph work, focus or
carousel work, cloud synchronization, deployment, or any Git operation.

## Handoff

Write `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
with `status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, migration evidence, formula/category/tag counts,
pagination evidence, backup/restore evidence, admin and visitor test URLs, and
`next_handoff` back to A00.
