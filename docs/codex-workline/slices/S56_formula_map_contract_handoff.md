# S56 公式地图契约交接

- `status`: completed
- `scope_completed`: 已建立唯一的无限深度公式推导地图 JSON Schema、跨记录语义校验与契约说明；覆盖文章来源、公式节点、两类依赖边、DAG、循环拒绝、公开/CMS 投影、状态、截断及继续加载。
- `files_created_or_changed`: `schemas/formula-derivation-map.schema.json`；`docs/formula-derivation-map-contract.md`；`scripts/test-formula-derivation-map-contract.js`；`AGENTS.md`；本交接。
- `decisions`: 边统一解释为 `source -> target`；`formula_dependency` 表示来源公式依赖目标公式；不设层数上限，`rank` 仅作布局提示；Schema 负责结构，`x-semanticRules` 与专项测试负责无环、引用完整性、投影隔离和游标一致性；兼容现有 graph 核心字段，新增契约版本、来源和继续加载字段保持可选。
- `risks`: 当前 `lib/content.js` / `server.js` 生产者能生成兼容的未截断核心结构，但实际截断时只返回 `truncated/limits`，没有不透明继续游标，尚不满足完整继续加载语义；应由后续 API 实现任务补齐，本任务未越界修改运行时。现有运行时也未主动执行本契约验证，后续接入时须同时执行 JSON Schema 与语义规则。
- `tests_or_checks`: `node scripts/test-formula-derivation-map-contract.js`；`npm.cmd run codex:contract`。
- `next_handoff`: 直接回传 `A00_ProjectDirector`，由 A00 在 Wave 1 同时验收 S56 与 S57 后决定是否开放 S58。
