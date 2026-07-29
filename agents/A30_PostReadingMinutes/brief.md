# A30 Post Reading Minutes Brief

## Role

Temporary article reading-time data and presentation workbench.

Chinese role note:
`文章阅读时间：让作者选填正整数分钟，并在详情与各文章卡片中条件显示`.

## Mission

Implement `REQ-20260728-006` after A00 accepts S22. Replace every fixed
`10 分钟阅读` fallback with one nullable author-entered positive integer. A
saved value must round-trip through the database, revisions, CMS, admin/public
DTOs, article detail, and every applicable article card. A missing value must
render nothing and leave no empty metadata gap.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-006.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md`
- `migrations/001_initial_schema.js`
- `migrations/007_content_revisions.js`
- `migrations/024_post_cover_coordinates.js`
- `lib/content.js`
- `lib/validators.js`
- `data/posts.js`
- `maker.html`
- `admin/index.html`
- `admin/admin.js`
- `main.js`
- `category-page.js`
- `post.js`
- `agents/A30_PostReadingMinutes/brief.md`

## Allowed Edits

- `migrations/025_post_reading_minutes.js`
- `lib/content.js`
- `lib/validators.js`
- `data/posts.js`
- `maker.html`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `main.js`
- `category-page.js`
- `post.js`
- `scripts/test-post-reading-minutes.js`
- `package.json`
- `docs/post-reading-minutes.md`
- `docs/codex-workline/slices/S23_post_reading_minutes_handoff.md`

You are the only active writer for these files during S23. A31 runs in
parallel but owns a disjoint renderer/style write set. Preserve all existing
local edits, including accepted S22 cover-coordinate work.

## Data Contract

- Migration `025` adds a nullable integer minutes column to posts only.
- Admin/public DTOs use `readingMinutes: positive integer | null`.
- Accept blank/null as `null`; accept only a bounded positive integer. Reject
  zero, negatives, decimals, numeric-looking mixed text, booleans, arrays, and
  out-of-range values with a clear validation error.
- Old posts must resolve to `null`; do not backfill `10`.
- Save, export, local draft, revision snapshot, restore, and API round-trip
  preserve the nullable value exactly.
- Clearing an existing value saves `null`.

## CMS And Public Behavior

- Add one optional article-only numeric input with a visible `分钟` unit and
  concise Chinese validation help. Do not show it for projects or knowledge
  nodes.
- The saved value appears in the article detail title metadata and in every
  article-list/card surface that currently prints a fixed reading time,
  including homepage and category/focus entries.
- Missing values produce no text node, placeholder, separator, or reserved
  spacing. Projects and derivation nodes remain unchanged.
- Search the whole source tree for fixed `10 分钟阅读` or equivalent fallback
  logic and remove only article reading-time defaults.
- Treat `data/posts.js` legacy `readTime` strings and the static
  `maker.html#featuredReadTime` text as explicit compatibility inputs: migrate
  intentional positive values to the nullable integer contract, and remove
  placeholder text that can leak when no value is set.

## Verification

- Add and run `npm.cmd run test:post-reading-minutes`.
- Prove migration additivity, old-post null behavior, positive-integer bounds,
  invalid payload rejection, save/update/clear, revision/restore, and public/
  admin DTO round-trips in an isolated `DATA_DIR`.
- Browser-test CMS create/edit/clear and published article detail, homepage,
  category, and focus/card surfaces with one set value and one unset legacy
  article.
- Check desktop, half-width, and mobile layouts, plus console/network errors.
- Run API, post/content, crop-coordinate, Markdown/formula, JavaScript syntax,
  contract, and whitespace regressions.

## Forbidden

- Word-count estimation or a fallback default.
- Zero, negative, decimal, unit-bearing, or free-text storage.
- Inline-math renderer/style work or edits to A31 files.
- `styles.css`, `styles/20-content.css`, or `styles/26-inline-math.css`.
- Current/production data, cloud, deployment, restore, rollback, Git staging,
  commit, push, or branch/remote changes.

## Handoff

Write `docs/codex-workline/slices/S23_post_reading_minutes_handoff.md` in
Chinese with status, schema/validator contract, fixed-fallback search evidence,
CMS/public display matrix, set/unset/clear/revision evidence, responsive
browser results, files, commands, risks, protected boundaries, and direct
`next_handoff` to `A00_ProjectDirector`.
