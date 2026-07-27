# Next Agents

## Next Step For The User

Use this short handoff in a fresh Codex session:

```text
Agent 00 Project Director（项目导演：负责顺序、门禁和下一步裁决）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run codex:handoff，然后按输出的 controller brief 核对当前状态；当前无待派发职能 Agent；若收到新需求，直接交给对应职能 Agent，若不存在则由 A00 创建并注册后继续；使用中文交接，遵守 AGENTS.md 门禁。
```

Current controller: `A00_ProjectDirector`.

S12 has been accepted. The automatic functional-Agent queue is complete.
There is no pending functional Agent.

Source/test changes, current/production data, cloud, deployment, restore,
rollback, staging, commit, and push remain closed until separately authorized.

The detailed task contract lives in:

- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/release_gate_plan.md`
- `docs/codex-workline/git_staging_plan.md`
- `agents/A00_ProjectDirector/brief.md`

## Confirmed Queue

After each handoff is accepted by A00, open exactly one next workbench:

No implementation Agent follows A17. A00 has accepted the final handoff.

A00 must not execute staging or release without a new explicit authorization.
The Owner does not need to relay any completed handoff or type "继续".

Each routed brief must be dispatched directly to its matching functional Agent.
If the functional Agent does not exist, A00 creates and registers a narrow
temporary Agent and dispatches the brief immediately. Missing Agent definitions
must never be used as a reason to stop or return relay text to the Owner.
