# S28 发布与 Git 门禁裁决

记录日期：2026-07-29

角色：`A34_ReleaseGitGate`
范围：只读审查 S18-S27 与 live worktree；未执行 Git 写操作、部署、备份、恢复、回滚、服务重启或生产访问。

## 裁决

`git_release_authorized; production_release_blocked`

S18-S27 的实现与回归证据可以形成未来暂存候选，但当前仍不具备 Git 入库或生产发布条件：

1. 213 条初始 live status 已全部分类为 `include=106`、`exclude=107`、`review-required=0`。
2. `lib/seo.js` 不在 accepted S18-S27 范围内；A00 已确认其工作树 blob 与 index blob
   完全相同且 `git diff` 为空，因此作为无内容差异的范围外状态明确排除。
3. 三份 S28 输出写入后的历史计划口径为 `include=109`、`exclude=107`、
   `review-required=0`，共 216 条。
4. 2026-07-30 Owner 已明确授权 A00 执行 Git；版本升级新增 12 条同步路径，当前
   发布口径为 `include=121`、`exclude=107`、`review-required=0`，共 228 条。
5. 工作树不干净；`deploy-update.sh` 与 `rollback.sh` 都会因 dirty worktree 停止。
6. 本轮按权限未执行生产备份、独立恢复演练或生产健康检查，因此没有可供实际发布使用的最新 backup manifest、checksum 与恢复证据。
7. 部署及生产数据操作仍未获授权，生产发布继续阻止。

完整逐项清单与未来命令见 `docs/git-staging-plan-20260728.md`。

## 证据

- 当前提交：`83d7a17437cbd65f1c7c2c41cc7a68dddc1940d5`
- 当前分支：`main`
- 上游：`origin/main`
- 最近提交：`83d7a17 feat: add formula lifecycle and focused content controls`
- 初始 index 无 staged path。
- 初始状态：33 条 tracked modified、180 条 untracked，共 213 条。
- 内容差异：31 个 tracked path，6217 insertions、870 deletions；`lib/seo.js` 与
  `styles/20-content.css` 出现在 status 中，但其工作树、过滤后内容和 index blob
  均分别完全一致，`git diff --quiet` 返回 0。
- S27：统一回归 23 passed、0 failed；九项需求均已映射，REQ-20260728-004 仅隔离证明通过，生产物理清理继续阻止。
- `npm.cmd run check:version`：通过，`V2.5.2+20260730-0012`。
- `npm.cmd run codex:contract`：759 passed、0 warnings、0 failures。
- `git diff --check`：退出码 0；仅报告现有 LF/CRLF 转换警告。

## 版本

- `package.json`：`2.5.2`
- `server.js`/版本检查结果：`V2.5.2+20260730-0012`
- 版本一致性检查通过。
- 实际发布仍须在候选 commit 确定后重新运行版本检查，并确认 `/healthz` 返回的版本与 commit 和目标候选一致。

## 备份与恢复前提

实际部署前必须取得针对目标 `DATA_DIR` 的新备份：

- 至少覆盖 `database/` 与 `uploads/`。
- 保存 `manifest.txt`。
- 环境具备 `sha256sum` 时必须保存并验证 `manifest.sha256`。
- SQLite 可用时，源与备份数据库的 `PRAGMA integrity_check` 必须为 `ok`。
- 记录备份目录、源目录、时间、数据库字节数及 uploads 文件数。
- 在独立目标目录先执行 `scripts/restore-linux.sh --dry-run`，再完成受控恢复演练并核对 checksum、SQLite 完整性、计数与关键内容。

本轮未执行上述操作，因此生产发布门禁未满足。S29 旧公式物理清理还必须额外满足最新备份、独立恢复演练、精确受影响行清单、清理报告 digest 与 Owner 明确授权。

## 回滚入口

- 代码入口：`scripts/rollback.sh [target-ref]`
- 默认目标：优先读取 `.deploy/last-deploy.env` 中的 `PRE_DEPLOY_COMMIT`，否则使用 `HEAD@{1}`。
- 回滚前：要求工作树干净，并先运行 `scripts/backup-linux.sh`。
- 回滚动作：`git reset --hard`、重启 `gokottamaker`、请求本机 `/healthz`。
- 数据恢复入口：`scripts/restore-linux.sh --dry-run <backup-dir> <DATA_DIR>`，复核后才可正式恢复。
- 代码回滚不会替换 SQLite 或 uploads；数据库迁移或内容变更需要单独的数据恢复裁决。

## 重启与健康检查

实际部署流程应由 `scripts/deploy-update.sh`：

1. 核对 clean worktree 与 pre-deploy commit/version。
2. 创建并记录数据备份。
3. fast-forward 到明确的 `origin/main` 候选。
4. 按门禁处理内容包，默认仅 dry-run。
5. 重启 `gokottamaker`。
6. 请求 `http://127.0.0.1:4173/healthz`，并验证返回的 `gitCommit` 与目标 commit 一致。
7. 需要时再核对 `https://www.larkix.com/healthz`、`systemctl status gokottamaker` 与 `nginx -t`。

本轮禁止访问生产和重启服务，以上检查均未执行，不能表述为当前生产健康。

## 停止条件

出现任一条件即停止后续暂存或发布：

- live status 出现未分类路径或任何 `review-required`。
- live status 与本计划路径集合不一致。
- Owner/A00 未明确授权 Git 或生产动作。
- staging 后出现计划外 path、exclude path 或 runtime/secret path。
- 版本检查、完整回归、`git diff --check`、Codex 契约或密钥审计失败。
- 工作树在部署前不干净，或目标 commit/branch/upstream 不明确。
- 缺少最新 backup manifest、checksum、SQLite 完整性或独立恢复演练。
- 服务重启失败、`/healthz` 不可用、版本或 commit 不匹配。
- 需要物理清理旧公式，但 S29 的 Owner 最终确认与精确报告仍缺失。

## 状态未改变声明

S28 未运行 `git add`、`commit`、`push`、分支/remote 修改、reset、checkout、clean、
stash、merge、rebase 或 cherry-pick；未访问云端、生产数据库、uploads、凭据或用户
数据；未部署、重启、备份、恢复或回滚。A00 最终核对确认 Git index 为空、HEAD 仍为
`83d7a17437cbd65f1c7c2c41cc7a68dddc1940d5`、分支仍为 `main`、origin 未改变。
