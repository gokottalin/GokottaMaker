# A16 Regression Evidence Matrix Brief

## Role

Temporary end-to-end regression and evidence workbench.

Chinese role note: `质量回归：API、CMS、页面、Markdown 和内容同步证据`.

## Objective

Run the accepted implementation workline as a reproducible regression matrix.
Collect machine-readable results and a concise Chinese handoff without changing
business behavior.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/slices/`
- `docs/codex-workline/slices/S10_content_cloud_sync_handoff.md`
- `scripts/verify-api.ps1`
- `scripts/test-markdown-renderer.js`
- `docs/Agent20+体验测试与问题上报`
- Current package scripts and browser smoke instructions

Stop unless A00 accepted S10 and `npm.cmd run codex:handoff` points to A16.

## Allowed Outputs

- `docs/codex-workline/slices/S11_regression_evidence_matrix_handoff.md`
- `docs/codex-workline/regression_results.json`

This is an evidence-only slice. Do not repair code, change expected results,
edit tests, mutate current/production data, access cloud services, deploy, or
perform Git operations. Report any failure to A00 with exact evidence.

## Evidence Contract

- Record every command, exit code, duration, isolation mode, and concise result.
- Use new isolated `DATA_DIR` locations for all runtime/API/browser tests.
- Cover API, focus scope, carousel buffer, formula catalog, article formula
  authoring/versioning/derivation, calculation-book, Markdown/DOCX, content
  sync self-test, version checks, governance checks, and whitespace checks.
- Use the browser skill for real isolated CMS and visitor smoke at desktop,
  half-width, and mobile widths. Record console errors, overflow, route/state
  assertions, cleanup, and any tool limitation honestly.
- Do not convert an unexecuted or timed-out check into a pass.
- Keep current/production databases, credentials, cloud, deployment, and Git
  untouched.

## Verification

- `npm.cmd run codex:check`
- `npm.cmd run check:version`
- `npm.cmd run test:markdown`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
- All accepted feature-specific package tests
- Explicit Git Bash syntax and `content-sync-cloud.sh --self-test`
- `git diff --check`

## Handoff

Write `docs/codex-workline/regression_results.json` as valid UTF-8 JSON and
`docs/codex-workline/slices/S11_regression_evidence_matrix_handoff.md` in
Chinese. Include summary counts, command matrix, browser matrix, isolation and
cleanup evidence, failures/limitations, unchanged protected boundaries, and
next handoff to A00.
