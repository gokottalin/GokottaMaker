# A40 MD2FileRendererParity Brief

## Role

Temporary short-task workbench.

Chinese role note:
`MD2File 渲染一致性：预览与 DOCX 共用最新 Markdown 和数学语义`

## Mission

Make MD2File import, paste, edit, preview, validation, and DOCX export consume the accepted shared Markdown and math contract without silently dropping content.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-012.json`
- `docs/codex-workline/slices/S30_shared_math_rendering_handoff.md`
- `data/math-renderer.js`
- `data/markdown-renderer.js`
- `tools/md2doc.html`
- `tools/md2doc.js`
- `styles/md2doc.css`
- `lib/md2doc.js`
- `server.js`

## Allowed Edits

- `tools/md2doc.html`
- `tools/md2doc.js`
- `styles/md2doc.css`
- `lib/md2doc.js`
- `server.js`
- `scripts/test-md2file-docx-semantics.js`
- `scripts/verify-api.ps1`
- `docs/md2file-renderer-parity.md`
- `docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md`

You are the only active writer for this list while S34_md2file_renderer_parity is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- identical heading, paragraph, list, table, image, link, code, and math semantics in preview and DOCX
- compact boxed formulas and correct roots, scripts, fractions, and display delimiters
- located blocking diagnostics that disable misleading export
- no independent browser-only legacy parser

## Verification

- one fixed long-form fixture compared across browser DOM and DOCX XML
- invalid Markdown/LaTeX 422 diagnostics with export blocked
- image and link security checks with no arbitrary server-side remote fetch
- shared Markdown/math, API, DOCX, and syntax regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S30_shared_math_rendering`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- editing data/markdown-renderer.js or shared math files owned by accepted S30
- formula-card database links in standalone DOCX, silent content loss, or arbitrary remote image fetching
- editing styles/20-content.css or package.json

## Handoff

Write `docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
