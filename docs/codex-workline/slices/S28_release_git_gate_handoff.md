# S28 发布与 Git 门禁交接

## status

`accepted_by_A00`

## scope_completed

- 使用 `git status --porcelain=v1 --untracked-files=all` 盘点写入前 live worktree 的全部 213 条状态项。
- 逐项分类为 `include=106`、`exclude=107`、`review-required=0`。
- 将三份 S28 输出另计入最终计划，最终为 `include=109`、`exclude=107`、
  `review-required=0`，共 216 条。
- 2026-07-30 Owner 明确授权 A00 执行 Git；版本升级新增 12 条同步路径，当前候选为
  `include=121`、`exclude=107`、`review-required=0`，共 228 条。
- 将 65 条 accepted S18-S27 交付路径映射到对应 slice，将 41 条活动治理路径映射到 accepted dispatch/current workline/Codex contract。
- 将 105 条旧 `docs/Agent*` 历史证据、受保护路径 `styles/20-content.css` 和无内容差异
  的范围外路径 `lib/seo.js` 排除在本批未来暂存之外。
- A00 已确认 `lib/seo.js` 与 index blob 完全相同且 `git diff` 为空，不再保留待判项。
- 给出 109 条 include path 的未来显式暂存命令，未执行任何命令。
- 核对版本、S27 回归、备份/恢复前提、回滚入口、重启、健康检查和停止条件。

## files_created_or_changed

- `docs/release-git-gate-20260728.md`
- `docs/git-staging-plan-20260728.md`
- `docs/codex-workline/slices/S28_release_git_gate_handoff.md`

除以上三项外未写入任何文件。

## decisions

- S28 交付裁决：`accepted_by_A00`。
- Git 候选裁决：121 条 include 已获 Owner 明确授权，由 A00 在回归通过后执行。
- 生产发布裁决：`blocked`。
- 主要阻断：
  - 当前工作树不干净，部署与回滚脚本会停止。
  - 未取得本次生产发布所需的新备份、checksum、独立恢复演练和生产健康证据。
  - Git、部署、生产数据与 S29 物理清理权限均未开放。
- 版本：`V2.5.2+20260730-0012`，检查通过。
- 回滚：入口存在，但只能在 clean worktree、明确 target ref、先备份并具备健康验证条件时使用；代码回滚不代替数据恢复。

## risks

- `lib/seo.js`、`styles/20-content.css` 与旧 `docs/Agent*` 路径必须保持不覆盖、不回退、
  不静默暂存。
- `git diff --check` 的 LF/CRLF 警告不构成当前 whitespace failure，但未来暂存前应确认换行规范不会产生计划外差异。
- REQ-20260728-004 仅有隔离证明；当前/生产物理清理仍属于 S29 且未授权。

## tests_or_checks

- `npm.cmd run codex:handoff`：通过，路由为 S28/A34。
- 初始 porcelain：213 条，33 tracked modified、180 untracked。
- `git diff --stat`：31 个内容差异 tracked path，6217 insertions、870 deletions。
- `git diff --check`：通过，只有 LF/CRLF 警告。
- `npm.cmd run check:version`：通过，`V2.5.2+20260730-0012`。
- `npm.cmd run codex:contract`：759 passed、0 warnings、0 failures。
- S27：23 passed、0 failed。
- A00 逐项核对：213 条初始路径在计划中恰好出现一次，121 条未来命令路径与 include
  集合完全一致，无缺项、额外项或重复项。
- 最终核对确认三份输出为 UTF-8 无 BOM、无密钥特征，Git index、HEAD、branch、
  origin、云端、服务与生产状态未改变。

## next_handoff

`A00_ProjectDirector`

自动任务队列在此收口。只有重新核对 live status、取得 Owner 对 Git 动作的明确授权并
重跑必要回归后，才可考虑按 `docs/git-staging-plan-20260728.md` 的显式路径执行未来
暂存。生产发布还必须另行满足最新备份、独立恢复演练、回滚目标、服务窗口与健康检查
门禁。S29 物理清理继续等待精确报告和 Owner 单独授权。
