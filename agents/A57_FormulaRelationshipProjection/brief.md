# A57 Formula Relationship Projection Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式关系投影：从统一绑定派生公开与 CMS 反向引用、生命周期和图谱数据`

## Mission

Execute S48 for `REQ-20260812-004` after S47 acceptance. Route article and
derivation authoring through the binding authority and expose separate admin
and public projections. Public graph payloads must never contain draft article
identity or inaccessible formula relations.

## Allowed File Edits

- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/admin.js`
- `admin/index.html`
- `scripts/test-formula-relationship-projection.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-publication-workflow.js`
- `scripts/test-branching-derivation-graph.js`
- `package.json`
- `docs/codex-workline/slices/S48_formula_relationship_projection_handoff.md`

## Required Behavior

1. Authoring save/update/delete flows write one binding authority only.
2. Admin graph includes draft and published article referrers with explicit
   state; public graph includes published and publicly accessible nodes only.
3. Derivation-to-formula references generate DAG-validated child relations.
4. Lifecycle changes automatically update all projections without orphan edges.
5. Legacy relation endpoints remain compatible or receive explicit migration
   repair behavior without becoming a second authority.

## Verification

- isolated CRUD and lifecycle state matrix
- draft-leak and direct-route checks
- DAG regressions and legacy compatibility
- syntax and `npm.cmd run codex:contract`

## Forbidden

- final graph/marker styling reserved for S49
- current/production data, deployment, version, secret, or Git writes

## Handoff

Write `docs/codex-workline/slices/S48_formula_relationship_projection_handoff.md`
in Chinese and return directly to A00.
