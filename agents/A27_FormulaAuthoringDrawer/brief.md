# A27 Formula Authoring Drawer Brief

## Role

Temporary formula authoring drawer workbench.

Chinese role note:
`公式创作抽屉：让长文章任意滚动位置都能安全调用公式搜索、插入、建卡和预览`.

## Mission

Implement `REQ-20260728-008` after A00 acceptance of S19. Turn the existing
article formula tools into a persistent, collapsible drawer that remains
available while editing long Markdown, preserves the editor selection and
unsaved draft, and links to the independent full formula workbench.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-008.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S13_article_formula_authoring_handoff.md`
- `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`
- `docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md`
- `agents/A27_FormulaAuthoringDrawer/brief.md`

## Allowed Edits

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-authoring-drawer.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md`

Do not edit `styles/20-content.css`; it is reserved and contains pre-existing
local work.

## Required Architecture

- Reuse the accepted formula-card APIs and editor functions. Do not add a
  second formula catalog, new persistence model, or automatic article save.
- Keep the article textarea/editor mounted while the drawer opens, closes, or
  links to the independent formula workbench. Preserve Markdown, scroll
  position, focus, selection start/end, and the last valid LaTeX selection.
- The drawer is structurally outside the article Markdown scroll flow and stays
  reachable at the top, middle, and bottom of a long article.
- Expanded mode contains existing-card search/filter, insertion, selection-to-
  card creation, and quick preview. Deep metadata, derivation Markdown,
  publication state, classification, and dependency graph remain in the
  independent formula workbench.
- Collapsed mode leaves one familiar formula icon button with Chinese tooltip
  and accessible name. Opening/closing returns focus predictably.
- Desktop may use a sticky right rail. Half-width and mobile must use a compact
  non-obscuring drawer or sheet that never covers save/publish controls or makes
  the primary editor inaccessible.

## Required Behavior

- The entry remains operable after scrolling a long article to top, middle, and
  bottom.
- Insertion uses the editor selection captured immediately before the formula
  action, even after search, preview, drawer toggling, or formula-workbench
  navigation.
- Unsaved article content and local draft state survive drawer toggles.
- Search and filters keep the accepted formula publication/archival semantics.
- Preview renders the selected public/current formula appropriately without
  exposing draft content to visitor routes.
- Use existing icons or Lucide when available; add Chinese `title` and
  `aria-label`. Do not add feature-explanation copy inside the product UI.

## Verification

- Add and run `npm.cmd run test:formula-authoring-drawer`.
- Run `npm.cmd run test:article-formula-authoring`.
- Run `npm.cmd run test:formula-publication`.
- Run `npm.cmd run test:formula-catalog`.
- Run `npm.cmd run test:branching-derivation-graph`.
- Run `npm.cmd run test:markdown`.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`.
- Run `npm.cmd run codex:contract`.
- Use a new temporary `DATA_DIR`; never open current or production data.
- In an isolated signed-in browser, use a long unsaved article and prove top,
  middle, and bottom sticky access; expand/collapse; search/filter; existing
  formula insertion; selected-LaTeX card creation; quick preview; preserved
  Markdown, scroll, focus, selection, and insertion position; independent
  workbench round trip; keyboard operation; desktop, 760px half-width, and
  390px mobile layout; no overlap, overflow, console errors, or unexpected
  network failures.

## Forbidden

- Formula schema, publication, dependency graph, or migration changes.
- Re-embedding the complete formula workbench in the article editor.
- Automatic article save or silent mutation of unsaved content.
- Legacy physical cleanup, cover crop, reading time, general inline-math,
  media-fit, or dark-theme work.
- `styles/20-content.css`.
- Current or production database/runtime data.
- Cloud writes, deployment, restore, rollback, Git staging, commit, or push.
- Reverting or normalizing unrelated local changes.

## Handoff

Write `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md` in
Chinese with status, state-preservation design, drawer/independent-workbench
boundary, top/middle/bottom long-article evidence, quick-action evidence,
desktop/half-width/mobile and keyboard evidence, files, checks, risks, and
direct `next_handoff` to `A00_ProjectDirector`.
