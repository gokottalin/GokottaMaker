# A24 Formula Publishing Workflow Brief

## Role

Temporary formula publication workbench.

Chinese role note:
`公式发布工作流：为公式卡补齐 Markdown 推导、三态发布、待发布修订和文章发布门禁`.

## Mission

Implement `REQ-20260728-003` on top of the accepted formula catalog,
article-binding, and immutable-revision foundations. Make the formula card the
single authoring identity while preserving all existing article-bound
revisions and public behavior until a new revision is explicitly published.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-003.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
- `docs/codex-workline/slices/S13_article_formula_authoring_handoff.md`
- `docs/codex-workline/slices/S14_formula_reference_versioning_handoff.md`
- `migrations/014_formula_catalog.js`
- `migrations/015_article_formula_bindings.js`
- `migrations/016_formula_reference_decisions.js`

## Allowed Edits

- `migrations/020_formula_publication_workflow.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `post.js`
- `derive.html`
- `scripts/test-formula-catalog.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-reference-versioning.js`
- `scripts/test-formula-publication-workflow.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`

Do not edit `styles/20-content.css`; it contains pre-existing local work and is
reserved for later media and inline-math tasks.

## Required Behavior

- Add independent Markdown derivation content to every formula card.
- Support `draft`, `published`, and `archived` formula states. New cards default
  to draft.
- Keep a distinct published revision. Editing published LaTeX or Markdown
  creates a pending revision and must not alter visitor output until explicit
  republish.
- Public APIs and routes expose only the published revision. Draft and archived
  independent formula pages are unavailable to visitors.
- Archived formulas remain readable through existing article-bound historical
  revisions but cannot be inserted into new articles.
- Draft formulas may bind to draft articles. Article publication must fail with
  a precise reason while any bound formula remains draft.
- Module and primary category are single-select; tags are multi-select.
  Searchable selectors allow explicit creation, normalize whitespace and slug
  format, detect likely duplicates, and remain manageable in CMS.
- Human-facing field labels are Chinese. Help controls explain purpose, format,
  and examples on hover, keyboard focus, click, and touch.
- Normalize safe Chinese and English punctuation in metadata only. Never
  rewrite LaTeX meaning or Markdown prose.
- Preserve formula identity, immutable history, article bindings, existing
  version decisions, focus behavior, and carousel behavior.

## Verification

- Use a new temporary `DATA_DIR`; never open `database/` or `runtime-data/`.
- Add and run `npm.cmd run test:formula-publication`.
- Run `npm.cmd run test:formula-catalog`.
- Run `npm.cmd run test:article-formula-authoring`.
- Run `npm.cmd run test:formula-reference-versioning`.
- Run `npm.cmd run test:markdown`.
- Run `npm.cmd run test:calculation-book`.
- Run `npm.cmd run codex:contract`.
- Perform isolated CMS and visitor browser checks for the three states,
  pending-publication isolation, article publication blocking, archived
  history, Chinese help controls, and responsive layout.

## Forbidden

- Branching derivation graph changes.
- Formula drawer layout.
- Legacy formula migration or deletion.
- `styles/20-content.css` changes.
- Current or production database/runtime data.
- Cloud writes, deployment, restore, rollback, Git staging, commit, or push.
- Reverting or normalizing unrelated local changes.

## Handoff

Write `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`
in Chinese with status, scope completed, files changed, migration and API
decisions, state matrix, browser evidence, checks, risks, and direct
`next_handoff` to `A00_ProjectDirector`.
