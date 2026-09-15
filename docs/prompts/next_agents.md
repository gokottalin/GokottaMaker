# Next Agents

## Automatic Dispatch

S64 is accepted and published at `50859b51d492c082466b9287987daa7ce35b7eda`.
S65 is the only open execution task; S66 and S67 remain closed until A00
acceptance. Git, production, data, cloud, migration, version, and service gates
remain closed for the execution Agent.

Agent 00 Project Director remains the only long-lived controller. Historical
accepted baseline: `DISPATCH-20260813-002`.

```text
Agent 75 Public Search Home Composition（公开搜索与首页编排）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run --silent codex:bootstrap 核验 S65 路由，然后执行 agents\A75_PublicSearchHomeComposition\brief.md；严格遵守 may_edit，完成后直接回传 A00。
```

当需求已经由 Owner 确认，并且当前会话判定必须转入新会话时，当前会话必须运行
`npm.cmd run --silent codex:launch`，在同一回复的 `新会话启动语` 下原样发出输出。
需要诊断完整路由时运行 `npm.cmd run --silent codex:handoff`。

Current controller: `A00_ProjectDirector`. Current execution task: `A75_PublicSearchHomeComposition` / S65.

Release commit `68bc822` is published on `origin/main`. Version
`V2.5.5+20260911-0001`, contract `1238/0/0`, and formula regression `15/15` passed.

## Queue

1. S64: accepted by A00 and published to origin/main.
2. S65: active, only open execution task.
3. S66 and S67: closed pending S65 completion and A00 acceptance.
4. Production deployment: separate explicit authority; closed.
