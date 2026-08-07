# A43 FormulaMapFlowLayout Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式地图流程布局：从左向右、自适应数学节点和可操作画布`

## Mission

Render the accepted derivation DAG as a left-to-right navigable flow with measured math nodes, pan, zoom, drag, and no formula truncation.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-004.json`
- `docs/codex-workline/slices/S30_shared_math_rendering_handoff.md`
- `docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md`
- `data/math-renderer.js`
- `formula-graph.js`
- `derive.html`
- `admin/index.html`
- `admin/admin.css`

## Allowed Edits

- `formula-graph.js`
- `derive.html`
- `admin/admin.css`
- `scripts/test-formula-map-flow-layout.js`
- `docs/formula-map-flow-layout.md`
- `docs/codex-workline/slices/S37_formula_map_flow_layout_handoff.md`

You are the only active writer for this list while S37_formula_map_flow_layout is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- stable source-to-dependency depth laid out from left to right
- shared math rendering inside measured nodes that grow to content
- pan, zoom, drag, scroll, current-node highlight, and node navigation
- bounded initial viewport without truncation or binding-marker duplication

## Verification

- branch, merge, long formula, nested fraction, and deep path fixtures
- node DOM measurement and edge-direction assertions
- desktop and mobile canvas pixel, overflow, pan, zoom, drag, and click checks
- DAG, shared-math, dark-theme, syntax, and accessibility regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S30_shared_math_rendering`
- `S36_derivation_workflow_recovery`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- changing dependency semantics, compressing unreadably, truncating formulas, or adding marker icons inside nodes
- editing server, database, CMS JavaScript/HTML, package files, or protected styles

## Handoff

Write `docs/codex-workline/slices/S37_formula_map_flow_layout_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
