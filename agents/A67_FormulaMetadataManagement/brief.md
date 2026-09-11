# Agent 67 Formula Metadata Management（公式元数据：两级分类与安全迁移）

## Mission

在 A00 接受 S56 后执行 `S58_formula_metadata_management`。修复 CMS 模块、两级分类、标签和修订说明的选择与维护，并提供带引用保护的安全迁移、归档和零引用删除。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260911-001.json`
- `docs/codex-workline/slices/S56_formula_map_contract_handoff.md`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`

## May Edit

- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `scripts/test-formula-metadata-management.js`
- `docs/formula-metadata-management.md`
- `docs/codex-workline/slices/S58_formula_metadata_management_handoff.md`

## Contract

- 分类只保留简洁的两级业务分类；L1/L2/L3 等图谱相对层级不得成为分类。
- 现有模块、分类和标签必须可选、可见、刷新后保持权威状态。
- 修订说明必须正常保存并回显。
- 重命名/合并/迁移需先显示影响；被文章、公式或历史引用的公式卡禁止永久删除，必须先迁移引用或归档。
- 永久删除仅允许零引用对象，经备份、影响预览和二次确认后在隔离数据事务内验证。
- 禁止生产数据和迁移文件修改，除非 A00 另行打开门禁。
