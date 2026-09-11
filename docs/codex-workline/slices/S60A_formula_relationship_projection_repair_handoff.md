# S60A 公式关系投影修复交接

- `status`: completed；公开公式 API 的确定性 HTTP 500 已按最小范围修复，等待 `A00_ProjectDirector` 验收并重新派发 S60 全量回归。
- `scope_completed`: 先独立复现 `scripts/test-formula-relationship-projection.js` 原第 230 行 `500 !== 200`，并捕获真实公开响应 `HTTP 500 {"error":"server error"}`；随后定位到 `server.js` 的 `publicFormulaCardPayload()`：`truncated` 误声明在 `publicReference` 局部作用域，却在 graph 投影闭包读取，导致公开公式响应构造阶段触发 `ReferenceError`。现已将该只读布尔值提升到函数作用域，并让原测试在失败时保留响应正文。
- `files_created_or_changed`: `server.js`；`scripts/test-formula-relationship-projection.js`；本交接。未修改 `lib/content.js` 或 `scripts/test-formula-detail-page.js`。
- `decisions`: 修复只改变 `truncated` 的可见作用域，不改变图谱节点、边、DAG、三态发布、规范公式路由或 HMAC continuation cursor 的生成与校验；测试仍严格要求 HTTP 200，并继续断言草稿文章、内部绑定 ID、发布管理字段和生命周期内部状态不出现在公开 JSON 中，没有放宽断言。
- `risks`: `npm.cmd run test:security-formula-regression` 为 13 passed / 2 failed；其中 `test:linear-derivation-graph` 仍断言 S59 前的 `formula.html` 必须包含 `renderKnowledgeNodePage`，与已验收的 S59 独立公式页实现冲突；`test:legacy-formula-migration` 在 Windows 临时夹具删除阶段稳定遇到 `EPERM`。两项均发生在本任务未修改且不允许编辑的文件/清理路径，公开表面与私有 CMS 安全专项均独立通过，交由 A00/S60 复跑任务裁决基线更新或环境清理。
- `tests_or_checks`: `npm.cmd run test:formula-relationship-projection` 通过；`node --experimental-sqlite scripts/test-formula-detail-page.js` 通过（含 245 节点继续加载与签名 cursor 门禁）；`npm.cmd run test:formula-publication` 通过；`npm.cmd run test:branching-derivation-graph` 通过；`npm.cmd run test:public-surface` 通过；`npm.cmd run test:private-cms-gateway` 通过；`npm.cmd run codex:contract` 为 1238 passed / 0 warnings / 0 failures。综合安全 runner 的上述两项既有失败已如实保留，未通过修改断言规避。
- `protected_boundaries`: 所有运行时验证沿用系统临时目录隔离数据；未读取或写入当前/生产数据库，未执行 migration、版本修改、部署、云/服务/密钥写入或任何 Git 操作。
- `next_handoff`: 直接回传 `A00_ProjectDirector` 验收 S60A；本 Agent 不自行接受或完整重跑 S60。A00 验收后应重新派发 `S60_formula_workline_regression_rerun`，并裁决安全 runner 中与 S59 契约冲突的旧静态断言及 Windows 临时目录 `EPERM`。
