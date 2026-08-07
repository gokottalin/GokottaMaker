# A47 ReleaseGitGate Brief

## Role

Temporary short-task workbench.

Chinese role note:
`发布与 Git 门禁：盘点新批次差异并形成显式候选清单`

## Mission

Review the accepted batch, classify every live path, and produce a version, backup, rollback, health, and path-explicit Git readiness decision without executing Git or production actions.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md`
- `docs/batch-regression-evidence.md`
- `docs/deployment.md`
- `scripts/deploy-update.sh`
- `scripts/backup-linux.sh`
- `scripts/restore-linux.sh`
- `scripts/rollback.sh`

## Allowed Edits

- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41_release_git_gate_handoff.md`

You are the only active writer for this list while S41_release_git_gate is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- complete include, exclude, and review-required worktree partition
- path-explicit future staging commands without executing them
- version, backup, rollback, service health, and stop-condition decision
- proof that Git, production, cloud, and runtime data were unchanged

## Verification

- live status and staged-index audit
- version, batch regression, diff, encoding, secret, and Codex contract checks
- cross-check every candidate and exclusion against accepted ownership

## Dependencies

- `DISPATCH-20260730-001`
- `S40_batch_regression_evidence`
- `A00 acceptance of S40`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- editing product, test, package, content, migration, governance, or accepted implementation files
- executing any Git write or production operation

## Handoff

Write `docs/codex-workline/slices/S41_release_git_gate_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
