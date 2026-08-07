# S42 Git 发布执行交接

## status

`ready_for_exact_git_execution`

## candidate

- 版本：`V2.5.3+20260807-0001`。
- live status：314。
- include：207；exclude：107；review：0。
- 显式暂存命令：14；唯一路径：207；与 include 集合相等。

## authorized_actions

- 仅按 `docs/git-staging-plan-20260730.md` 中的 207 路径精确暂存。
- 通过 cached diff、版本、37 项回归、密钥、UTF-8 和契约后创建候选提交。
- fetch 并确认快进安全后，将现有 `main` 普通推送到现有 `origin/main`。

## forbidden

- 107 个 exclude 路径、宽泛暂存、force push、分支或 remote 修改、破坏性 Git。
- 生产、云端、服务、数据库、uploads、凭据、备份、恢复、回滚和物理清理。

## execution_result

本文件只记录执行前可验证事实。A00 以执行后的终端提交号、远端关系、push 结果和干净候选状态作为最终证据，避免在提交前预写尚未发生的结果。
