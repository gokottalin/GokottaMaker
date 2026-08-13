# Final Git Staging Plan 20260813

Candidate: `V2.5.4+20260814-0001`

This plan contains 11 exact pathspecs. It deliberately does not use wildcard or repository-wide staging. A64 must revalidate the manifest against live status before using it.

```powershell
$paths = @(
  '.codex/larkix-governance.json',
  'docs/codex-workline/implementation_slices.json',
  'docs/codex-workline/requirements/dispatch/DISPATCH-20260813-002.json',
  'docs/codex-workline/slices/S55_git_publish_and_remote_clone_handoff.md',
  'docs/codex-workline/task_registry.json',
  'docs/final-git-manifest-20260813.json',
  'docs/final-git-staging-plan-20260813.md',
  'docs/final-release-gate-20260813.md',
  'docs/final-repository-audit-20260813.md',
  'docs/prompts/next_agents.md',
  'PROJECT_WINDOW.md'
)

git add -- $paths
```

After staging, A64 must prove that `git diff --cached --name-only` equals this array exactly and that every excluded path remains unstaged.
