# S48 公式关系投影交接

## 状态

`complete_and_accepted_by_A00`

## 已完成

- 文章保存、更新和解绑会同时维护兼容表与 `formula_content_bindings` 唯一关系权威；同一文章多次引用同一公式时聚合为一条关系，并保留全部位置。
- 新公式修订和目录导入会把推导依赖同步至关系权威；公开和管理图谱均从权威表读取，旧表不再决定页面关系。
- 管理端公式关系图包含草稿与已发布文章节点，并显示发布/删除生命周期状态；公式节点继续遵守无自环、无循环的 DAG 约束。
- 公开公式 API 在序列化前重新执行发布与聚焦范围检查，只返回可公开访问的文章和公式关系，不输出绑定 ID、草稿名称或管理状态。
- 文章显式解绑会退休关系；文章硬删除前会退休全部文章关系，避免孤立边；旧关系接口和历史来源表继续保留。

## 文件

- `server.js`
- `lib/content.js`
- `scripts/test-formula-relationship-projection.js`
- `scripts/test-branching-derivation-graph.js`
- `package.json`
- `docs/codex-workline/slices/S48_formula_relationship_projection_handoff.md`

## 验证

- `npm.cmd run test:formula-binding-authority`：通过。
- `npm.cmd run test:formula-relationship-projection`：通过；覆盖权威同步、草稿/发布投影、聚焦范围、解绑、硬删除和公开 API 脱敏。
- `npm.cmd run test:branching-derivation-graph`：通过。
- `npm.cmd run test:linear-derivation-graph`：通过。
- `npm.cmd run test:legacy-formula-migration`：通过。
- `npm.cmd run test:article-formula-authoring`：通过。
- `npm.cmd run test:formula-publication`：通过。
- `npm.cmd run test:formula-reference-versioning`：通过。
- `npm.cmd run codex:contract`：`1089 passed, 0 warnings, 0 failures`。

## 边界

- 未修改当前或生产数据库，所有数据验证均使用隔离目录。
- 未部署、未变更版本、未写入真实私有入口、未执行任何 Git 操作。
- 角标视觉、文章/公式节点交互和响应式浏览器验收属于 S49。

## 下一交接

`Agent 58 Formula Marker Graph UI（公式角标与图谱界面：统一紫色右上角跳转并区分文章和公式节点）`
