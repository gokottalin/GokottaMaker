# A33 Batch Regression Evidence Brief

## Role

Temporary batch-wide regression, browser acceptance, and evidence workbench.

Chinese role note:
`批次回归证据：复测九项已确认需求，形成可重复、可追溯的发布前证据。`

## Mission

Verify the accepted implementation for `DISPATCH-20260728-001` across S18-S26.
Run the complete deterministic, API, migration, CMS, public-page, formula,
graph, Markdown, media, responsive, and theme matrix in isolated environments.
Produce one concise evidence report that maps every requirement to commands,
browser observations, protected boundaries, and residual risks.

This is a verification slice. Do not repair business code in place. If any
required check fails, preserve the exact failure evidence, mark the handoff
blocked, and return it to A00 so a narrow fix Agent can be assigned.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- all nine `docs/codex-workline/requirements/active/REQ-20260728-*.json`
- accepted handoffs `S18` through `S26`
- `package.json`
- `scripts/verify-api.ps1`
- all dedicated `scripts/test-*` files introduced or changed by S18-S26
- `agents/A33_BatchRegressionEvidence/brief.md`

## Allowed Edits

- `scripts/run-batch-regression-evidence.js`
- `docs/batch-regression-evidence.md`
- `docs/codex-workline/slices/S27_batch_regression_evidence_handoff.md`

You are the only active writer for these three files during S27. All product,
CMS, server, data-model, migration, theme, content, and governance files are
read-only.

## Evidence Contract

- Map `REQ-20260728-001` through `REQ-20260728-009` to accepted slices,
  dedicated commands, browser scenarios, and outcomes.
- Run tests only against disposable or isolated `DATA_DIR` state. Never use or
  mutate the current or production database.
- Include formula publication, branching DAG, authoring drawer, legacy
  migration dry-run/restore/cleanup proof, cover coordinates, reading minutes,
  inline math, focused media, and full-site dark theme.
- Include API/CMS/public behavior, Markdown, calculation-book, formula-catalog,
  focus-mode, carousel-buffer, JavaScript syntax, UTF-8/BOM, whitespace,
  protected-hash, and governance-contract evidence.
- Browser-test representative public and CMS workflows at desktop, half-width,
  and mobile. Include light/dark, no-overlap, no-horizontal-overflow, and
  console/network observations.
- Separate proven facts from residual risks. Do not claim coverage that was not
  actually executed.

## Verification

- Run `node scripts/run-batch-regression-evidence.js` after creating the
  repeatable command runner.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
  against its isolated test environment.
- Run `npm.cmd run codex:contract`.
- Confirm the report and handoff are UTF-8 without BOM and contain no secrets,
  session tokens, passwords, database copies, screenshots, or bulky logs.

## Forbidden

- Editing any business, CMS, server, migration, style, content, package,
  governance, or previously accepted S18-S26 file.
- Fixing a failed regression inside S27.
- Current/production data, physical legacy cleanup, cloud, deployment,
  restore, rollback, Git staging, commit, push, or branch/remote changes.
- Recording credentials, CSRF tokens, cookies, database contents, or user data
  in evidence artifacts.

## Handoff

Write `docs/codex-workline/slices/S27_batch_regression_evidence_handoff.md` in
Chinese with status, requirement-to-evidence matrix, exact commands and
outcomes, browser matrix, protected boundaries, failures or residual risks,
files written, and direct `next_handoff` to `A00_ProjectDirector`.
