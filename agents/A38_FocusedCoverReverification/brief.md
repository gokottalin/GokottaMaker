# A38 FocusedCoverReverification Brief

## Role

Temporary short-task workbench.

Chinese role note:
`聚焦封面复验：先复现真实页面，再最小修复卡片容器 cover`

## Mission

Re-test the real focused homepage path and make the smallest required cover-fill repair without inheriting Hero ratio or crop behavior.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-002.json`
- `docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md`
- `docs/codex-workline/slices/S25_focused_content_media_handoff.md`
- `maker.html`
- `main.js`
- `data/media.js`
- `styles/27-focused-content-media.css`
- `scripts/test-focused-content-media.js`

## Allowed Edits

- `main.js`
- `data/media.js`
- `styles/27-focused-content-media.css`
- `scripts/test-focused-content-media.js`
- `docs/focused-content-media.md`
- `docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md`

You are the only active writer for this list while S32_focused_cover_reverification is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- real-page evidence that focused covers fill their responsive card hosts without distortion or blank bands
- saved crop focus replay when present and centered cover fallback otherwise
- unchanged Hero-specific ratio and crop policy

## Verification

- real maker.html checks at 1280, 800, and 360 widths using multiple source ratios
- computed host/image geometry, no overflow, no console error, and unchanged Hero evidence
- focused-media and post-cover-coordinate regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S31_carousel_slot_authority`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- product edits before a real-page failure is reproduced
- fixed 16:9 focused cards, original-image overwrite, Hero changes, CMS changes, or database changes

## Handoff

Write `docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
