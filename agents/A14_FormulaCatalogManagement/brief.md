# A14 Formula Catalog Management Brief

## Role

Temporary formula-catalog and CMS management workbench.

Chinese role note: `公式目录与管理：确保全部子公式可跳转、公式唯一、多级标签、修订与备份`.

Use Chinese for the handoff and administrator-facing copy. Keep IDs, slugs,
tag keys, filenames, and machine-readable fields in ASCII.

## Objective

Turn the accepted A13 calculation-book output into a formula catalog that is
safe to author and maintain locally. Every visible formula and subformula in a
generated L1/L2/L3 chain must have a stable identity and a working superscript
jump to a real derivation target. The CMS must make these records easy to find,
edit, archive, restore, export, and back up without writing production data.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`
- `docs/codex-workline/slices/S07_cms_formula_authoring_examples_handoff.md`
- `docs/codex-workline/slices/S08_calculation_book_engineering_handoff.md`
- `docs/calculation-book-authoring-guide.md`
- `schemas/calculation-book-master.schema.json`
- `content/calculation-books/**/calculation-book.json`
- `tools/calculation-book/**`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `post.js`
- `main.js`
- `scripts/test-calculation-book.js`

## Allowed Outputs

- `schemas/calculation-book-master.schema.json`
- `content/calculation-books/**`
- `tools/calculation-book/**`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `post.js`
- `main.js`
- `scripts/test-calculation-book.js`
- `scripts/test-formula-catalog.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`

Do not edit migrations, deployment scripts, cloud data, the current project
database, the persistent Owner test database, or Git state. Use a new isolated
`DATA_DIR` for automated tests.

## Formula Identity Contract

- Every formula has one canonical ASCII `formulaId` that is stable across title,
  wording, tag, and publication changes.
- Formula identity is globally namespaced by the stable book ID. A recommended
  address is `<bookId>/<formulaId>`; the generated route slug must also remain
  globally unique.
- The CMS must display the canonical identity and must not silently change it
  during an ordinary edit. A deliberate clone creates a new identity.
- Duplicate canonical identities, duplicate route slugs, missing parent
  identities, cycles, and dangling derivation targets fail validation.

## Strict Tag Contract

Each generated formula node must have exactly one value for every required
dimension:

- `domain:<id>`
- `topology:<id>`
- `book:<id>`
- `depth:l1|l2|l3`
- `formula:<canonical-id>`

Optional hierarchy uses stable path labels such as
`path:power-electronics/flyback/current/rms` and an optional
`parent:<canonical-id>`. Reject malformed namespaced tags and conflicting
values. Preserve ordinary Chinese display tags separately or derive them from
the strict catalog tags; do not use a display label as the unique identity.

## Complete Jump Contract

- Every visible L1 formula gets a formula-level superscript jump to an existing
  L2 or L3 derivation node.
- Every formula used inside an L2 or L3 derivation step is either expanded in
  that step or has its own jump to the next real dependency.
- Generated links come from the JSON master, not handwritten Markdown.
- A missing derivation is a validation error. Do not generate unsupported filler
  text merely to satisfy link coverage.
- Hover and keyboard-focus text names the target, for example
  `纹波公式详细推导` or `纯数学推导 - 二倍角公式`.
- The visitor can return to the parent formula and calculation book.

## CMS Management Contract

- Keep existing create, edit, publish/draft, soft-delete, restore, and revision
  history behavior working.
- Add focused search and filters for book, topology, depth, strict tag path,
  publication state, and canonical formula identity.
- Show parent/child relationships and a direct visitor-preview command without
  turning the CMS into a decorative dashboard.
- Make validation errors specific enough to identify the conflicting formula or
  tag dimension.

## Backup Contract

- Provide a deterministic formula-catalog JSON export that includes identity,
  hierarchy, tags, content, publication state, and source-book revision.
- Provide a local backup/snapshot command that writes outside the source tree,
  never includes credentials, and refuses to overwrite an existing snapshot.
- Import or bulk update must validate the complete package before saving any
  node and must create a pre-change snapshot.
- Existing per-node revisions, soft delete, and restore remain part of the
  recovery path and must be covered by tests.

## Verification

- Run `node --check` on changed JavaScript files.
- Run `npm.cmd run test:formula-catalog`.
- Run `npm.cmd run test:calculation-book` and `npm.cmd run test:markdown`.
- In a fresh isolated `DATA_DIR`, import both accepted calculation books and
  verify admin login, formula filters, CRUD/revision/restore, export, and backup.
- Verify every generated L1/L2/L3 formula jump resolves to HTTP 200 and no
  formula or strict identity is duplicated.
- Confirm Chinese copy and formulas render without mojibake on desktop and
  mobile widths.
- Run `npm.cmd run codex:contract`.

## Stop Conditions

Stop and return to A00 before a database migration, production/current data
write, cloud synchronization, deployment, Git staging/commit/push, or any
derivation that would require inventing an unsupported engineering fact.

## Handoff

Write `docs/codex-workline/slices/S09_formula_catalog_management_handoff.md`
with `status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, formula/tag coverage counts, backup/restore evidence,
admin and visitor test URLs, and `next_handoff` back to A00.
