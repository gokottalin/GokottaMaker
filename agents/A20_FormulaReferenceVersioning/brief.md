# A20 Formula Reference Versioning Brief

## Role

Temporary formula reference and per-article version decision workbench.

Chinese role note: `公式引用版本：保留文章原公式，并让作者逐篇决定保留、升级或另建公式`.

## Objective

Implement `REQ-20260726-004`. A formula-card LaTeX change or archival creates a
CMS-only decision for every referencing article while each article and visitor
continues to render the exact formula version previously bound to it.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260726-004.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
- `docs/codex-workline/slices/S13_article_formula_authoring_handoff.md`
- A14/A19 migrations, formula APIs, renderer, CMS, and tests

Stop unless A00 accepted both predecessor handoffs.

## Allowed Outputs

- `migrations/016_formula_reference_decisions.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/markdown-renderer.js`
- `post.js`
- `scripts/test-formula-reference-versioning.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S14_formula_reference_versioning_handoff.md`

Do not edit prior migrations, derivation graph rules, focus/carousel behavior,
cloud/deployment files, current data, or Git state.

## Version Contract

- Formula-card LaTeX bodies are immutable revisions. Updating LaTeX creates a
  new revision and never overwrites an article-bound revision.
- Name, module, custom category, purpose, and tag edits update metadata without
  creating article decisions.
- LaTeX revision or card archival creates one pending decision per affected
  article and formula binding.
- Pending decisions are visible only in CMS with a yellow, specific state.
  Visitors and article previews continue rendering the bound old version.
- Each article is decided independently: keep its old version, adopt the newest
  revision, or create a new formula card and bind that article to it.
- No action automatically applies to every referencing article.
- Archive is soft and preserves card history, formula details, and article
  rendering.
- Formula details expose purpose to visitors but never expose internal pending
  decisions.

## Verification

- Use a new isolated `DATA_DIR`.
- Cover one card referenced by at least two articles.
- Prove LaTeX update creates two independent decisions and old visitor output.
- Prove metadata-only edits create no decision.
- Prove each of the three per-article choices and archived-card behavior.
- Run node syntax, formula catalog, article authoring, Markdown, API, and
  contract regressions.

## Handoff

Write `docs/codex-workline/slices/S14_formula_reference_versioning_handoff.md`
with the standard handoff fields plus revision IDs, decision counts, old/new
render evidence, metadata-only evidence, archive evidence, and next handoff to
A00.
