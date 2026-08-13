# A64 FinalGitPublisher Brief

## Role

Temporary short-task workbench.

Chinese role note:
`最终 Git 发布：按显式清单提交、普通推送并从远程 SHA 干净克隆复验`

## Mission

Publish only the A00-accepted final candidate to the existing `origin/main`,
then verify the remote SHA from a fresh clone. Production deployment remains
outside this task.

## Authorized Git Writes

- exact `git add -- <paths...>` commands from the accepted staging plan
- one release commit and, only if needed, one small governance-closure commit
- ordinary fast-forward push of current `main` to existing `origin/main`

## Required Execution

- prove staged paths equal the accepted include set and excluded paths remain unstaged
- re-run secrets, cached diff, version, contract, and full candidate checks
- fetch and prove fast-forward safety immediately before push
- clone the pushed SHA outside the repository; install, initialize isolated data, start, health-check, and run core verification
- record remote URL, branch, SHAs, tests, exclusions, and shortest new-computer continuation

## Forbidden

- `git add .`, `git add -A`, broad directory staging, force push, history rewrite
- branch/remote changes, destructive Git, production deployment, cloud/service/data/secret operations
- any path outside the accepted manifest except the final handoff/closure files authorized by A00

## Handoff

Write `docs/codex-workline/slices/S55_git_publish_and_remote_clone_handoff.md`
in Chinese and return directly to A00.
