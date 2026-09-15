# S67 Discovery Experience Regression Handoff

## status

`accepted`

## scope_completed

- 新增 S67 可重复全批 runner，逐项执行 S66/S65/S64 focused static 与真实浏览器、S63 migration/authority、S62 consolidated、S60、S50 和 `codex:contract`。
- runner 可靠汇总全部子项；任一退出非零、S60 digest 不匹配、保护路径有差异、cached diff 非空、新增临时残留或相关进程残留时，整体退出非零。
- 输出逐项命令身份、退出状态、耗时、S60 digest、临时目录/进程清理与保护边界证明。
- 完整证据写入 `docs/discovery-experience-regression-evidence.md`；未修改或放宽任何产品代码与既有测试。

## files_created_or_changed

- `scripts/run-discovery-experience-regression.js`
- `docs/discovery-experience-regression-evidence.md`
- `docs/codex-workline/slices/S67_discovery_experience_regression_handoff.md`

## decisions

- 复用 S62-S66 已验收的权威 focused 命令，不在 S67 复制业务断言或建立弱化替代测试。
- 全批采用继续执行并可靠汇总的模式，以便一次报告全部状态；最终任一失败仍整体非零。
- S60 输出中的 evidence digest 必须精确等于 `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`，不仅检查其退出码。
- 临时目录审计只将本次执行相对启动基线新增的受控前缀残留判为失败，避免把执行前历史状态误归因给 S67；同时单独要求本次相关 Node/Edge/Chrome 残留为 0。

## risks

- 三个真实浏览器夹具依赖本机 Edge/Chrome；浏览器缺失会明确失败，不会降级为静态通过。
- 全批耗时受机器与浏览器启动速度影响；每个子项 20 分钟超时，超时视为失败。
- runner 仅做回归编排与边界审计；发现稳定失败时必须退回对应原执行工作台，A77 不在本包修产品。

## tests_or_checks

- `node scripts/run-discovery-experience-regression.js`：PASS，`12 passed, 0 failed, protected-boundary passed`，约 227.2 秒。
- S66 static/browser：PASS；覆盖首帧 light/dark、公开/CMS 页脚边界和 390px 卡片/页脚布局。
- S65 static/browser：PASS；覆盖五类型搜索、匿名最小披露、首页 8 公式与三个互异槽位。
- S64 static/browser：PASS；覆盖多草稿、冲突恢复、跨编辑器边界、等级/槽位和窄屏。
- S63 migration/authority、S62 consolidated：PASS。
- S60：15 passed, 0 failed；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- S50：15 passed, 0 failed。
- runner 内及证据落盘后的 `npm.cmd run codex:contract`：PASS；最终为 1319 passed、0 warnings、0 failures。
- `node --check scripts/run-discovery-experience-regression.js`、`git diff --check`：PASS；后者仅有既有 LF/CRLF 提示。
- runner 保护边界：protected-path diff 空、cached diff 空、新增受控临时目录 0、相关 Node/Edge/Chrome 进程 0、自有 DATA_DIR cleanup complete。

## next_handoff

A00 已独立复跑并裁决 S67 为 `accepted`。仅 A00 可按 Owner 持续授权精确 stage/commit/push；本批队列在远端 SHA 验证后关闭。A77 不执行 Git、生产数据、部署、云、秘密或迁移操作。
