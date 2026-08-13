# S54 最终候选门禁交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 保留并复验 A00 的 S54A 窄修复：`.codex/larkix-governance.json` 顶层固定 `workspaceRoot` 已删除，handoff 和 contract 使用当前 checkout 根目录。
- 发布身份保持为 `2.5.4` / `V2.5.4+20260814-0001`，运行时、静态缓存和发布说明引用一致。
- 按实时 `git status --porcelain=v1 -z -uall` 重建 manifest、audit 和精确 staging plan。
- 从 HEAD tracked 基线叠加全部 include 文件到新的仓库外候选，完成真实安装、隔离启动、空数据初始化、健康检查、完整回归、候选审计、版本和契约验证。
- 已清理候选目录和候选进程，未操作现有服务、数据或 Git index。

## files_created_or_changed

- `docs/final-git-manifest-20260813.json`
- `docs/final-repository-audit-20260813.md`
- `docs/final-release-gate-20260813.md`
- `docs/final-git-staging-plan-20260813.md`
- `scripts/verify-final-git-candidate.js`
- `docs/codex-workline/slices/S54_final_candidate_gate_handoff.md`

本轮未修改或还原 A00 的 `.codex/larkix-governance.json` 修复。

## decisions

- 最终实时状态分区为 `229 = 124 include + 105 exclude + 0 review`。
- 105 项 exclude 仍仅为未跟踪的旧金字塔 `docs/Agent*` 历史噪声；保留本地且不得暂存。
- staging plan 的 124 条精确 pathspec 与 include 集合逐项相等；没有 `git add .`。
- S54 已具备 A00 验收条件，但 S54 不开放 Git 写入；只有 A00 验收并打开 S55 后，A64 才可执行最终发布。

## risks

- 工作树仍显示 105 条显式排除的历史未跟踪文档；A64 必须按清单精确暂存，不能使用仓库级通配暂存。
- include 文本中有 2 个已存在的 UTF-8 BOM 文件，均能严格 UTF-8 解码且不是本轮编码损坏；候选编码有效性检查通过。
- 最终远程权限、分支保护和推送后的远程 clone 仍属于 S55/A64 门禁，不属于 S54。

## tests_or_checks

- 实时集合：`229 live = 124 include + 105 exclude + 0 review`；missing、extra、duplicate、overlap 和 status mismatch 均为 0。
- staging plan：124 条精确 pathspec，与 include 集合完全一致，未发现 `git add .`。
- 仓库外候选：HEAD `50386e9` + 124 include overlay，构造成功。
- `npm ci --ignore-scripts`：通过，2 packages，0 vulnerabilities。
- `npm.cmd run verify:clean-clone -- -SkipInstall`：通过；随机端口 `8649` 健康检查和空 SQLite 初始化通过。
- `npm.cmd run check:version`：通过，`V2.5.4+20260814-0001`。
- Markdown 与 MD2File DOCX：通过。
- 安全/公式回归：`15 passed / 0 failed`。
- `node scripts/verify-final-git-candidate.js --candidate`：通过；秘密、敏感路径、绝对路径、编码、大文件、依赖锁及 KaTeX MIT 许可证审计通过。
- 候选 `npm.cmd run codex:contract`：`1156 passed / 0 warnings / 0 failures`。
- 清理：候选目录删除成功，候选 Node 进程无残留。
- Git：HEAD 保持 `50386e9`，index 变更路径为 0；未 stage、commit、push、branch、remote 或 stash。
- 数据/服务：未读取或修改 `.env`、现有数据库、uploads、runtime-data 或生产数据；原有 1966/1967 服务未操作。

## next_handoff

返回 `A00_ProjectDirector` 验收 S54。验收通过后，由 A00 决定是否开启 `S55_git_publish_and_remote_clone` 并分发给 `A64_FinalGitPublisher`；A64 必须在任何 Git 写入前再次验证实时清单。
