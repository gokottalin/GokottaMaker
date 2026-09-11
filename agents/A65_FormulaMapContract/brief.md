# Agent 65 Formula Map Contract（公式地图契约：建立唯一无限深度 JSON 接口）

## Mission

执行 `S56_formula_map_contract`。为公式推导地图建立唯一、可机器校验的 JSON 契约，并让现有公开/CMS 生产者与消费者明确以该契约为准。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/requirements/active/REQ-20260824-001.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260911-001.json`
- `schemas/formula-derivation-map.schema.json`
- `server.js`
- `lib/content.js`
- `formula-graph.js`
- `post.js`
- `admin/admin.js`

## May Edit

- `schemas/formula-derivation-map.schema.json`
- `docs/formula-derivation-map-contract.md`
- `scripts/test-formula-derivation-map-contract.js`
- `AGENTS.md`
- `docs/codex-workline/slices/S56_formula_map_contract_handoff.md`

## Contract

- 只定义并验证唯一契约，不改数据库、迁移、生产数据或现有业务 API 行为。
- 契约必须覆盖文章来源、公式节点、公式依赖边、无限深度 DAG、循环拒绝、公开/CMS 投影、状态、截断与继续加载。
- `AGENTS.md` 只增加一个简短机器入口指针。
- 对现有 API 响应运行 fixture/静态契约验证；发现生产者不一致时记录为后续任务，不越界修改 `server.js`。
- 中文交接；完成后直接回传 A00。

## Done When

- Schema 可解析并能接受合法分支/汇入/六层 DAG fixture。
- Schema 拒绝循环语义、非法节点类型、泄露草稿身份的公开 fixture 与无效截断游标。
- 文档解释方向、动态层级、状态投影和兼容边界。
- 专项测试与 `npm.cmd run codex:contract` 通过。
