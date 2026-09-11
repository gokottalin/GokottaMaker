# Agent 70 Formula Relationship Projection Repair（关系投影修复：消除公开公式 API 500）

## Mission

执行 `S60A_formula_relationship_projection_repair`。稳定复现并修复 `scripts/test-formula-relationship-projection.js:230` 的公开公式 API HTTP 500，保持 S56-S59 的契约和安全边界。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260911-001.json`
- `docs/codex-workline/slices/S56_formula_map_contract_handoff.md`
- `docs/codex-workline/slices/S58_formula_metadata_management_handoff.md`
- `docs/codex-workline/slices/S59_formula_detail_page_handoff.md`
- `docs/codex-workline/slices/S60_formula_workline_regression_handoff.md`
- `scripts/test-formula-relationship-projection.js`
- `server.js`
- `lib/content.js`

## May Edit

- `server.js`
- `lib/content.js`
- `scripts/test-formula-relationship-projection.js`
- `scripts/test-formula-detail-page.js`
- `docs/codex-workline/slices/S60A_formula_relationship_projection_repair_handoff.md`

## Contract

- 先捕获并记录 500 的真实响应或异常根因，再做最小修复。
- 公开投影必须继续排除草稿文章、内部绑定 ID、发布管理字段和生命周期内部状态。
- 不得削弱 HMAC continuation cursor、canonical formula route、DAG 或三态发布规则。
- 禁止迁移、当前/生产数据、部署、云、服务、秘密、版本或 Git 写入。
- 完成后直接回传 A00，不自行重跑或接受 S60。

## Done When

- 原失败测试稳定通过且不靠放宽断言。
- 公式详情页、发布、分支 DAG 与安全相关回归通过。
- 全局 `codex:contract` 通过。
- 中文 handoff 说明根因、修复和边界。
