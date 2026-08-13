# A56 Formula Binding Authority Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式绑定权威模型：统一文章与推导正文的稳定绑定并迁移既有关系`

## Mission

Execute S47 for `REQ-20260812-004` after S46 acceptance. Establish one durable
binding authority for article-to-formula references and formula-to-formula
derivation references. Derived reverse references, graph edges, and markers must
not require separate manual relation maintenance.

## Allowed File Edits

- `migrations/028_formula_content_bindings.js`
- `lib/content.js`
- `lib/validators.js`
- `scripts/test-formula-binding-authority.js`
- `scripts/test-legacy-formula-relation-migration.js`
- `package.json`
- `docs/codex-workline/slices/S47_formula_binding_authority_handoff.md`

## Required Behavior

1. One stable unique binding record represents article or formula-derivation
   source to a formula target, with source location and lifecycle metadata.
2. Migration `028` is loaded by the existing directory loader in `lib/db.js`;
   no migration index file is introduced. Article bindings never participate in
   formula DAG cycle checks.
3. Formula-to-formula bindings use the existing transactional self/cycle guard.
4. Existing article bindings, derive links, and manual edges migrate idempotently
   with deduplication and no physical source deletion.
5. Isolated backup/migration evidence proves counts and rollback boundaries.

## Verification

- isolated fresh and legacy migration tests
- idempotency, duplicate, self-reference, cycle, branch, and multi-article tests
- formula publication and relation repair regressions
- syntax and `npm.cmd run codex:contract`

## Forbidden

- API, CMS, graph UI, or marker rendering changes reserved for S48/S49
- current/production data mutation, deployment, version, or Git writes

## Handoff

Write `docs/codex-workline/slices/S47_formula_binding_authority_handoff.md` in
Chinese and return directly to A00.
