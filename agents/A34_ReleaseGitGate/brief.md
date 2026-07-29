# A34 Release Git Gate Brief

## Role

Temporary release-readiness and Git staging-plan workbench.

Chinese role note:
`发布与 Git 门禁：盘点工作树，形成精确文件清单并裁决是否具备后续发布条件。`

## Mission

Review the accepted S18-S27 batch without changing source code, runtime data,
Git state, cloud state, or production systems. Inventory the live dirty
worktree, map relevant paths to accepted slices, separate protected or
unrelated work, and produce a truthful release-readiness decision plus an
explicit future staging plan for A00 and the Owner.

This is an advisory gate. A `ready` result means only that a later, separately
authorized Git action can use the written allowlist. It never authorizes
staging, commit, push, deployment, restore, rollback, or production mutation.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/batch-regression-evidence.md`
- `docs/codex-workline/slices/S27_batch_regression_evidence_handoff.md`
- accepted S18-S26 handoffs
- `package.json`
- `docs/deployment.md`
- `scripts/deploy-update.sh`
- `scripts/backup-linux.sh`
- `scripts/restore-linux.sh`
- `scripts/rollback.sh`
- `docs/Agent101-Git`
- `docs/Agent1+运维与发布稳定性`

Read-only inspection commands may include:

- `git status --short --branch`
- `git diff --stat`
- `git diff --name-status`
- `git diff --check`
- `git ls-files --others --exclude-standard`
- `git log -1 --oneline`
- `npm.cmd run check:version`
- `npm.cmd run codex:contract`

## Allowed Edits

- `docs/release-git-gate-20260728.md`
- `docs/git-staging-plan-20260728.md`
- `docs/codex-workline/slices/S28_release_git_gate_handoff.md`

You are the only active writer for these three files during S28. Every source,
test, content, migration, package, governance, runtime-data, and previously
accepted file is read-only.

## Planning Contract

- Inventory every changed and untracked path visible in the live worktree.
- Group paths as `include`, `exclude`, or `review-required`.
- Map each included path to an accepted slice, governance artifact, test, or
  evidence output. Do not infer ownership when evidence is missing.
- Exclude databases, runtime data, uploads, logs, secrets, temporary files,
  generated browser artifacts, and unrelated pre-existing work.
- Record the exact protected dirty files that must not be overwritten,
  reverted, or silently included.
- Check version metadata, release evidence, whitespace, backup prerequisites,
  rollback entrypoints, service restart, and health-check expectations.
- Write future path-explicit staging commands only. Never use or recommend
  `git add .`.
- Mark the decision `blocked` when any path cannot be classified safely or a
  mandatory backup/version/rollback prerequisite is absent.

## Verification

- Cross-check every listed path against live `git status`.
- Confirm all three output files are UTF-8 without BOM and contain no secrets.
- Run `git diff --check` and `npm.cmd run codex:contract`.
- Confirm the Git index, branch, remotes, commits, cloud, and services remain
  unchanged.

## Forbidden

- Editing product code, tests, content, migrations, package files, accepted
  handoffs, or governance files.
- `git add`, `git commit`, `git push`, branch creation/switching, remote
  changes, reset, checkout, clean, stash, merge, rebase, or cherry-pick.
- Deployment, service restart, production health calls, backup execution,
  restore, rollback, current/production data access, or legacy cleanup.
- Recording credentials, tokens, cookies, database contents, or user data.

## Handoff

Write the three allowed Markdown files in Chinese. The S28 handoff must include
the release-readiness decision, exact include/exclude/review-required counts,
version and rollback findings, unresolved blockers, files written, proof that
Git and production state were unchanged, and direct `next_handoff` to
`A00_ProjectDirector`.
