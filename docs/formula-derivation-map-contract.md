# 公式推导地图 JSON 契约

机器真源唯一为 [`schemas/formula-derivation-map.schema.json`](../schemas/formula-derivation-map.schema.json)，契约版本为 `larkix.formula-derivation-map.v1`。公开端、CMS、测试与后续分页接口都应投影到这一结构；本文只解释语义，不另建字段定义。

## 方向与拓扑

所有边均按 `source -> target` 解释。`formula_dependency` 表示“来源公式依赖目标公式”，`article_reference` 表示“文章来源引用目标公式”。地图是 DAG，不限制层数；`rank` 仅是相对当前公式的布局提示，不是深度上限，也不能替代拓扑计算。分支与汇入均合法，自环或任意多节点循环均拒绝。

`currentNodeId` 必须指向唯一的 `current=true` 公式节点。公式节点只能使用 `ancestor/current/dependency`，文章节点固定使用 `article`。边端点、`initialNodeIds` 与 `expandableNodeIds` 必须引用本响应内存在的节点。

## 来源、状态与投影

顶层可选 `source` 记录本次地图所依据的公式卡或文章及其修订。`mode=current` 是 CMS 投影，可携带 `formulaId`、`revisionId`、`postId`、发布/归档状态、待发布标记以及边的 `provenance/ordinal`。`mode=published` 是公开投影，禁止这些内部身份和状态字段；只使用公开 slug/route 作为可导航身份，因此草稿、归档、私有修订不能因图关系泄露。

现有 `lib/content.js` 生成的 `card.graph` 与 `server.js` 的公开 `graph` 已落在核心必填字段上；`contractVersion`、`source`、`continuation` 为向后兼容的可选扩展。消费者不得根据缺少这三个字段推断旧数据有深度上限。

## 截断与继续加载

`limits.initialNodes` 只控制默认聚焦集合，`limits.payloadNodes` 控制单次载荷，两者都不是全图深度。未截断时 `truncated=false`，不得携带非空继续游标。截断时必须同时返回：

- `truncated=true`；
- `continuation.hasMore=true`；
- 符合 `base64url.base64url` 形态的不可解释游标。

游标应由服务端签发并绑定投影模式、根节点、可见性边界、稳定排序位置和数据版本；客户端不得拼接或修改。续页仍返回同一契约，合并时按节点/边 ID 去重并再次执行 DAG 校验。当前生产者只有 `truncated` 与 `limits`，尚未提供继续游标；因此一旦实际截断，响应不满足完整分页语义，须由后续 API 实现任务补齐，S56 不修改运行时行为。

## 校验边界

JSON Schema 校验字段、类型、枚举与游标外形；根引用、端点、边类型、投影隔离、截断一致性和无环性属于 schema 中 `x-semanticRules` 声明的跨记录语义。生产者与消费者必须同时执行两层校验，不能只把 JSON Schema 可解析视为契约通过。
