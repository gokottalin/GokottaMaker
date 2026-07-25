# A10 CmsKnowledgeNodeWorkflow Brief

## Role

Implement the CMS-side workflow for derivation knowledge nodes. A10 is a narrow
admin UI slice that consumes the A08 API and the A09 Markdown/DOCX rendering
contract.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/slices/S03_api_runtime_boundary_handoff.md`
- `docs/codex-workline/slices/S04_markdown_docx_derivation_links_handoff.md`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/course-paths.html`

## Allowed Outputs

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/course-paths.html`
- `docs/codex-workline/slices/S05_cms_knowledge_node_workflow_handoff.md`

## Scope

- Add a CMS navigation/view for knowledge nodes or derivation nodes using the
  existing admin UI patterns.
- Use only the existing A08 admin endpoints for listing, detail, save,
  soft-delete, restore, and revision restore.
- Support the V0 knowledge-node fields: `id`, `slug`, `nodeType`, `symbol`,
  `title`, `summary`, `markdown`, `cover`, `accentColor`, `tags`,
  `publishStatus`, and `visibilityStatus`.
- Reuse existing upload/image-library behavior where practical without changing
  upload API semantics.
- Preview Markdown with the existing renderer path available to the admin UI,
  including A09 derive shortcodes when that renderer is already available.
- Expose warnings returned by the A08 save endpoint, especially dangling derive
  targets.
- If public focus-mode controls require a missing backend API, stop short of
  adding server code and record the gap in the handoff.

## Forbidden

- Do not edit `server.js`, `lib/`, `data/markdown-renderer.js`,
  `tools/md2doc.js`, migrations, visitor frontend pages, SEO, release scripts,
  current database/runtime data, or protected runtime paths.
- Do not create or run database migrations.
- Do not stage, commit, push, deploy, or roll back.
- Stop and return to A00 if the workflow cannot be implemented without API,
  database, or visitor frontend changes.

## Done When

- CMS can list, create/update, publish/unpublish, soft-delete/restore, and load
  revisions for knowledge nodes using existing API endpoints.
- Form validation and visible save warnings match A08 behavior.
- Markdown preview handles A09 derive shortcode output or clearly records the
  limitation if the admin renderer cannot reuse it in this slice.
- Existing post/project CMS flows continue to work.
- `powershell -ExecutionPolicy Bypass -File scripts/verify-api.ps1` passes.
- `npm.cmd run test:markdown` passes.
- `npm.cmd run codex:contract` passes.
- The S05 handoff records status, scope, files changed, decisions, risks,
  checks, and next handoff back to A00.
