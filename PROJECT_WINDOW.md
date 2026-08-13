# Project Window

This file is the reserved top-level window for new Codex sessions. Keep it short, pointer-only, and current.

## Active Window

- Current phase: `DISPATCH-20260813-002_S55_Release_Active`
- Current controller: `agents/A00_ProjectDirector/brief.md`
- Next agent: `agents/A64_FinalGitPublisher/brief.md`
- Confirmed requirement dispatch: `docs/codex-workline/requirements/dispatch/DISPATCH-20260813-002.json`
- Active task registry: `docs/codex-workline/task_registry.json`

## Status Slots

- Product target: LarkixMaker website and local content/CMS runtime.
- Current work target: S55 must refresh the exact manifest, stage only accepted paths, commit and fast-forward push the V2.5.4 candidate, then verify the remote SHA from a fresh clone.
- Current gate: A64 has limited Git authority for exact pathspec staging, one release commit and one optional governance-closure commit; force push, history rewrite, branch/remote changes, data, deployment and secrets remain closed.
- Confirmed queue: A64 now; then A00 final acceptance. Production deployment remains separate.
- Closed boundaries: version changes, current/production data, cloud, deployment, restore, rollback, migrations, broad staging, force push, history rewrite, and every Git operation outside the exact S55 authority.
- Last accepted handoff: `docs/codex-workline/slices/S54_final_candidate_gate_handoff.md`.
- Last updated: 2026-08-13

## Do Not Put Here

- Detailed architecture
- Long Agent history
- Research notes
- Runtime secrets or database data
- Generated logs, screenshots, or bulky evidence
