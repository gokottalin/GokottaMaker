# S36 推导工作流恢复交接

status: completed

scope_completed:

- 将公式关系统一为 `来源公式 -> 依赖公式` 的 revision-aware DAG；保存、迁移和目录导入共用存在性、重复、自环、悬空与成环校验。
- 游客公式详情、逐步导航和图谱只读取带发布审计的已发布修订，并过滤草稿、待发布和归档端点。
- 目录导入先写卡片、不可变修订、关系和发布审计，再按依赖优先的逆拓扑顺序切换指针。
- 新增 027：只追加关系修复队列、修复事件、迁移报告，以及发布投影和依赖资格触发器。
- 新增只接受系统临时 disposable fixture 的关系迁移引擎与 CLI；默认 dry-run，显式 `--apply` 才写隔离副本。
- 恢复稳定 formulaId 短码、唯一旧 derive 短码和一致的旧 derive 关系；只处理 `link_kind='derive'`。
- 歧义、来源/目标缺失、重复、自环、冲突、环、归档目标和来源无修订均进入稳定 ID 的追加队列；不猜目标、不改旧映射、不删除旧数据。
- CMS 增加待修复筛选、证据展示、来源公式入口和追加式结案/重开；结案前 API 必须反查真实不可变依赖关系。
- 游客公式页增加多分支逐步导航，并保留未公开/归档依赖的匿名边界提示。
- 新增恢复操作文档、迁移专测，并扩展分支 DAG 与旧迁移启动回归。

files_created_or_changed:

- `migrations/027_formula_relation_repairs.js`
- `lib/legacy-formula-relation-migration.js`
- `scripts/migrate-legacy-formula-relations.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `post.js`
- `scripts/test-branching-derivation-graph.js`
- `scripts/test-legacy-formula-migration.js`
- `scripts/test-legacy-formula-relation-migration.js`
- `docs/legacy-formula-relation-recovery.md`
- `docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md`

decisions:

- 稳定 `{{formula-ref:formulaId}}` 为权威证据；旧短码和旧关系只能在唯一映射且彼此一致时自动恢复。
- 普通 `reference` 等旧链接不属于推导 DAG，保持原样且不排入关系修复队列。
- repair queue、repair events 和 migration reports 全部不可更新、不可删除；最新事件按 SQLite 追加 rowid 判定，避免同秒随机 event ID 排序错误。
- CMS 结案只记录复核结果，不创建关系；操作员必须先通过正常公式保存流程生成已校验的新修订。
- 公开 API 继续只暴露 slug/referenceKey，不向游客返回 formulaId、修订 ID、迁移证据或 repair 信息。
- dry-run 显式报告 `zeroDeletion: true`，apply 额外比较旧节点、旧修订、旧关系、不可变映射、卡片、公式修订和文章绑定摘要。

risks:

- 未对当前、生产或任何真实数据副本执行迁移；真实证据中的歧义数量和人工修复工作量仍未知。
- 已发布来源的依赖目标随后被归档时，游客端会隐藏该端点；来源再次发布前会被发布门禁阻止，需先完成内容决策。
- CMS 已通过静态契约与隔离 API 验证，按禁令未重启或接管现有服务，也未对当前服务做人工视觉操作。
- 仓库原有多 Agent 未提交改动仍存在；本任务未撤销、覆盖或写入 mayEdit 之外文件。

tests_or_checks:

- `node --check`：027、关系迁移引擎、CLI、validators、content、server、admin、post、两份专项测试均通过。
- `node --experimental-sqlite scripts/test-legacy-formula-relation-migration.js`：隔离备份/恢复 SHA、方向、三层递归路径、文章绑定、8 类待修复证据、队列不可变、CMS/API 结案、游客 API、4 条关系恢复、9 条队列项、二次执行 0 新增、零删除通过。
- `npm.cmd run test:branching-derivation-graph`：多父、多子、汇合、九节点深环、悬空、草稿、归档、公开边界和逆拓扑导入通过。
- `npm.cmd run test:legacy-formula-migration`：S21 备份、应用、幂等、清理门禁、回滚和真实 HTTP 308 回归通过；027 启动建表不改旧行。
- `npm.cmd run test:formula-publication`：通过。
- `npm.cmd run test:formula-catalog`：60 卡 CRUD、修订、归档、分页、快照、API 与游客预览通过。
- `npm.cmd run test:article-formula-authoring`：文章公式绑定、原子建卡、回滚、抽屉、渲染与 API 通过。
- `npm.cmd run test:formula-reference-versioning`：版本决策、旧修订渲染、归档、API 与 CMS 契约通过。
- `npm.cmd run test:markdown`、`npm.cmd run test:formula-authoring-drawer`、`node --experimental-sqlite scripts/test-formula-binding-marker.js`、`node --experimental-sqlite scripts/test-article-formula-selection-create.js`：通过。
- `npm.cmd run codex:contract`：929 passed，0 warnings，0 failures。
- 未访问当前/生产数据、云、部署或现有服务；未执行任何 Git 写操作。

next_handoff:

- `A00_ProjectDirector`：复核 S36 差异与最终 contract 输出；后续若要评估真实迁移，只能先制作受控隔离副本并从 dry-run 报告开始，不得直接对当前/生产数据运行。
