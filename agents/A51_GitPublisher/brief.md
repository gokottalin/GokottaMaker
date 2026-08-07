# A51 GitPublisher Brief

## Role

Temporary short-task workbench.

Chinese role note:
`Git 发布执行：精确暂存、提交并推送已验收的新版本候选`

## Mission

Publish the accepted `V2.5.3+20260807-0001` candidate to `origin/main` using
only the path-explicit candidate set regenerated after A51 registration. This
workbench may execute the authorized Git writes, but it may not deploy or
touch production, cloud services, runtime data, credentials, or remotes.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md`
- `docs/codex-workline/slices/S42_git_publish_handoff.md`

## Allowed File Edits

- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S42_git_publish_handoff.md`

## Authorized Git Writes

- explicit `git add -- <path...>` commands generated from the final include set
- one release commit and, if needed, one governance-closure commit
- push the current local `main` to its existing `origin/main` upstream only

## Required Execution

1. Rebuild the live path partition after A51 governance registration.
2. Require zero review paths and prove staging commands equal the include set.
3. Stage only explicit include paths; keep every exclude path unstaged.
4. Verify cached diff, version, full regression, secrets, encoding, and contract.
5. Commit with release identity `V2.5.3+20260807-0001`.
6. Confirm remote fast-forward safety immediately before pushing `main`.
7. Leave production deployment closed and return terminal evidence to A00.

## Forbidden

- `git add .`, `git add -A`, or broad directory staging
- staging any `docs/Agent*`, `lib/seo.js`, or `styles/20-content.css` exclusion
- branch creation, remote changes, force push, reset, checkout, clean, stash,
  merge, rebase, cherry-pick, tag, or history rewriting after push
- current or production data, cloud, deployment, service, backup, restore,
  rollback, credential, upload, database, or physical cleanup operations
- product, version, feature, test, package, migration, or accepted handoff changes

## Handoff

Maintain `docs/codex-workline/slices/S42_git_publish_handoff.md` in Chinese and
return the Git evidence directly to `A00_ProjectDirector`.
