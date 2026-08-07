# A48 ApiVerifyRedirectedOutput Brief

## Role

Temporary short-task workbench.

Chinese role note:
`API 验证重定向兼容：修复 Node 捕获下 PowerShell/curl UTF-8 响应解析`

## Mission

Make `scripts/verify-api.ps1` deterministic when Windows PowerShell is launched
with redirected output by Node. Preserve the API assertions and product code;
only remove the native-output encoding dependency in `Invoke-CurlJson`.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md`
- `docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md`
- `scripts/verify-api.ps1`
- `scripts/run-batch-regression-evidence.js`
- `scripts/test-md2file-docx-semantics.js`

## Allowed Edits

- `scripts/verify-api.ps1`
- `scripts/test-api-verify-redirected-output.js`
- `docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md`

You are the only active writer for this list while
`S40A_api_verify_redirected_output` is open. Preserve all unrelated and
pre-existing changes.

## Required Outputs

- `curl.exe` writes the response body to a temporary file instead of returning
  UTF-8 JSON through the redirected native stdout decoding path
- the response body is read explicitly as UTF-8 and temporary request/response
  files are removed on success and failure
- a Node-spawned PowerShell regression proves the full isolated API verifier
  returns success with redirected stdout/stderr
- API expectations, product code, current data, and production data stay unchanged

## Verification

- `node scripts/test-api-verify-redirected-output.js`
- direct isolated `scripts/verify-api.ps1` execution
- `node --check scripts/test-api-verify-redirected-output.js`
- `npm.cmd run codex:contract`

## Forbidden

- files outside the three declared paths
- weakening or removing any API assertion
- product, CMS, server, renderer, migration, content, style, or package changes
- current or production data mutation, cloud writes, deployment, service restart,
  restore, rollback, or physical cleanup
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash,
  merge, rebase, or cherry-pick

## Handoff

Write `docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md`
in Chinese with `status`, `scope_completed`, `files_created_or_changed`,
`decisions`, `risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`.
