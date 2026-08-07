# A50 ReleaseGitGateReverification Brief

## Role

Temporary short-task workbench.

Chinese role note:
`发布门禁复核：在新版本同步后重建最终 Git 候选清单`

## Mission

Rebuild the complete live-worktree partition and path-explicit future staging
plan after S41A advanced the candidate to `V2.5.3+20260807-0001`. Decide Git
candidate readiness without executing Git or production operations.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/batch-regression-evidence.md`
- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41_release_git_gate_handoff.md`
- `docs/codex-workline/slices/S41A_release_version_sync_handoff.md`
- `docs/deployment.md`
- `scripts/deploy-update.sh`
- `scripts/backup-linux.sh`
- `scripts/restore-linux.sh`
- `scripts/rollback.sh`

## Allowed Edits

- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md`

## Required Outputs

- complete include/exclude/review-required partition after version sync
- path-explicit future staging commands with set-equality proof
- new-version, regression, backup, rollback, health, and stop-condition decision
- proof that Git index, production, cloud, and runtime data remain unchanged

## Verification

- live status, HEAD/upstream, and empty-index audit
- `npm.cmd run check:version` and `npm.cmd run test:batch-regression`
- plan set equality, diff, strict UTF-8, secret, and Codex contract checks

## Forbidden

- files outside the declared write set
- feature, version, test, package, runtime, content, governance, or accepted handoff edits
- current/production data, cloud, deployment, service, backup, restore, rollback, or physical cleanup actions
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick

## Handoff

Write `docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md`
in Chinese and return directly to `A00_ProjectDirector`.
