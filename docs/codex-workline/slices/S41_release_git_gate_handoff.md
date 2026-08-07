# S41 发布与 Git 门禁交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已完成 296 个最终 live status 路径的逐项分类：189 纳入、107 排除、0 待判。
- 已生成 13 条路径显式的未来暂存命令，189 个候选路径各出现一次。
- 已核对 Git 基线、版本、S40 回归、部署、备份、恢复、回滚和健康检查前置条件。
- 已确认当前版本身份与 HEAD 相同，因此裁决为 Git 与生产发布继续阻止。

## files_created_or_changed

- `docs/release-git-gate-20260730.md`
- `docs/git-staging-plan-20260730.md`
- `docs/codex-workline/slices/S41_release_git_gate_handoff.md`

## decisions

- 当前裁决：`git_release_blocked_version_not_advanced; production_release_blocked`。
- `V2.5.2+20260730-0012` 与 HEAD 完全相同，不能作为本批新改动的唯一发布身份。
- 下一步必须先执行窄范围版本同步，再重跑 S40 与 S41；在此之前任何 Git 写操作均未授权。
- `lib/seo.js` 与 `styles/20-content.css` 无内容差异并明确排除；旧 `docs/Agent*` 继续作为本地历史证据排除。

## risks

- 当前工作树不干净，部署与回滚脚本会按设计停止。
- 未取得最新生产 backup manifest、checksum、独立恢复演练或生产健康证据。
- 未来版本同步会增加路径并改变本计划集合，必须重新生成而不能直接执行当前命令。

## tests_or_checks

- Git 基线：`HEAD=02221c1`，`main -> origin/main`，记录 `0/0`，index 为 0。
- 版本检查：文件内部同步为 `V2.5.2+20260730-0012`；相对 HEAD 未递增，发布门禁失败。
- S40：`37 passed / 0 failed`，291/291 路径归类，代表性浏览器矩阵通过。
- 两个受保护元数据路径：工作树 blob 等于 index blob，`git diff --quiet` 为 0。
- `bash -n scripts/deploy-update.sh scripts/backup-linux.sh scripts/restore-linux.sh scripts/rollback.sh`：通过。
- S41 输出后全量复跑：`37 passed / 0 failed`；有内容差异与 untracked 路径为
  `294/294 classified`，另 2 个 metadata-only status 已在 296 路径计划中明确排除。
- 计划自检：296 行、189 include、107 exclude、0 review；13 条命令包含 189 个唯一
  路径，和 include 集合逐项相等。
- 三份输出通过严格 UTF-8、无 BOM、尾随空白和 `git diff --check`；凭据扫描通过；
  Codex 契约为 `939 passed / 0 warnings / 0 failures`；Git index 仍为 0。

## next_handoff

返回 `A00_ProjectDirector`。A00 应创建窄范围版本同步修复切片；修复并复验前不得进入 Git 暂存、提交、推送或部署。
