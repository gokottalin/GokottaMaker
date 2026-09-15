# Agent 75 Public Search & Home Composition（公开搜索与首页编排）

## Mission

基于 S63 已验收的公开搜索、浏览量与首页数据权威，以及 S64 已验收的 CMS 配置，交付独立公开搜索页和首页最新公式/三卡聚焦编排。只处理公开搜索与首页表面，不扩展到 S66 的全站统一主题、页脚、版本或其他页面卡片改造。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/requirements/active/REQ-20260913-006.json`
- `docs/codex-workline/requirements/active/REQ-20260913-008.json`
- `docs/codex-workline/requirements/active/REQ-20260913-009.json`
- `docs/codex-workline/requirements/active/REQ-20260913-010.json`
- `docs/codex-workline/slices/S63_cross_content_discovery_authority_handoff.md`
- `docs/codex-workline/slices/S64_cms_draft_operations_controls_handoff.md`

## May Edit

- `index.html`
- `main.js`
- `search.html`
- `search.js`
- `server.js`（仅限公开静态白名单：`/search.html`、`/search.js` 与 `/styles/40-formula.css`）
- `styles/larkix-home.css`
- `styles/20-content.css`
- `styles/40-formula.css`
- `styles/40-responsive.css`
- `scripts/test-public-search-home-composition.js`
- `scripts/run-public-search-home-browser-fixture.js`
- `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`

## Contract

- 首页搜索提交后进入独立搜索页；搜索页只有文章、开源项目、推导节点、公式、小程序五个固定标签，默认文章，无综合标签。
- 单字符即时搜索、清空展示当前类型全部公开内容、四种排序和适用筛选均直接消费 S63 权威 API；取消旧请求，避免旧响应覆盖新查询。
- 搜索和卡片不得暴露草稿、归档、内部等级、私有路径或内部元数据。
- 搜索结果卡片在当前表面展示准确的紧凑浏览量、精确无障碍值、适用时长和类型元数据；公式卡完整渲染结论 LaTeX，不截断。
- 首页按公开推导节点、最新 8 个公式、三卡聚焦内容、电子基础的相对顺序展示；失效聚焦槽位隐藏且不得自动替换。
- 保留现有公开详情入口、Hero、formula-ref、依赖链路与发布隐私。

## Checks

- S65 聚焦静态/API/真实浏览器检查
- S63 authority 与 migration 回归
- S64、S50、S60、S62 回归
- `npm.cmd run codex:contract`
- `git diff --check`

所有运行时检查只用隔离 `DATA_DIR`，结束后清理进程和临时目录。

## Forbidden

除上述精确公开静态白名单外的后端/API 修改；迁移/CMS 修改；S66 全站统一卡片、主题首帧、页脚、版权或版本范围；生产或当前数据、秘密、云、部署、Git staging/commit/push、破坏性清理。

## Handoff

完成后写入 `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`，直接回传 A00 任务 `01a09b08-eace-7d90-82e8-00e71331b369` 独立复核。A00 未接受时由本会话返工；不得自行启动 S66。
