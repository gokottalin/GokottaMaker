# S21 旧公式迁移安全交接

- 执行 Agent：`A28_LegacyFormulaMigrationSafety`
- 验收 Agent：`A00_ProjectDirector`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-004`
- 状态：`accepted_by_A00`
- next_handoff：`A00_ProjectDirector`

## 1. 交付结论

S21 已实现备份优先、默认 dry-run、确定性映射、逐项验证、永久重定向和仅限新建临时
disposable fixture 的物理清理证明。实现没有 current/production 模式，没有执行或
授权 A35 现网清理，没有云端、部署或 Git stage/commit/push。

`migration 023` 正常启动只增加支持结构及不可变触发器，不包含旧表 DELETE。任何
unresolved、ambiguous、数量/内容/引用/关系/状态 mismatch、备份或恢复失败都会阻止
apply/cleanup 并保留旧行。

## 2. 数据语义

源清单至少覆盖 `knowledge_nodes`、`knowledge_node_revisions`、
`knowledge_links`。`symbol` 被严格视为标签，不作为 LaTeX；测试使用
`D.boost`、`L.boost`、`I_L.peak` 和 `BOOST-L`。没有逐源 exact LaTeX 与
`sourceEvidence` 时默认 unresolved，不从 Markdown 启发式猜公式。映射报告记录
`decision/sourceEvidence/exactLatex/legacySymbol/sourceKey`。

旧公式修订 Markdown 的 `{{derive:slug|label|color}}` 转为
`{{formula-ref:<targetFormulaId>}}`，其余 Markdown/LaTeX 保持不变；旧 Markdown
继续存在于一致快照、精确源行导出、mapping source digest 和旧修订快照。转换后验证
无残留 derive，且 Markdown 依赖、`knowledge_links` disposition 和
`formula_revision_dependencies` 完全一致。

文章引用按位置稳定地改为
`{{formula:bindingId|formulaId|revisionId|inline|display}}`，同步创建
`article_formula_bindings`；`bindingId` 由 post ID、旧 link ID 和出现序号确定生成。
更新前文章全文保存在 `content_revisions`。项目等无法安全绑定的来源逐条 unresolved。

## 3. 备份与恢复证据

专用成功 fixture 的旧源数量：

- `knowledge_nodes=2`
- `knowledge_node_revisions=1`
- `knowledge_links=2`

备份先执行 `PRAGMA wal_checkpoint(FULL)`，再用 SQLite `VACUUM INTO` 创建一致快照，
不是复制 WAL 模式下的主 sqlite 文件。manifest 记录 schema/migration state、源/总
数量、精确与规范化 digest、文件大小、SHA-256 和恢复步骤。快照复制到第二隔离目录，
由新连接执行 `integrity_check=ok`、`foreign_key_check=0`，并比较 schema、数量和
旧源精确 digest。

最近一次专用回归证据：

- 备份数据库 SHA-256：`sha256:a8b9dc1917ea497b2bb36144ac265f5477d49864068a55ce58c9506d3446c6ae`
- 源行导出 SHA-256：`sha256:e6813efe05da6dd5796db8797abf4bf7879b735a682d56c96cb91cc3c4db4e28`
- manifest digest：`sha256:fc226a87c36532518ee43cc00ff916b0c136e4bab1f7fddfc30fdebed39b3892`
- restore verification digest：`sha256:5636efa17b9e9a0570fc3a2e58ab23f6154200f55435ff61fcdadef0a78dbef6`

## 4. 映射、幂等与清理证据

首次 apply 后：

- `formula_cards=2`
- `formula_revisions=3`
- `formula_revision_dependencies=1`
- `article_formula_bindings=2`
- `content_revisions=1`
- `legacy_formula_mappings=5`
- `legacy_formula_redirects=2`
- 旧三表仍为 `2/1/2`

文章 binding IDs：

- `bind.legacy.0bd94605111a4b5f5ce3392f27868959`
- `bind.legacy.25eed986b9d207c5542c9820844c1ccf`

幂等测试在首次 apply 后执行了新的 backup、第二隔离目录 restore、`buildMigrationPlan`
和真实 `applyDisposableMigration`。第二次 apply 没有新增卡、修订、依赖、binding 或
文章旧快照，也没有改写身份。

- plan digest：`sha256:18e9739e08361ce27db3bae128c3f8a7cb21a72078d0f8255c784ad15ab02f9f`
- 首次 apply report：`sha256:6e2645a0df2fb68cccdd78dda32279471fbaa522f03edea7403a1db6c6e4a995`
- 第二次 apply report：`sha256:c7bcaad22ab1c8195493b801259ed40585943ad7db048ba995652f73017e2b5b`

cleanup 使用第二次 cleanup-eligible report。删除、删除后数量/目标保持/SQLite 检查、
cleanup report 持久化及确认在同一事务。成功后旧三表为 `0/0/0`；卡 `2`、修订 `3`、
依赖 `1`、binding `2`、文章旧快照 `1`、mapping `5`、redirect `2` 均保留。

- cleanup report：`sha256:a3f26c9a21cca242fa4509de28c2b258f33e92b8fae9cc83fca9005cf5757bf1`

## 5. 显式合并

成功 fixture 证明两个旧节点可通过相同非空 `mergeKey` 映射到同一已存在公式卡，但仅在
exact LaTeX、迁移后 Markdown、元数据、源/目标状态和当前不可变修订身份完全一致时。
目标卡与修订被复用，未静默改写。另一 fixture 只改变第二节点 Markdown，整个合并即
unresolved，apply 被阻断且旧行完整。

历史修订若现有目标已有 exact compatible revision 则复用；否则只有显式目标规则包含
`allowAppendHistoricalRevisions=true` 才可追加新的不可变历史修订，且不改变非托管卡
的 current/published 指针。

## 6. 重定向矩阵

`createServer` 在 API/静态分派之前处理 `GET/HEAD /derive.html?slug=<legacy>`，有效映射
返回 HTTP `308` 到 `/derive.html?formula=<card-slug>`。专用 HTTP 测试确认：

- verified + public source + published target：`308`
- draft target：拒绝重定向
- private source：拒绝重定向
- missing target：拒绝重定向
- self-loop：拒绝重定向
- multi-hop loop/chain：拒绝重定向
- 已有 `formula` 参数：不走旧入口重定向

## 7. 失败夹具

以下失败均证明旧行保留：

- symbol 只有 `D.boost` 且无 exact LaTeX 来源证据
- 多候选 ambiguous mapping
- 缺失依赖目标
- 项目旧引用没有安全 binding disposition
- 显式合并 Markdown/内容证明不一致
- redirect self-loop / multi-hop
- 备份文件 SHA-256 被篡改
- 旧源数量漂移
- 旧源 Markdown 内容漂移
- 删除后校验故障注入
- cleanup report 持久化故障注入

后两项在 DELETE 已执行后抛错，事务 `ROLLBACK` 后对
`knowledge_nodes/knowledge_node_revisions/knowledge_links` 全部精确行及各目标/报告
数量做 deep equality，证明零删除。

## 8. 修改文件

- `migrations/023_legacy_formula_migration_support.js`
- `lib/legacy-formula-migration.js`
- `lib/content.js`
- `lib/validators.js`
- `server.js`
- `scripts/migrate-legacy-formulas.js`
- `scripts/test-legacy-formula-migration.js`
- `package.json`
- `docs/legacy-formula-migration.md`
- `docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md`

未修改治理文件或 `styles/20-content.css`，未回退其他参与者已有改动。

## 9. 验证命令

- `npm.cmd run test:legacy-formula-migration`
- `npm.cmd run test:formula-catalog`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-reference-versioning`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:linear-derivation-graph`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run test:markdown`
- `npm.cmd run test:calculation-book`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
- `npm.cmd run codex:contract`
- `git diff --check`

以上全部通过。附加语法检查对 migration、migration engine、content、validators、server、
CLI 和专用测试共 7 个 JS 文件执行 `node --check`，结果 `7/7 passed`。

精确仓库级结果：

- `verify-api.ps1`：`ok=True`、`csrfBlocked=True`、`carouselOrderBlocked=True`、
  `publicKnowledgeNodes=1`
- `codex:contract`：`667 passed`、`0 warnings`、`0 failures`
- `git diff --check`：exit code `0`；仅输出工作树既有 LF/CRLF 提示，无 whitespace error

## 10. 残余风险与边界

1. 真实旧节点的结论公式仍需要 Owner/A00 审核后提供逐节点、逐历史修订的 exact LaTeX
   与来源证据；默认工具会安全阻断，不会猜测。
2. 迁移工具不会为 project 等来源发明新引用语义；这类 disposition 在获得单独设计前
   保持 unresolved。
3. S21 只证明临时副本物理清理。current/production 数据未打开，A35 现网清理未实现、
   未授权，仍需 A00 提供精确 affected-row report 并取得新的 Owner 确认。

`next_handoff=A00_ProjectDirector`

## 11. A00 独立复测与验收

2026-07-29，A00 独立检查关键事务、显式合并、LaTeX 来源、Markdown
依赖转换、真实幂等重跑和服务器重定向实现，并重新执行全部声明命令。

- `test:legacy-formula-migration`：通过全部 16 类成功/失败场景。
- 公式目录、文章公式、版本决策、发布、线性/分支推导、Markdown、计算书回归：
  全部通过。
- `verify-api.ps1`：`ok=True`、`csrfBlocked=True`、
  `carouselOrderBlocked=True`、`publicKnowledgeNodes=1`。
- 7 个变更 JavaScript 文件 `node --check`：`7/7 passed`。
- `codex:contract`：`667 passed`、`0 warnings`、`0 failures`。
- `git diff --check`：无 whitespace error，仅有工作树既有 LF/CRLF 提示。
- A00 发现并修复 Windows 短时 SQLite 文件锁可能留下测试目录的问题；清理改为
  有界重试且残留即失败。重跑后 `larkix-legacy-formula-*` 临时目录数量为 `0`，
  API/测试端口均已关闭。

A00 接受 S21 的隔离证明。该验收不打开 A35，不授权 current/production
迁移或物理清理。
