# S47 公式绑定权威模型交接

## status

`complete_and_accepted_by_A00`

## scope_completed

- 新增 `028_formula_content_bindings`，以一张 `formula_content_bindings` 表统一保存文章到公式、公式修订到下一级公式两类稳定语义关系。
- 新增不可变 `formula_content_binding_sources` 来源映射，保留旧文章绑定、公式修订依赖和手工边的摘要与出处。
- 迁移按语义键幂等去重；一篇文章多次引用同一公式时只生成一条权威关系，但 `location_json.references` 保留每个位置、修订、显示模式和顺序。
- 公式依赖在插入、重新激活以及切换当前修订时继续拒绝自引用和循环；文章关系完全不进入 DAG 检查。
- 帮助层提供按来源/目标查询与事务性同步；移除关系只标记 `retired`，不物理删除权威关系或旧来源。

## files_created_or_changed

- `migrations/028_formula_content_bindings.js`
- `lib/content.js`
- `lib/validators.js`
- `scripts/test-formula-binding-authority.js`
- `package.json`
- `docs/codex-workline/slices/S47_formula_binding_authority_handoff.md`

## decisions

- 权威唯一键为 `(source_kind, source_id, target_formula_id)`；展示位置不是第二套关系。
- `article` 的 `source_id` 是文章稳定 ID；`formula_revision` 的 `source_id` 是不可变修订 ID，并同时保存 `source_formula_id`。
- 旧表暂时保留为兼容与回滚来源。S48 负责让创作 CRUD 写入权威帮助层并派生 CMS/游客投影。
- 迁移文件由现有目录加载器自动执行；未修改迁移索引或生产数据。

## risks

- S47 只建立数据权威和帮助层，现有 API/CMS 尚未全部改为写入该表；该切换属于 S48。
- 尚未在生产数据库运行迁移，也未执行生产备份、部署、版本或 Git 写入。

## tests_or_checks

- `npm.cmd run test:formula-binding-authority`：通过；覆盖新库、旧数据去重、多位置、多文章、分支复用、自环/循环、退役、幂等、备份计数和旧表保留。
- `npm.cmd run test:article-formula-authoring`：通过。
- `npm.cmd run test:formula-publication`：通过。
- `npm.cmd run test:branching-derivation-graph`：通过。
- `npm.cmd run test:legacy-formula-migration`：通过。
- `node --experimental-sqlite scripts/test-legacy-formula-relation-migration.js`：通过；二次插入为 0，零删除为真。
- `npm.cmd run test:formula-reference-versioning`：通过。
- `npm.cmd run codex:contract`：`1089 passed, 0 warnings, 0 failures`。

## next_handoff

- `Agent 57 Formula Relationship Projection（公式关系投影：从统一绑定派生公开与 CMS 反向引用、生命周期和图谱数据）`。
