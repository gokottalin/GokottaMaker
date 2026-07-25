# A11 PublicDerivationAndFocusMode Brief

## Role

Implement the visitor-facing derivation page and focused public navigation. A11
is a narrow public frontend slice that consumes the A08 public API, A09
Markdown renderer behavior, and A10 CMS workflow output.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S03_api_runtime_boundary_handoff.md`
- `docs/codex-workline/slices/S04_markdown_docx_derivation_links_handoff.md`
- `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`
- `index.html`
- `maker.html`
- `category.html`
- `post.html`
- `project.html`
- `main.js`
- `post.js`
- `site-layout.js`
- `styles.css`
- `styles/`

## Allowed Outputs

- `derive.html`
- `main.js`
- `post.js`
- `site-layout.js`
- `styles.css`
- `styles/`
- `docs/codex-workline/slices/S06_public_derivation_and_focus_mode_handoff.md`

## Scope

- Add a public derivation detail page or equivalent visitor route for
  `/api/knowledge-nodes/:slug`.
- Ensure A09 `{{derive:slug|label|color}}` links have a usable visitor
  destination and sane loading, not-found, private, and archived states.
- Add visible derivation/backlink/related-node affordances only where the A08
  public payload already provides the data.
- Apply the focused power-electronics public navigation as a V0 presentation
  layer without deleting hidden sections, source pages, seed content, or
  historical docs.
- Keep article/project/detail page flows working and avoid breaking existing
  site-layout behavior.
- If focus-mode requires a missing API or site setting, do not add backend code;
  record the gap in the handoff.

## Forbidden

- Do not edit `server.js`, `lib/`, migrations, CMS admin files, Markdown/DOCX
  renderer internals, current database/runtime data, protected runtime paths,
  release scripts, deployment state, or Git state.
- Do not delete hidden pages, seed content, historical Agent docs, assets, or
  routes as part of focus mode.
- Do not create or run database migrations.
- Do not stage, commit, push, deploy, or roll back.
- Stop and return to A00 if the work requires API, database, CMS, or release
  changes in the same slice.

## Done When

- A published public knowledge node can be viewed on the visitor side by slug.
- Derivation shortcodes in articles route to the public derivation destination.
- Public pages handle loading, empty, not-found/private, and missing-link states.
- Focused public navigation is applied without deleting hidden content or
  backend data.
- `npm.cmd run test:markdown` passes.
- `npm.cmd run codex:contract` passes.
- The S06 handoff records status, scope, files changed, decisions, risks,
  smoke checks, and next handoff back to A00.
