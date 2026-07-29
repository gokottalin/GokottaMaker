# A25 Focused Content Media Brief

## Role

Temporary responsive media-fit and visual-regression workbench for focused
article cards.

Chinese role note:
`聚焦内容媒体：让文章图片按各自卡片容器自适应裁切，同时保持 Hero 独立。`

## Mission

Implement `REQ-20260728-007` after A00 accepts S22 and S24. Focused homepage
article media must fill the actual responsive card image container without
stretching, squashing, blank bands, or inheriting the Hero ratio. The same
stored cover and optional S22 crop coordinates must adapt when the card moves
between desktop, half-width, and mobile layouts. Hero behavior must remain
unchanged.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-007.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md`
- `docs/codex-workline/slices/S24_inline_math_layout_handoff.md`
- `maker.html`
- `main.js`
- `data/media.js`
- `styles.css`
- `styles/10-hero.css`
- `styles/20-content.css`
- `styles/25-cover-crop.css`
- `styles/40-responsive.css`
- `agents/A25_FocusedContentMedia/brief.md`

`styles/20-content.css` contains pre-existing user work and is read-only.
Implement focused-media overrides in the dedicated new style file.

## Allowed Edits

- `main.js`
- `data/media.js`
- `styles.css`
- `styles/27-focused-content-media.css`
- `scripts/test-focused-content-media.js`
- `docs/focused-content-media.md`
- `docs/codex-workline/slices/S25_focused_content_media_handoff.md`

You are the only active writer for these files during S25. Preserve all
accepted S22-S24 behavior and all unrelated dirty work.

## Media Contract

- Target the focused/recommended article cards on `maker.html`; do not restyle
  the Hero or make focused cards inherit Hero dimensions.
- The image viewport derives from the current card layout, not a fixed `16:9`
  presentation ratio.
- Images cover the full viewport with no blank band and preserve their natural
  proportions.
- Existing S22 cover coordinates remain the focal source when present and are
  replayed without distortion as the container resizes.
- Square, portrait, landscape, and ultra-wide source images must all have a
  deliberate cover result.
- Missing and failed images retain the existing fallback behavior without
  collapsing the card.
- Resize behavior must be automatic; no separate uploads per breakpoint.
- Keep article text, links, reading minutes, focus-mode filtering, and card
  interaction unchanged.

## Verification

- Add deterministic tests for focused-card opt-in, container-owned sizing,
  `object-fit`/crop preservation, resize hydration, fallback behavior, and Hero
  independence.
- Browser-test desktop, half-width, and mobile with square, portrait,
  landscape, and ultra-wide covers, including one saved S22 crop.
- Record computed container/image dimensions or equivalent pixel evidence:
  no distortion, no blank band, no horizontal overflow, and no Hero dimension
  change.
- Inspect console and failed network requests.
- Run cover-coordinate, reading-minutes, Markdown, formula publication/graph,
  JavaScript syntax, contract, and whitespace regressions.

## Forbidden

- Editing `styles/20-content.css`.
- Fixed `16:9` focused-card sizing or reuse of Hero selectors/ratio.
- Changing Hero carousel dimensions, overlay, crop policy, timing, or
  interaction.
- Changing stored cover files, stored crop coordinates, CMS authoring, article
  data, reading time, formulas, or derivation rendering.
- Full-site dark-theme redesign or unrelated refactors.
- Current/production data, cloud, deployment, restore, rollback, Git staging,
  commit, push, or branch/remote changes.

## Handoff

Write `docs/codex-workline/slices/S25_focused_content_media_handoff.md` in
Chinese with status, exact targeted card selectors, container-sizing and crop
contract, Hero-independence proof, source-ratio/browser matrix, computed or
pixel evidence, files, commands, risks, protected boundaries, and direct
`next_handoff` to `A00_ProjectDirector`.
