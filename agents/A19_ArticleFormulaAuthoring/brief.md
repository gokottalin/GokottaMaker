# A19 Article Formula Authoring Brief

## Role

Temporary article formula authoring workbench.

Chinese role note: `文章公式创作：在文章中输入普通 LaTeX、复用公式卡，或把选中公式创建为新公式卡`.

Use Chinese for CMS copy and handoff. Keep IDs, slugs, shortcode fields, enum
values, filenames, and machine-readable fields in ASCII.

## Objective

Complete the article-authoring half of `REQ-20260726-003` after A14 delivers the
formula catalog foundation. Authors may keep ordinary unbound LaTeX, insert an
existing formula card, or select one complete LaTeX formula and immediately
turn it into a newly created bound formula card.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260726-003.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
- `agents/A19_ArticleFormulaAuthoring/brief.md`
- Formula catalog migrations, API, CMS, validators, renderer, and tests from A14

Stop if the A14 handoff is missing or not accepted by A00.

## Allowed Outputs

- `migrations/015_article_formula_bindings.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/markdown-renderer.js`
- `post.js`
- `scripts/test-article-formula-authoring.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S13_article_formula_authoring_handoff.md`

Do not edit A14 migrations, formula revision semantics, derivation graph
relations, focus mode, carousel behavior, cloud/deployment files, current data,
or Git state.

## Authoring Contract

- Existing `$...$` and `$$...$$` LaTeX remains valid and may stay unbound.
- A custom context menu on the Markdown editor opens formula-card search and
  creation actions without disabling ordinary browser or keyboard workflows.
- Existing-card selection supports module, custom category, tag, and keyword
  search and inserts a stable formula-card reference.
- New-card creation requires formula name, module, and custom category. Purpose
  and tags are optional.
- Creating from a selection requires exactly one complete inline or display
  LaTeX expression. Reject mixed prose, partial delimiters, and multiple
  formulas with a precise Chinese message.
- Successful creation atomically saves the formula card and replaces only the
  selected formula with its bound reference.
- Do not infer the name, module, category, purpose, or tags.
- The binding representation must retain a stable formula-card identity and an
  immutable version identity so A20 can implement per-article version choices.

## Verification

- Run `node --check` on changed JavaScript files.
- Use a new isolated `DATA_DIR`.
- Prove ordinary unbound inline and display LaTeX still render unchanged.
- Prove context-menu search/insertion by category, tag, and keyword.
- Prove selected formula creation, atomic replacement, invalid-selection
  rejection, keyboard access, and Chinese copy at desktop and half-width CMS.
- Run formula catalog, Markdown, API, and contract regressions.

## Handoff

Write `docs/codex-workline/slices/S13_article_formula_authoring_handoff.md`
with `status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, reference syntax, migration evidence, CMS evidence,
and `next_handoff` back to A00.
