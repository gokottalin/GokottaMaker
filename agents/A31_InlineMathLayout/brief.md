# A31 Inline Math Layout Brief

## Role

Temporary shared inline-mathematics rendering and visual-regression workbench.

Chinese role note:
`行内数学排版：统一复杂公式与中文基线、分数结构和响应式可读性`.

## Mission

Implement `REQ-20260728-002` after A00 accepts S22. Fix inline math globally,
not per article: simple and deeply nested KaTeX/LaTeX output must sit naturally
with Chinese prose, expand the line box when needed, preserve mathematical
fraction/root/integral structure, and remain readable in CMS preview, article
pages, and derivation pages across themes and responsive widths.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-002.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md`
- `data/markdown-renderer.js`
- `styles.css`
- `styles/20-content.css`
- `post.html`
- `derive.html`
- `admin/index.html`
- `agents/A31_InlineMathLayout/brief.md`

`styles/20-content.css` is read-only because it contains pre-existing dirty
work. Implement the fix in the new dedicated style file.

## Allowed Edits

- `data/markdown-renderer.js`
- `styles.css`
- `styles/26-inline-math.css`
- `scripts/test-inline-math-layout.js`
- `docs/inline-math-layout.md`
- `docs/codex-workline/slices/S24_inline_math_layout_handoff.md`

You are the only active writer for these files during S24. A30 runs in
parallel on a disjoint data/CMS/article-page write set. Do not edit or revert
A30 files.

## Rendering Contract

- Keep existing inline and display formula syntax and mathematical meaning.
- Use one shared renderer/class contract across CMS Markdown preview, visitor
  articles, and public formula/derivation content.
- Inline math may increase the natural line box for tall content, but it must
  not overlap the preceding/following line, clip fractions or radicals, or use
  fixed transforms tuned to one formula.
- Cover at least: ordinary symbols, stacked fractions, fractions whose
  numerator or denominator contains integrals/differentials, square and nested
  roots, multi-level sub/superscripts, and adjacent Chinese punctuation.
- Narrow screens must keep a formula intact where practical and otherwise use
  a deliberate non-clipping overflow/wrap policy.
- Display equations must retain their current block behavior.
- Light/dark colors and focus/hover states remain legible.

## Verification

- Add a deterministic renderer/layout fixture and run
  `node scripts/test-inline-math-layout.js`.
- Include the published BUCK ripple-rate example and synthetic complex fixtures
  for every structure named above.
- Browser-test the same fixture in CMS preview, article detail, and derivation
  content at desktop, half-width, and mobile widths in both themes.
- Record bounding-box or pixel evidence showing no vertical overlap, fraction
  clipping, root clipping, or horizontal page overflow; inspect console and
  network errors.
- Run Markdown, formula catalog/publication/graph, calculation-book,
  cover-coordinate, JavaScript syntax, contract, and whitespace regressions.

## Forbidden

- Per-BUCK or per-article selector hacks.
- Converting all complex inline formulas to display formulas.
- Changing formula meaning, stored LaTeX, or publication data.
- Fixed negative translations that only align simple formulas.
- `styles/20-content.css`, A30 files, schema/API/CMS field work, reading-time
  work, media-fit work, or dark-theme redesign.
- Current/production data, cloud, deployment, restore, rollback, Git staging,
  commit, push, or branch/remote changes.

## Handoff

Write `docs/codex-workline/slices/S24_inline_math_layout_handoff.md` in Chinese
with status, shared renderer/style contract, fixture formulas, CMS/article/
derive matrix, desktop/half/mobile and light/dark evidence, bounding-box/pixel
results, files, commands, risks, protected boundaries, and direct
`next_handoff` to `A00_ProjectDirector`.
