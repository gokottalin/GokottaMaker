# A60 FinalRepositoryManifest Brief

## Role

Temporary short-task workbench.

Chinese role note:
`最终仓库清单：逐项归类脏工作树并建立安全、完整、显式的 Git 候选清单`

## Mission

Audit every tracked change, untracked path, ignored path, large file, runtime
artifact, historical document, and secret-risk path. Produce a complete
include/exclude/review partition for the final repository without performing
any Git write.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260813-001.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260813-002.json`
- `docs/codex-workline/slices/S50_security_regression_evidence_handoff.md`
- `docs/git-staging-plan-20260730.md`
- `docs/release-git-gate-20260730.md`

## Allowed Edits

- `docs/final-git-manifest-20260813.json`
- `docs/final-repository-audit-20260813.md`
- `docs/codex-workline/slices/S51_final_repository_manifest_handoff.md`

## Done When

- every live `git status` path appears exactly once as include, exclude, or review
- every include path has ownership and reason; every exclude path has a safe reason
- secrets, runtime data, generated artifacts, large files, and absolute paths are audited
- the candidate set includes all accepted product, tests, migrations, templates, requirements, governance, and handoffs
- Git index, branch, remote, product files, version, data, and services are unchanged

## Forbidden

- files outside the declared write set
- Git staging, commit, push, branch, remote, stash, reset, clean, checkout, merge, or rebase
- product, version, environment, database, upload, service, deployment, or secret changes

## Handoff

Write the S51 handoff in Chinese and return directly to A00.
