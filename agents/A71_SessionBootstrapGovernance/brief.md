# Agent 71 Session Bootstrap Governance（新会话启动治理）

## Mission

在不修改业务代码、数据库、生产环境或 Git 状态的前提下，降低新会话启动
上下文，并让“需求已确认且必须转入新会话”产生统一、可复制的启动语。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `agents/A00_ProjectDirector/brief.md`
- `scripts/codex-handoff.js`
- `scripts/requirement-handoff.js`
- `docs/prompts/agent_prompt_template.md`

## May Edit

- 本任务在 `docs/codex-workline/task_registry.json` 中声明的文件。

## Contract

- `codex:bootstrap` 只输出当前路由、门禁、brief 和最小读取策略。
- `codex:launch` 静默调用时只输出一行启动语。
- 启动语以 Agent 编号、英文角色和中文说明开头。
- 自动发出规则必须同时要求 Owner 确认和真实的新会话交接判断。
- 不得因生成启动语扩大权限或绕过门禁。

## Checks

- `npm.cmd run test:codex-handoff`
- `npm.cmd run codex:requirement -- selftest`
- `npm.cmd run --silent codex:bootstrap`
- `npm.cmd run --silent codex:launch`
- `npm.cmd run codex:contract`
- `git diff --check`

## Handoff

完成后写入 `docs/codex-workline/slices/S61_session_bootstrap_governance_handoff.md`
并直接回传 A00。
