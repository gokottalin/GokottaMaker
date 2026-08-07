# S40 批次回归证据交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已建立单一可重复运行入口，统一覆盖 S30-S40A、十二项确认需求和既有关键回归。
- 已完成 37 项自动化检查，结果为 `37 passed, 0 failed`。
- 已完成 291 个变化路径的完整归类，确认暂存路径为 0。
- 已完成访客端、CMS、MD2File 的桌面、半宽、移动端、明暗主题代表性浏览器复验。
- 已验证临时服务和隔离数据目录清理，不读取或修改当前/生产数据。

## files_created_or_changed

- `package.json`
- `scripts/run-batch-regression-evidence.js`
- `docs/batch-regression-evidence.md`
- `docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md`

## decisions

- 统一入口固定为 `npm.cmd run test:batch-regression`，任何子检查失败均产生非零退出状态。
- 需求覆盖同时校验需求包、S30-S39 映射、S40 汇总覆盖、已完成状态和交接文件存在性。
- S40A 的重定向 API 验证作为正式依赖纳入回归，不再依赖交互终端输出编码。
- 浏览器证据与命令证据分开记录；专用切片证据负责细分行为，本轮现场复验负责整体几何、主题、入口和控制台状态。
- 本切片只产出验证工具与证据，不修复产品代码，不执行 Git、部署或生产数据动作。

## risks

- 结果基于本地隔离数据和代表性浏览器矩阵，不替代腾讯云部署后的健康检查与生产只读冒烟。
- 291 个工作区变化路径包含多个已验收切片和历史治理文件；S41 必须按批准清单分组审查，不得使用宽泛暂存。
- 生产数据迁移、物理清理与云端发布仍受独立门禁约束。

## tests_or_checks

- `node --check scripts/run-batch-regression-evidence.js`
- `npm.cmd run test:batch-regression`：`37 passed / 0 failed`，约 46 秒。
- 变化路径审计：`291/291 classified`，`0 staged`。
- 直接隔离 API 与重定向隔离 API 均通过；后者执行完整 58 个 API 断言。
- 浏览器现场复验：访客四页面、CMS 1440/760/390、明暗主题、MD2File 入口与工具页均无横向溢出；控制台 `warn/error` 为 0。
- 隔离浏览器服务 PID 已精确停止，专用临时 `DATA_DIR` 已删除。
- `git diff --check`、严格 UTF-8 与 Codex 契约由最终 A00 验收再次执行。

## next_handoff

返回 `A00_ProjectDirector` 独立验收；通过后进入
`A47_ReleaseGitGate / S41_release_git_gate`，只制定发布与 Git 门禁，不执行 Git 写操作、部署或云端变更。
