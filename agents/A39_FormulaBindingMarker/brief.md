# A39 FormulaBindingMarker Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式绑定标记：只在原公式右上角添加紫色上标式跳转图标`

## Mission

Define one decorative formula-binding protocol that preserves source math and adds only an accessible purple superscript-sized jump marker.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-005.json`
- `docs/codex-workline/slices/S30_shared_math_rendering_handoff.md`
- `data/math-renderer.js`
- `data/markdown-renderer.js`
- `post.js`
- `derive.html`
- `styles/26-inline-math.css`

## Allowed Edits

- `data/markdown-renderer.js`
- `post.js`
- `derive.html`
- `styles/26-inline-math.css`
- `scripts/test-markdown-renderer.js`
- `scripts/test-formula-binding-marker.js`
- `docs/formula-binding-marker.md`
- `docs/codex-workline/slices/S33_formula_binding_marker_handoff.md`

You are the only active writer for this list while S33_formula_binding_marker is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- one binding marker protocol shared by article and derivation Markdown
- exact preservation of author formula text with one top-right purple circular marker
- accessible hover/focus title and navigation to the published target
- no marker on ordinary formulas or formula-map nodes

## Verification

- bound/unbound, inline/display, superscript, boxed, keyboard, touch, and long-form fixtures
- DOM proof that formula content is not duplicated or rewritten
- Markdown and shared-math regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S30_shared_math_rendering`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- inserting a second formula, text link, card block, or graph-node marker
- editing CMS, API, formula relation data, package files, or protected styles/20-content.css

## Handoff

Write `docs/codex-workline/slices/S33_formula_binding_marker_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
