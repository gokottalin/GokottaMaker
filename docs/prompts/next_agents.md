# Next Agent

## Automatic Dispatch

A00 dispatches the current short task directly. The Owner does not need to
copy or relay this prompt.

```text
Agent 00 Project Director（项目导演：负责顺序、门禁和下一步裁决）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run codex:handoff 核验路由，然后执行 agents\A00_ProjectDirector\brief.md；使用中文交接，遵守 AGENTS.md 门禁。
```

Current controller: `A00_ProjectDirector`.

The nine Owner-confirmed 2026-07-28 requirement packages remain governed by
`DISPATCH-20260728-001`. S18 through S28 are accepted. There is no current
short-task Agent; routing returns to `A00_ProjectDirector`.

The S28 historical plan classified 216 paths. The authorized V2.5.2 release
candidate now contains 121 include paths, 107 exclusions, and zero
review-required paths after the 12-path version synchronization.

Current/production data, physical legacy cleanup, cloud, deployment, restore,
and rollback remain closed. Owner has authorized A00 to stage, commit, and push
the reviewed V2.5.2 candidate only.

The detailed contract lives in:

- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S28_release_git_gate_handoff.md`
- `docs/release-git-gate-20260728.md`
- `docs/git-staging-plan-20260728.md`

## Confirmed Queue

1. A24 formula publication workflow. Accepted.
2. A26 branching derivation graph. Accepted.
3. A27 formula authoring drawer. Accepted.
4. A28 isolated legacy migration and cleanup proof. Accepted.
5. A29 post cover coordinates. Accepted.
6. A30 reading minutes and A31 inline-math layout. Accepted.
7. A25 focused-content media fit. Accepted.
8. A32 full-site dark theme. Accepted.
9. A33 batch regression evidence. Accepted.
10. A34 release and Git gate. Accepted.

A35 physical legacy cleanup remains outside the automatic queue until a fresh
current/production backup and independent restore rehearsal pass, A00 presents
the exact report digest and affected rows, and the Owner explicitly authorizes
the irreversible apply operation.

The automatic queue is complete. A00 may open new work only after a confirmed
requirement package or explicit Owner authorization. Git staging/commit/push,
production deployment, and S29 cleanup remain closed.

Each routed brief is dispatched directly to its matching functional Agent. If
an Agent definition is missing, A00 creates and registers the narrow temporary
Agent before dispatch. Missing Agent definitions never stop the queue or create
manual relay work for the Owner.
