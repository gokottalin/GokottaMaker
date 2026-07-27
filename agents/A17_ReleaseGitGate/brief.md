# A17 Release Git Gate Brief

## Role

Temporary release-readiness and explicit Git staging-plan workbench.

Chinese role note: `发布与 Git 门禁：显式清单、备份、回滚和发布判断`.

## Objective

After A00 accepts S11, turn the verified dirty worktree into an explicit,
reviewable release decision and staging plan. This slice plans gates only; it
does not stage, commit, push, deploy, restore, or roll back.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `git status --short --branch`
- `git diff --stat`
- `docs/codex-workline/regression_results.json`
- `docs/codex-workline/slices/S11_regression_evidence_matrix_handoff.md`
- `docs/deployment.md`
- `scripts/deploy-update.sh`
- `scripts/rollback.sh`
- `scripts/backup-linux.sh`
- `scripts/restore-linux.sh`
- `docs/Agent101-Git`
- `docs/Agent1+运维与发布稳定性`

Stop unless A00 accepted S11 and `npm.cmd run codex:handoff` points to A17.

## Allowed Outputs

- `docs/codex-workline/release_gate_plan.md`
- `docs/codex-workline/git_staging_plan.md`

Do not change source code, tests, content, runtime data, deployment scripts, Git
index, commits, branches, remotes, cloud state, or production systems.

## Planning Contract

- Inventory every changed/untracked path and group it by accepted slice,
  governance/Agent definition, generated evidence, protected exclusion, or
  unrelated pre-existing work.
- Produce an explicit allowlist of paths suitable for a future intentional
  staging command; never use `git add .`.
- Produce an explicit exclusion list for databases, runtime data, uploads,
  logs, secrets, temporary files, and any unrelated or ambiguous path.
- Check regression status, version, whitespace, backup prerequisites, rollback
  commands, deployment health checks, and remaining production limitations.
- A "ready" decision means ready for a separately authorized staging/release
  action, not that staging, commit, push, deploy, or rollback is authorized now.
- If path ownership is ambiguous, mark it review-required instead of silently
  including or excluding it.

## Verification

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`
- `npm.cmd run codex:check`
- JSON validation of `docs/codex-workline/regression_results.json`
- Cross-check every staging-plan path against the live worktree

## Handoff

Write both allowed Markdown files in Chinese. `release_gate_plan.md` is the S12
handoff and must include release decision, evidence, backup/rollback/health
gates, stop conditions, protected boundaries, and return to A00.
`git_staging_plan.md` must include explicit include/exclude/review-required
lists and safe future commands without executing them.
