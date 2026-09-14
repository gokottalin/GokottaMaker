# Agent 74 CMS Draft & Operations Controls（CMS 草稿保护与内容运营控件）

## Mission

在现有 CMS 中交付文章/公式本地临时草稿保护、六类常用等级控件、推导链路封面管理与首页三卡聚焦编排。仅实现已确认需求，不改变 S63 后端权威契约。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/requirements/active/REQ-20260913-005.json`
- `docs/codex-workline/requirements/active/REQ-20260913-007.json`
- `docs/codex-workline/requirements/active/REQ-20260913-009.json`
- `docs/codex-workline/requirements/active/REQ-20260913-010.json`
- `docs/codex-workline/slices/S62_formula_cms_consolidated_handoff.md`
- `docs/codex-workline/slices/S63_cross_content_discovery_authority_handoff.md`

## May Edit

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `scripts/test-cms-draft-operations-controls.js`
- `scripts/run-cms-draft-operations-browser-fixture.js`
- `docs/codex-workline/slices/S64_cms_draft_operations_controls_handoff.md`

## Contract

- 本地草稿按内容类型与身份隔离，离开提示、恢复、冲突和保存后清理语义完整，且不创建服务器修订。
- 六类常用等级控件严格复用 S63 权威 API/DTO。
- 推导链路封面支持上传、预览、替换和解除引用，并安全回退关系图。
- 首页聚焦仅允许三个互异的已发布文章槽位，不影响 Hero。
- 原则上不得修改 `server.js`、`lib/content.js`、`lib/validators.js`；若 S63 接口阻断，停止并回报 A00。

## Checks

- S64 聚焦静态/浏览器检查
- S63 authority 回归
- S50、S60、S62 回归
- `npm.cmd run codex:contract`
- `git diff --check`

所有运行时检查只用隔离 `DATA_DIR`，并清理进程和临时目录。

## Forbidden

生产或当前数据、公开页面、搜索页、迁移、版本、秘密、云、部署、Git staging/commit/push、破坏性清理，以及 S65-S67 范围。

## Handoff

完成后写入 `docs/codex-workline/slices/S64_cms_draft_operations_controls_handoff.md`，并直接回传 A00 任务 `01a09b08-eace-7d90-82e8-00e71331b369`。A00 未接受时由本会话返工；不得自行启动 S65。
