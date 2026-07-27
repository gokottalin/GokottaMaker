# A22 Focus Mode Scope Gate Brief

## Role

Temporary global focus-mode visibility and authoring gate workbench.

Chinese role note: `全站聚焦门禁：用唯一开关同时限制游客展示和 CMS 写作范围`.

## Objective

Implement `REQ-20260726-001` as one server-authoritative, default-enabled,
persistent focus state shared by visitor pages and CMS. Focus mode exposes only
electronics basics, formula derivations, and open-source projects; disabling it
restores all existing categories without changing content publication state.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260726-001.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- `docs/codex-workline/slices/S06_public_derivation_and_focus_mode_handoff.md`
- Accepted S09, S13, S14, and S15 handoffs
- Focus setting, public/admin payload, post/project lookup, navigation, CMS, and
  API verification code

## Allowed Outputs

- `migrations/018_focus_mode_scope_gate.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/content-store.js`
- `main.js`
- `post.js`
- `category-page.js`
- `maker.html`
- `post.html`
- `project.html`
- `derive.html`
- `scripts/verify-api.ps1`
- `scripts/test-focus-mode.js`
- `package.json`
- `docs/codex-workline/slices/S16_focus_mode_scope_gate_handoff.md`

Do not implement carousel buffering, formula catalog behavior, content deletion,
cloud/deployment, current data mutation, or Git operations.

## Scope Decision

The canonical allowed focus modules are:

- `electronics-basics`
- `derivations`
- `projects`

Existing `power-electronics` URLs and metadata are compatibility aliases for
`electronics-basics`. This is a focus taxonomy and does not create, rename, or
delete a stored business category.

## Gate Contract

- One global server setting is the only source of truth. Fresh isolated data
  defaults to enabled; Owner changes persist across restart.
- Legacy unconfigured focus data may be normalized to enabled. Never overwrite
  a setting explicitly saved by Owner.
- CMS exposes one clear switch with current state and an explicit warning that
  disabling immediately republishes all previously published non-focus content.
- Public API payloads, navigation, homepage, category lists, search, sitemap,
  and direct post/project/detail lookup enforce the same scope. A hidden direct
  detail lookup returns 404 without disclosing content.
- When enabled, CMS lists and selectors hide non-focus content and server APIs
  reject direct create/update attempts outside the allowed scope.
- When disabled, all categories and previously published content return
  immediately; drafts return only in CMS and remain drafts.
- Re-enabling never deletes content or changes publication state.
- Focus homepage order is electronics basics, derivations, projects, with the
  first as the primary action and no forced redirect.

## Verification

- Use a new isolated `DATA_DIR` with allowed and disallowed published/draft
  fixtures.
- Prove fresh default, one switch, persistence after restart, server-side direct
  URL denial, CMS list/write gates, focused homepage order, disable restore, and
  re-enable preservation.
- Verify desktop, mobile, and half-width CMS without overlap or mojibake.
- Run node syntax, API, sitemap/SEO, all formula workflows, Markdown, and
  contract regressions.

## Handoff

Write `docs/codex-workline/slices/S16_focus_mode_scope_gate_handoff.md` with
the standard fields plus scope mapping, reason codes, state-transition matrix,
public/CMS counts, direct-route evidence, restart evidence, and next handoff to
A00.
