# S42 Git 发布执行门禁

记录日期：2026-08-07

角色：`A51_GitPublisher`

候选：`V2.5.3+20260807-0001`

## 裁决

`exact_git_publish_authorized; production_release_blocked`

1. A51 注册后的 314 条 live status 已完整分类为 `include=207`、`exclude=107`、`review-required=0`。
2. 14 条显式暂存命令覆盖 207 个唯一 include 路径，并与 include 集合逐项相等。
3. S41B 已通过 A00 复验；候选版本相对 HEAD 唯一递增，Git index 在执行前为空。
4. A51 只获准执行精确暂存、候选提交和现有 `main -> origin/main` 的普通推送。
5. 生产、云端、数据、服务、备份、恢复和回滚操作继续关闭。

## 执行基线

- HEAD：`02221c1bc1ff8049d7da80700eade20fc0ebdf94`。
- 分支：`main`。
- 候选版本：`V2.5.3+20260807-0001`。
- 最终 status：314；计划纳入 207、排除 107、待判 0。
- `lib/seo.js` 与 `styles/20-content.css` 仍为 metadata-only 状态并明确排除。
- 执行前 Git index：0 staged path。

## 必须通过的 Git 门禁

- staged 集合精确等于 207 个 include 路径，exclude 与 review 均为 0。
- `git diff --cached --check`、版本、全量回归、密钥、UTF-8 和 Codex 契约全部通过。
- push 前 fetch 现有 origin，并确认本地 HEAD 可普通快进推送至现有 `origin/main`。
- 禁止宽泛暂存、force push、分支创建、remote 修改和破坏性 Git。

## 生产边界

本次 Git 发布不等于生产部署。腾讯云服务器的备份、恢复演练、部署脚本、服务重启和 `/healthz` 核验必须在单独授权与任务中执行。
