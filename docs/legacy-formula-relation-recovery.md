# 旧公式关系恢复

## 统一关系契约

公式关系统一解释为 `来源公式 -> 依赖公式`。关系属于来源公式的某一条不可变修订，存储于
`formula_revision_dependencies`；当前图与已发布图分别只读取卡片的
`current_revision_id` 和 `published_revision_id`。

每次写入或导入必须通过同一组校验：

- 来源公式与目标公式必须存在，修订必须属于来源公式。
- 同一修订不能重复依赖同一目标，且同一 ordinal 只能对应一个目标。
- 来源不能依赖自身。
- 目标不得悬空。
- 当前图和待发布图均不得形成直接或多跳环。
- 已发布修订只能依赖已发布、未归档且存在发布审计记录的目标修订。

目录导入先创建卡片和不可变修订，再写关系和发布审计，最后按依赖优先的逆拓扑顺序切换
卡片指针。父卡即使先出现在 JSON 中，也不能早于其依赖进入公开投影。

## 游客边界

游客 API、关系列表和图谱只遍历已发布指针。草稿、待发布修订和已归档卡不会作为可访问节点
或边返回；若当前已发布修订仍保留指向不可公开目标的历史关系，只返回边界计数，不返回目标
标识、名称、LaTeX 或证据。CMS 仍可查看当前修订及完整影响范围。

## 证据优先级

隔离迁移器按以下规则恢复关系：

1. `{{formula-ref:formulaId}}` 是稳定、权威的关系证据。
2. `{{derive:slug|label|color}}` 只有在 slug 唯一映射到一张公式卡时才可采用。
3. `knowledge_links.link_kind = 'derive'` 只有在来源与目标均唯一映射时才可采用；其他 link kind 不进入 DAG。
4. 旧短码与旧关系同时存在时，两者必须一致。与稳定短码冲突时保留稳定关系，并把旧证据排队。
5. 歧义、来源缺失、目标缺失、重复、自环、证据冲突、成环、归档目标和来源无修订均只进入待修复队列。

迁移器不会选择歧义候选，不会更新不可变映射，也不会删除旧节点、旧修订、旧关系、公式修订
或文章绑定。

## 隔离执行

命令只接受由旧迁移工具创建、位于系统临时目录且包含一次性标记的 fixture。未提供
`--apply` 时固定为 dry-run。

```powershell
node --experimental-sqlite scripts/migrate-legacy-formula-relations.js `
  --fixture <disposable-fixture-dir> `
  --db <disposable-fixture-dir>\database\formula-relation-fixture.sqlite
```

确认 dry-run 报告、备份校验和与恢复校验通过后，才可在同一个隔离副本显式应用：

```powershell
node --experimental-sqlite scripts/migrate-legacy-formula-relations.js `
  --fixture <disposable-fixture-dir> `
  --db <disposable-fixture-dir>\database\formula-relation-fixture.sqlite `
  --apply
```

每次执行都会先 `wal_checkpoint`，再通过 `VACUUM INTO` 创建一致性 SQLite 备份，并复制到第二个
临时目录执行 SHA-256、`PRAGMA integrity_check`、外键检查和关系库存摘要比对。apply 结束后再次
核对旧证据、卡片、修订和文章绑定摘要完全未变，并写入不可变迁移报告。重复执行使用稳定关系
键和稳定 repair ID，只会得到零新增关系、零新增队列项。

## 待修复队列

`formula_relation_repair_queue` 保存迁移时的原始位置、摘要、候选和原因，禁止更新与删除。
人工处理流程如下：

1. 在 CMS 打开来源公式，依据外部证据人工确定目标。
2. 在 Markdown 推导中保存明确的 `{{formula-ref:formulaId}}`，由正常公式保存流程生成新修订并校验 DAG。
3. 回到关系待修复队列，手动填写已保存的目标 formulaId 和复核说明。
4. API 反查该来源修订中的真实关系后，才向 `formula_relation_repair_events` 追加 `resolved` 事件。
5. 需要复查时追加 `reopened` 事件；历史事件保持不变。

队列结案不创建关系，也不改写迁移证据。无法证明唯一目标的事项应保持 pending。

## 验证证据

专用测试 `scripts/test-legacy-formula-relation-migration.js` 在一次性副本中覆盖稳定短码、旧短码、
旧 derive 关系、来源缺失、目标歧义、悬空、重复、自环、深环、证据冲突和归档目标，并验证备份、
校验和、方向、递归路径、文章绑定、幂等、零删除、队列不可变、CMS/API 结案及游客 API 投影。
`scripts/test-branching-derivation-graph.js` 覆盖多父、多子、汇合、九节点深环、草稿、归档和逆拓扑导入。
