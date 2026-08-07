# A36 SharedMathRendering Brief

## Role

Temporary short-task workbench.

Chinese role note:
`共享数学渲染：统一 LaTeX 引擎、错误诊断和发布门禁`

## Mission

Replace divergent string-level math rendering with one fixed, locally served LaTeX engine and structured diagnostics shared by CMS preview and public Markdown surfaces.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-003.json`
- `data/markdown-renderer.js`
- `styles/20-content.css`
- `styles/26-inline-math.css`
- `post.html`
- `project.html`
- `derive.html`
- `scripts/test-markdown-renderer.js`
- `scripts/test-inline-math-layout.js`

## Allowed Edits

- `package.json`
- `package-lock.json`
- `assets/vendor/katex/**`
- `data/math-renderer.js`
- `data/markdown-renderer.js`
- `styles/26-inline-math.css`
- `post.html`
- `project.html`
- `derive.html`
- `admin/index.html`
- `scripts/test-markdown-renderer.js`
- `scripts/test-inline-math-layout.js`
- `scripts/test-math-rendering.js`
- `docs/shared-math-rendering.md`
- `docs/codex-workline/slices/S30_shared_math_rendering_handoff.md`

`admin/index.html` is integrated by A37_CarouselSlotAuthority, which must load
`/data/math-renderer.js` before `/data/markdown-renderer.js`. Do not edit that file.

You are the only active writer for this list while S30_shared_math_rendering is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- one fixed-version local math engine exposed as LarkixMath.render and LarkixMath.validate
- correct subscripts, superscripts, roots, integrals, nested fractions, root scope, and compact boxed formulas
- display delimiters without decorative full-row borders unless source explicitly uses boxed
- structured blocking diagnostics that preserve the last valid public revision

## Verification

- fixed math fixture matrix across CMS preview, article, formula, and derivation surfaces
- invalid delimiter and brace diagnostics with no invalid public output
- desktop and mobile baseline, overflow, boxed sizing, and dark-mode browser checks
- Markdown, inline-math, JavaScript syntax, diff, encoding, and Codex contract checks

## Dependencies

- `DISPATCH-20260730-001`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- editing styles/20-content.css; override its legacy rules in the later loaded math layer
- formula binding, graph layout, MD2File DOCX conversion, current data, or publication-state migration

## Handoff

Write `docs/codex-workline/slices/S30_shared_math_rendering_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
