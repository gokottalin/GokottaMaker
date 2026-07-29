# 旧公式迁移安全说明

## 适用边界

S21 只提供隔离证明工具，不提供 current/production 清理入口，也不代表 A35
现网清理已获授权。所有 dry-run、apply 和 cleanup 都要求数据库位于系统临时目录下、
目录名以 `larkix-legacy-formula-` 开头，并包含由工具新建的 disposable marker。
`migrations/023_legacy_formula_migration_support.js` 在正常启动时只增加备份清单、映射、
重定向和报告表及不可变触发器，不删除 `knowledge_nodes`、
`knowledge_node_revisions` 或 `knowledge_links`。

## 备份与恢复

每次 dry-run 和 apply 都先执行：

1. `PRAGMA wal_checkpoint(FULL)`，记录 checkpoint 结果及主文件 SHA-256。
2. 使用 SQLite `VACUUM INTO` 创建一致、独立的数据库快照。工具不把主 sqlite
   文件的普通复制当作备份。
3. 导出三张旧源表的精确行、选中/总数量、schema 和 migration state。
4. 对快照及源行导出计算文件大小和 SHA-256，并计算 manifest digest。
5. 将快照复制到第二个隔离目录，以新连接打开，执行 `integrity_check`、
   `foreign_key_check`，并比较 schema、数量和旧源精确 digest。

任一清单、校验和、恢复、schema、数量或内容比较失败，apply/cleanup 都被门禁阻止。

## LaTeX 决策

旧 `knowledge_nodes.symbol` 是标签，不是公式正文。`D.boost`、`L.boost`、
`I_L.peak`、`BOOST-L` 或“纯数学推导”等值不会自动写入
`formula_revisions.latex`。工具也不会从 Markdown 猜测第一条公式。

默认 dry-run 会把缺少可追溯结论 LaTeX 的节点标为 unresolved。人工核对后可提供：

```json
{
  "legacy-node-id": {
    "exactLatex": "D = (V_{out} - V_{in}) / V_{out}",
    "latexSourceEvidence": "reviewed conclusion equation in knowledge_nodes:legacy-node-id",
    "revisionLatex": {
      "knowledge_node_revisions:42": {
        "exactLatex": "D_0 = 1 - V_{in} / V_{out}",
        "sourceEvidence": "reviewed conclusion equation in knowledge_node_revisions:42"
      }
    }
  }
}
```

报告会为当前节点和每个历史快照保留 `exactLatex`、`sourceEvidence`、
`decision`、`legacySymbol` 和源键。原 Markdown 始终留在备份、映射源摘要和旧快照。

## 确定性映射

- 新卡 ID、slug、不可变修订 ID 和文章 `bindingId` 都由稳定源身份/内容生成。
- 旧节点当前正文和每个历史快照分别映射到不可变公式修订。
- 当前及历史 Markdown 中的
  `{{derive:slug|label|color}}` 按原位置改为
  `{{formula-ref:<targetFormulaId>}}`；其他 Markdown 和 LaTeX 保持不变。
- Markdown 依赖集合必须与对应 `knowledge_links` 完全一致；转换后不得残留已迁移
  `derive`，解析出的 `formula-ref` 必须与
  `formula_revision_dependencies` 的顺序和内容一致。
- 文章中的旧短码改为
  `{{formula:bindingId|formulaId|revisionId|inline|display}}`，并同步创建
  `article_formula_bindings`。修改前文章完整快照写入 `content_revisions`。
- 项目或其他来源的旧引用没有安全的新绑定语义时，一律 unresolved。

重复运行不是复用旧计划：工具重新备份、恢复、构建计划并 apply。已存在的兼容卡、
修订、binding 和文章快照会被精确复用，不新增或改写身份。

## 显式合并

多个旧节点只可通过已存在的兼容公式卡显式合并。每条规则必须提供相同且非空的
`mergeKey`、同一 `targetFormulaId` 及 exact LaTeX 来源证据。工具要求数学内容、
迁移后 Markdown、元数据、源状态、目标状态和当前不可变修订身份完全一致。

兼容现有修订直接复用，不静默改写卡片。若确有历史修订需要追加，规则还必须显式设置
`"allowAppendHistoricalRevisions": true`；追加是新不可变修订，不改变非托管现有卡的
current/published 指针。任一合并证明不一致会使全部相关节点 unresolved。

## 永久重定向

公开旧入口 `/derive.html?slug=<legacy>` 在 `createServer` 的 API 和静态分派之前查询
已验证映射，成功时返回真正的 HTTP `308`，目标为
`/derive.html?formula=<card-slug>`。只接受已持久化且由零 unresolved 的
`apply_verified` 报告支持的映射，并再次核对源节点公开状态、目标卡已发布、目标修订
存在、slug 一致且没有自环或多跳环。draft、private、缺失目标或环路均回落到普通静态
页面，不重定向。

## 命令

CLI 默认 dry-run，且必须指向新建 disposable fixture：

```powershell
npm.cmd run migrate:legacy-formulas -- --fixture <temp-fixture> --db <fixture.sqlite>
npm.cmd run migrate:legacy-formulas -- --fixture <temp-fixture> --db <fixture.sqlite> --mapping <rules.json> --apply
npm.cmd run migrate:legacy-formulas -- --fixture <temp-fixture> --db <fixture.sqlite> --cleanup --report-digest <sha256:...>
```

cleanup 只接受已持久化的同一份 cleanup-eligible apply report digest。删除、删除后数量/
内容/关系/状态与 SQLite 完整性校验、cleanup report 写入和写入确认处于同一
`BEGIN IMMEDIATE` 事务；任何异常都 `ROLLBACK`。unresolved、ambiguous、数量漂移、
内容漂移、关系不一致、校验和失败、恢复失败或报告持久化失败都会保留全部旧行。

专用回归：

```powershell
npm.cmd run test:legacy-formula-migration
```

该回归只在新建临时 fixture 中证明物理清理，并包含删除后校验失败与 cleanup report
持久化失败的故障注入，逐行确认三张旧源表回滚恢复。
