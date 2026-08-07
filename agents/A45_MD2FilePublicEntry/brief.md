# A45 MD2FilePublicEntry Brief

## Role

Temporary short-task workbench.

Chinese role note:
`MD2File 公开入口：三处唯一展示与聚焦模式精确例外`

## Mission

Expose exactly one MD2File card on the brand home, Maker home, and miniapp center while retaining all other tool code and allowing only precise focus-mode routes.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-011.json`
- `docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md`
- `docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md`
- `docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md`
- `data/miniapps.js`
- `index.html`
- `maker.html`
- `miniapps.html`
- `main.js`
- `site-layout.js`
- `server.js`
- `lib/seo.js`

## Allowed Edits

- `data/miniapps.js`
- `index.html`
- `maker.html`
- `miniapps.html`
- `main.js`
- `site-layout.js`
- `server.js`
- `scripts/test-focus-mode.js`
- `scripts/test-md2file-public-entry.js`
- `docs/md2file-public-entry.md`
- `docs/codex-workline/slices/S39_md2file_public_entry_handoff.md`

You are the only active writer for this list while S39_md2file_public_entry is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- one MD2File card at each required public location with one canonical tool URL
- public projection that hides other tools without deleting registry data, code, or assets
- precise focus-mode route exceptions for the center, MD2File assets, and conversion endpoint
- layout configuration unable to hide the required MD2File exception

## Verification

- three locations by focus on/off by 1280/800/390 browser matrix
- exactly one MD2File card, zero other public tool cards, and successful tool navigation
- precise-route denial tests proving other tools remain blocked in focus mode
- shared MD2File renderer, focus mode, layout, syntax, and accessibility regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S31_carousel_slot_authority`
- `S32_focused_cover_reverification`
- `S34_md2file_renderer_parity`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- deleting hidden tools or broadly allowing /tools/
- creating a second MD2File implementation or changing its formal name
- editing lib/seo.js, styles/20-content.css, package files, or formula/CMS files

## Handoff

Write `docs/codex-workline/slices/S39_md2file_public_entry_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
