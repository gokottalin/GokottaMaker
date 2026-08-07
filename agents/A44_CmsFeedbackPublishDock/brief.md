# A44 CmsFeedbackPublishDock Brief

## Role

Temporary short-task workbench.

Chinese role note:
`CMS 操作反馈：分级 toast 与右下角可折叠发布栏`

## Mission

Unify CMS save/publish feedback as accessible queued toasts and keep article actions reachable in one collapsible bottom-right dock without creating a second state machine.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-007.json`
- `docs/codex-workline/requirements/active/REQ-20260730-009.json`
- `docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md`
- `docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`

## Allowed Edits

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `scripts/test-cms-floating-feedback-publish-bar.js`
- `scripts/test-formula-authoring-drawer.js`
- `scripts/test-full-site-dark-theme.js`
- `docs/cms-feedback-publish-dock.md`
- `docs/codex-workline/slices/S38_cms_feedback_publish_dock_handoff.md`

You are the only active writer for this list while S38_cms_feedback_publish_dock is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- queued or keyed replacement toasts with transient status and persistent blocking alerts
- one article dirty-state source and one save/publish submit path
- collapsible persistent article dock coordinated with formula drawer, keyboard, and safe area
- field-level errors retained alongside global operation feedback

## Verification

- success, reminder, blocking error, timeout, rapid operation, and out-of-order response fixtures
- top/middle/bottom long-form checks at 1440, 760, and 390 widths in light and dark modes
- geometry proof for dock, drawer, toast, keyboard, and safe-area non-overlap
- keyboard, reduced-motion, dirty-state, formula-drawer, and publication regressions

## Dependencies

- `DISPATCH-20260730-001`
- `S36_derivation_workflow_recovery`
- `S37_formula_map_flow_layout`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- replacing precise field errors with toast-only feedback
- creating a second draft/publication state machine or auto-hiding blocking errors
- editing server, database, content, graph, MD2File, package files, or protected paths

## Handoff

Write `docs/codex-workline/slices/S38_cms_feedback_publish_dock_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
