# S41B 发布与 Git 门禁复核交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已在新版本同步后重建 309 路径最终分区：202 纳入、107 排除、0 待判。
- 已生成 14 条路径显式命令，覆盖 202 个唯一候选路径并与 include 集合相等。
- 已核对新版本、全量回归、Git 基线、备份、恢复、回滚、健康和停止条件。

## files_created_or_changed

- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md`

## decisions

- 当前裁决：`git_candidate_ready; production_release_blocked`。
- `V2.5.3+20260807-0001` 相对 HEAD 已形成唯一新身份。
- Git 写入必须由独立执行工位按 202 路径集合完成；S41B 未执行任何 Git 写入。
- 生产部署继续阻止，直到服务器备份、恢复演练、目标 commit 健康证据和单独授权齐备。

## risks

- 当前工作树仍不干净；在本地候选提交完成前部署脚本会按设计停止。
- 任何后续文件变化都会使 309/202 清单失效，必须停止并重建。
- 旧历史证据和两个 metadata-only 路径必须保持未暂存。

## tests_or_checks

- 版本：`V2.5.3+20260807-0001`，内部同步且相对 HEAD 递增。
- 全量回归：`37 passed / 0 failed`。
- Git：`HEAD=02221c1`，`main -> origin/main`，记录 `0/0`，index 为 0。
- 计划：309 行、202 include、107 exclude、0 review；14 条命令、202 唯一路径、集合相等。
- A00 复验：严格 UTF-8、无 BOM、无尾随空白、`git diff --check`、密钥扫描和临时目录清理均通过。
- A00 复验：live status 与计划均为 309 条；202 include、107 exclude、0 review；14 条命令覆盖 202 个唯一路径且集合完全相等。
- A00 复验：`npm.cmd run codex:contract` 为 `961 passed / 0 warnings / 0 failures`，Git index 仍为 0。

## next_handoff

返回 `A00_ProjectDirector`。S41B 已通过 A00 验收，可进入独立 Git 执行工位；生产部署仍需另行授权。
