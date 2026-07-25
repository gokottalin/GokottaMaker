# A09 MarkdownDocxDerivationLinks Brief

## Role

Implement derivation shortcode rendering and DOCX fallback behavior. A09 is a
narrow Markdown/DOCX slice.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S01_data_model_migration_contract.md`
- `docs/codex-workline/slices/S03_api_runtime_boundary_handoff.md`
- `data/markdown-renderer.js`
- `tools/md2doc.js`
- `lib/md2doc.js`
- `scripts/test-markdown-renderer.js`

## Allowed Outputs

- `data/markdown-renderer.js`
- `tools/md2doc.js`
- `lib/md2doc.js`
- `scripts/test-markdown-renderer.js`
- `docs/codex-workline/slices/S04_markdown_docx_derivation_links_handoff.md`

## Scope

- Implement safe HTML rendering for `{{derive:slug|label|color}}` and
  `{{derive:slug|label}}`.
- Keep raw Markdown extraction semantics compatible with A08 link sync.
- Ignore derive shortcodes inside fenced code, inline code, and math regions.
- Escape rendered labels and slugs.
- Use the accepted color-token whitelist.
- Implement DOCX V0 fallback as readable plain text, such as
  `label [derive:slug]`.

## Forbidden

- Do not edit database files, migrations, API routes, CMS UI, visitor frontend,
  SEO, release scripts, production data, or Git state.
- Do not run current or production data migrations.
- Do not stage, commit, push, deploy, or roll back.
- Stop and return to A00 if rendering requires API/CMS/frontend changes in the
  same slice.

## Done When

- Markdown renderer tests cover valid shortcode rendering, default color,
  invalid slug/color/label handling, escaping, and code/math exclusion.
- DOCX regression covers the V0 fallback text.
- `npm.cmd run test:markdown` passes.
- `npm.cmd run check:version` passes.
- `npm.cmd run codex:contract` passes.
- The S04 handoff records status, scope, files changed, decisions, risks,
  checks, and next handoff back to A00.
