# A52 Formula Identity Automation Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公式技术标识自动化：服务端生成唯一标识并简化 CMS 建卡表单`

## Mission

Implement `REQ-20260812-001` so formula authors never enter or modify
`formulaId` or `slug`. Use one server-owned deterministic identity allocator
for direct CMS creation and article-selection creation, preserve every legacy
identity, and expose generated values only in a read-only technical section
with separate copy actions.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260812-001.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260812-001.json`
- `docs/codex-workline/implementation_slices.json`
- `agents/A52_FormulaIdentityAutomation/brief.md`

## Allowed File Edits

- `server.js`
- `lib/validators.js`
- `lib/content.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-formula-identity-automation.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-reference-versioning.js`
- `scripts/test-linear-derivation-graph.js`
- `package.json`
- `docs/codex-workline/slices/S43_formula_identity_automation_handoff.md`

## Required Behavior

1. Direct create and article-selection create call the same server-owned
   deterministic allocator based on normalized name, module, category, and
   formula content. Collision suffixing must be stable and executed inside the
   existing SQLite transaction/unique constraints.
2. Direct create accepts only business fields. Update identifies the existing
   card through the route, never through editable payload identity.
3. Ordinary create/update requests containing `formulaId`, `formula_id`, or
   `slug` are rejected with a clear 400 reason; internal import/migration
   functions remain compatible.
4. Existing cards never change identity or public URL when business fields or
   revisions are saved.
5. The create form has no identity controls, labels, placeholders, validation,
   hidden inputs, or keyboard focus targets.
6. After creation and while editing, a technical information section shows
   both values as selectable read-only text with separate copy buttons and
   success/fallback feedback.

## Verification

- `node --check server.js`
- `node --check lib/validators.js`
- `node --check lib/content.js`
- `node --check admin/admin.js`
- `node scripts/test-formula-identity-automation.js`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-catalog`
- `npm.cmd run test:formula-reference-versioning`
- DOM/browser verification for create focus order, generated technical info,
  two copy actions, half-width desktop, and mobile.
- `npm.cmd run codex:contract`

## Forbidden

- files outside the allowed edit list
- migrations or rewriting any historical formula identity
- current or production database mutation
- cloud writes, deployment, service restart, backup, restore, or rollback
- Git staging, commit, push, branch, remote, or destructive Git operations
- reverting unrelated existing edits or historical untracked files

## Handoff

Write `docs/codex-workline/slices/S43_formula_identity_automation_handoff.md`
in Chinese and return directly to `A00_ProjectDirector`.
