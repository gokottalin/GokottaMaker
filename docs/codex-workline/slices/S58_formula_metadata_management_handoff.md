# S58 公式元数据管理交接

- `status`: completed，等待 `A00_ProjectDirector` 执行 Wave 2 验收。
- `scope_completed`: 公式分类已收敛为“大类”或“大类/小类”两级，并阻止 `L1/L2/L3` 等动态图谱层级；CMS 从服务端权威分类加载模块、当前模块分类和标签，保留搜索、键盘/鼠标选择及明确新增；修订说明不再被 `manual-save` 覆盖，保存后按不可变修订回显；新增统一的影响预览、重命名、合并、单张/批量/分类整体迁移、归档、恢复和受保护永久删除事务接口，CMS 提供影响、重命名、合并、迁移与删除入口。
- `files_created_or_changed`: `server.js`；`lib/content.js`；`lib/validators.js`；`admin/index.html`；`admin/admin.js`；`scripts/test-formula-metadata-management.js`；`docs/formula-metadata-management.md`；本交接。保留了 S57 已存在的 `admin/admin.css` 变更，本任务未改写该变更。
- `decisions`: 元数据生命周期统一走 `POST /api/admin/formula-metadata/operate`；批量上限 200；每次危险操作先返回卡片状态、文章引用、公式依赖和当前/历史绑定；有任一引用的卡片禁止永久删除；零引用永久删除同时要求 `backupConfirmed: true` 与精确二次确认文本 `PERMANENTLY DELETE`；写操作与审计位于同一外层事务；迁移只更新卡片当前分类，不改 formulaId、slug、正文、不可变修订、文章绑定或推导边。
- `risks`: 本任务没有迁移任何既有真实分类，也未接触当前/生产数据；Owner 示例映射只能在后续独立生产门禁、完整备份和影响核对后执行。现有仓库存在大量本任务外工作树状态，验收须按本交接列出的精确文件集审阅。
- `tests_or_checks`: `node --experimental-sqlite scripts/test-formula-metadata-management.js` 通过；`test-formula-catalog.js`、`test-formula-publication-workflow.js`、`test-formula-identity-automation.js`、`test-article-formula-authoring.js`、`test-formula-reference-versioning.js`、`test-branching-derivation-graph.js` 通过；`test-formula-authoring-drawer.js`、`test-formula-marker-graph-ui.js` 通过；`npm.cmd run codex:contract` 为 1226 passed / 0 warnings / 0 failures；限定文件 `git diff --check` 通过，仅有仓库既有 LF/CRLF 提示。
- `protected_boundaries`: 未创建或修改 migration 文件；未读取或写入当前/生产数据库；未执行部署、云/服务/密钥写入、Git staging、commit 或 push。
- `next_handoff`: 直接回传 `A00_ProjectDirector` 执行 `A00_wave2_acceptance`；只有验收 S58 后才可按派工序列开放 S59。
