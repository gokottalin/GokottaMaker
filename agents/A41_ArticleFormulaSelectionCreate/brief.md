# A41 ArticleFormulaSelectionCreate Brief

## Role

Temporary short-task workbench.

Chinese role note:
`框选公式建卡：完整选区、分类检索和原子创建绑定`

## Mission

Repair selected-LaTeX formula-card creation so complete delimiters create one normalized draft card and atomically bind the unchanged source formula.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-006.json`
- `docs/codex-workline/slices/S33_formula_binding_marker_handoff.md`
- `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `server.js`
- `lib/content.js`
- `lib/validators.js`

## Allowed Edits

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-authoring-drawer.js`
- `scripts/test-article-formula-selection-create.js`
- `docs/article-formula-selection-create.md`
- `docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md`

You are the only active writer for this list while S35_article_formula_selection_create is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- complete selection recognition for dollar, parenthesis, and bracket delimiters
- shared searchable module, category, and multi-tag controls with explicit creation intent
- stable normalized slug and draft state
- atomic card creation plus source-hash-protected article binding

## Verification

- complete/partial/multiple/plain-text selection fixtures
- classification search, explicit new option, normalization, and field-help checks
- transaction rollback when either card creation or article binding fails
- article formula, drawer, publication, marker, API, and responsive CMS regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S33_formula_binding_marker`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- automatic formula-card creation without an explicit complete selection and save action
- rewriting selected formula content or bypassing draft/publication gates
- editing package.json, graph layout, MD2File, carousel, or protected files

## Handoff

Write `docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
