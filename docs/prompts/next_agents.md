# Next Agents

## Automatic Dispatch

A00 dispatches the current short task directly. The Owner does not need to copy or relay this prompt.

```text
Agent 51 Git Publisher（Git 发布执行：精确暂存、提交并推送已验收的新版本候选）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run codex:handoff 核验路由，然后执行 agents\A51_GitPublisher\brief.md；使用中文交接，完成后直接回传 A00。
```

Current controller: `A00_ProjectDirector`. Confirmed dispatch: `DISPATCH-20260730-001`.

S41B accepted `V2.5.3+20260807-0001` with 37/37 regression, exact 309-path classification, and 961/0/0 contract. A51 may execute only exact Git publication; production remains closed.

## Queue

1. S30-S41B. Completed and accepted.
2. S42 / A51 exact Git publication. Current.
3. Production deployment. Closed.
