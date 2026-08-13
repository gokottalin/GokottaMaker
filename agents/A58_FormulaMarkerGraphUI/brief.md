# A58 Formula Marker Graph UI Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式角标与图谱界面：统一紫色右上角跳转并区分文章和公式节点`

## Mission

Execute S49 for `REQ-20260812-004` after S48 acceptance. Render each bound
formula with one accessible purple circular return marker at the formula's
upper-right corner. Remove duplicate paragraph-end links/cards. Render article
referrer nodes and formula dependency nodes with distinct graph semantics;
draft article state is CMS-only.

## Allowed File Edits

- `data/markdown-renderer.js`
- `data/math-renderer.js`
- `formula-graph.js`
- `post.js`
- `derive.html`
- `post.html`
- `styles/20-content.css`
- `styles/40-formula.css`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-formula-marker-graph-ui.js`
- `scripts/test-formula-binding-marker.js`
- `scripts/test-formula-map-flow-layout.js`
- `package.json`
- `docs/codex-workline/slices/S49_formula_marker_graph_ui_handoff.md`

## Required Behavior

1. One marker per binding, positioned like an upper-right superscript for inline,
   block, boxed, fraction, root, integral, and narrow layouts.
2. Hover/focus/touch-equivalent affordance names the target; click uses the
   published derivation URL and accessible name.
3. No ordinary paragraph/footer link, child text list, or duplicate formula card.
4. Graph article and formula nodes have different shapes/colors/labels; nodes
   are clickable and do not contain marker UI.
5. Draft state appears only in authenticated CMS graph with color plus text and
   legend, never in public graph DOM or data.

## Verification

- DOM and accessibility tests
- graph node/edge/type and draft-leak tests
- desktop, half-width, and mobile browser visual checks
- complex math overlap and console checks
- syntax and `npm.cmd run codex:contract`

## Forbidden

- schema/API authority changes reserved for accepted S47/S48
- current/production data, deployment, version, secret, or Git writes

## Handoff

Write `docs/codex-workline/slices/S49_formula_marker_graph_ui_handoff.md` in
Chinese and return directly to A00.
