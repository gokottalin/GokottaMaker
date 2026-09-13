# S61 新会话启动治理交接

- `status`: completed；A00 已完成并验收紧凑启动与确认需求的新会话启动语契约。
- `scope_completed`: 新增 compact bootstrap、单行 launch 输出、确认需求交接信封中的启动命令，以及 AGENTS/A00/提示模板中的自动发出规则。
- `files_created_or_changed`: `AGENTS.md`、`PROJECT_WINDOW.md`、`agents/A00_ProjectDirector/brief.md`、`agents/A71_SessionBootstrapGovernance/brief.md`、`.codex/agents/a71-session-bootstrap-governance.toml`、`.codex/larkix-governance.json`、`docs/codex-workline/task_registry.json`、`docs/prompts/agent_prompt_template.md`、`docs/prompts/next_agents.md`、`scripts/codex-handoff.js`、`scripts/requirement-handoff.js`、`scripts/test-codex-handoff.js`、`package.json`、本交接。
- `decisions`: 根 `AGENTS.md` 只保留稳定门禁与启动路由；正常新会话使用 `npm.cmd run --silent codex:bootstrap`；仅在 Owner 已确认且当前会话判定确需转入新会话时，运行 `npm.cmd run --silent codex:launch` 并原样发出一行启动语。
- `risks`: compact 模式依赖目标 brief 保持窄范围和自包含；若 A00 未先注册目标 brief，禁止凭空生成目标 Agent 启动语。
- `tests_or_checks`: `npm.cmd run test:codex-handoff` PASS；`npm.cmd run codex:requirement -- selftest` PASS；JSON parse PASS；`npm.cmd run --silent codex:launch` 严格输出 1 行；`git diff --check` 无 whitespace error；全局 `codex:contract` 为 1250 passed / 0 warnings / 0 failures。
- `protected_boundaries`: 未修改业务代码、数据库、运行数据、生产环境、服务、密钥、迁移、版本或 Git index/commit/push。
- `next_handoff`: 回到 `A00_ProjectDirector`；活动队列为空，等待下一份 Owner 确认需求。
