# A32 Full Site Dark Theme Brief

## Role

Temporary full-site dark-theme audit, repair, and visual-regression workbench.

Chinese role note:
`全站夜间主题：统一游客端与 CMS 的暗色表面、文字、状态和交互对比。`

## Mission

Implement `REQ-20260728-009` after A00 accepts S20 and S23-S25. Audit and
repair dark mode across the public site and both CMS pages, not only the known
homepage public-derivation anomaly. Use shared theme variables and narrowly
scoped override layers so backgrounds, cards, text, borders, links, controls,
formulas, Markdown, graph views, drawers, dialogs, code blocks, and semantic
states remain readable in dark mode while daylight mode and business behavior
remain unchanged.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-009.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md`
- `docs/codex-workline/slices/S23_post_reading_minutes_handoff.md`
- `docs/codex-workline/slices/S24_inline_math_layout_handoff.md`
- `docs/codex-workline/slices/S25_focused_content_media_handoff.md`
- `styles.css`
- `styles/00-base.css`
- `styles/10-hero.css`
- `styles/20-content.css`
- `styles/26-inline-math.css`
- `styles/27-focused-content-media.css`
- `styles/larkix-brand-theme.css`
- `styles/larkix-home.css`
- `styles/larkix-elec.css`
- `styles/gokotta-elec.css`
- `styles/md2doc.css`
- `admin/index.html`
- `admin/course-paths.html`
- `admin/admin.css`
- `formula-graph.js`
- all primary visitor HTML pages and tool HTML pages
- `agents/A32_FullSiteDarkTheme/brief.md`

`styles/20-content.css` and `admin/admin.css` contain pre-existing local work
and are read-only. Put repairs in the dedicated visitor and CMS dark-theme
layers.

## Allowed Edits

- `styles.css`
- `styles/28-full-site-dark.css`
- `admin/index.html`
- `admin/course-paths.html`
- `admin/admin-dark.css`
- `scripts/test-full-site-dark-theme.js`
- `docs/full-site-dark-theme.md`
- `docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md`

You are the only active writer for these files during S26. Preserve all
accepted S18-S25 behavior and every unrelated dirty change.

## Theme Contract

- Audit primary public pages: entry/home, maker homepage, category, article,
  derivation, projects/list/detail, miniapps, 404, and the three tool pages.
- Audit CMS content studio and course-path editor.
- Explicitly cover the homepage public derivation publication area, formula
  cards, Markdown, inline/display math, dependency graph, formula drawer,
  dialogs, code blocks, inputs, selects, textareas, tables, and navigation.
- Provide distinguishable dark treatments for success, warning, error, draft,
  published, archived, disabled, selected, hover, and keyboard-focus states.
- Prefer shared semantic dark tokens over repeated isolated color literals.
- Manual theme selection and system-theme fallback must both work without
  stale daylight surfaces.
- Daylight computed colors and layout dimensions must remain unchanged.
- Do not redesign branding, typography, spacing, or content hierarchy.
- Meet practical WCAG AA contrast for normal text and controls where measurable;
  document intentional large-text or decorative exceptions.

## Verification

- Add a deterministic audit that checks the new imports/links, shared semantic
  tokens, required surface/state selectors, protected-file exclusion, and no
  broad daylight overrides.
- Build a page/state matrix for all primary public/CMS/tool surfaces.
- Browser-test representative content at desktop, half-width, and mobile in
  both light and dark modes. Include hover, focus, disabled, selected,
  success/warning/error/draft/published/archived, modal/drawer, formula,
  Markdown, graph, and code-block states.
- Capture computed foreground/background/border colors and contrast ratios for
  critical states; inspect overlap, page overflow, console, and network errors.
- Run formula publication/graph/drawer, Markdown, inline math, cover,
  reading-minutes, focused-media, CMS/API, JavaScript syntax, contract, and
  whitespace regressions.

## Forbidden

- Editing `styles/20-content.css` or `admin/admin.css`.
- Changing content state, publication behavior, graph data, formula meaning,
  layout structure, or theme-toggle persistence logic.
- A single homepage-only patch, broad `!important` flooding, or a visual brand
  redesign.
- Current/production data, cloud, deployment, restore, rollback, Git staging,
  commit, push, or branch/remote changes.

## Handoff

Write `docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md` in
Chinese with status, shared token/selector contract, full page/state matrix,
light/dark desktop/half/mobile evidence, contrast results, daylight
regression, files, commands, risks, protected hashes, and direct
`next_handoff` to `A00_ProjectDirector`.
