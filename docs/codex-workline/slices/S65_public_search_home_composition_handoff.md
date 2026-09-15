# S65 Public Search & Home Composition Handoff

## status

accepted

## scope_completed

- 新增独立公开搜索页，固定文章、开源项目、推导节点、公式、小程序五类型；默认文章，无综合类型。
- 搜索页直接消费 S63 权威公开搜索 API，支持单字符 OR 搜索、清空后当前类型全量、排序、分类、日期、适用时长与分页续载；AbortController 与请求序号共同阻止旧响应覆盖新查询。
- 搜索结果卡提供紧凑浏览量、精确无障碍值、适用时长、公开类型元数据及完整公式结论；公式按宽高双轴缩放，不截断结论。
- 首页搜索改为独立页路由；聚焦模式相对顺序为公开推导节点、最新 8 个公式、三槽聚焦内容、电子基础。
- 首页严格使用 S63 `latestFormulas` 与 `focusedArticles`；失效槽位留空且不自动替换，large/small-1/small-2 身份保持互异。
- `server.js` 仅按 S65 最小后端例外加入 `/search.html`、`/search.js` 与 `/styles/40-formula.css` 三个公开静态白名单项；未修改 API、业务逻辑或权限。

## files_created_or_changed

- `index.html`
- `main.js`
- `search.html`
- `search.js`
- `server.js`
- `styles/larkix-home.css`
- `styles/20-content.css`
- `styles/40-formula.css`
- `styles/40-responsive.css`
- `scripts/test-public-search-home-composition.js`
- `scripts/run-public-search-home-browser-fixture.js`
- `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`

已验证的 S65 治理登记同时位于：

- `.codex/larkix-governance.json`
- `.codex/agents/a75-public-search-home-composition.toml`
- `PROJECT_WINDOW.md`
- `agents/A00_ProjectDirector/brief.md`
- `agents/A75_PublicSearchHomeComposition/brief.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/prompts/next_agents.md`

## decisions

- A75 受会话文件系统限制，仅产出受控片段；A00 在 E 盘真实仓库逐项审阅后应用，并独立修正焦点布局选择器、公开路由净化、旧响应门禁、失效槽位空置及公式宽高双轴适配。
- 首轮真实浏览器检查准确复现 `/search.html` 404。A00 裁决 `rejected_with_rework` 后，派发侧只为三个静态资源登记 `server.js` 最小例外；A00 随后按该白名单落地并复测。
- 真实浏览器夹具在隔离数据库中发布 8 个公式并配置三个聚焦槽位，直接验证渲染数量与槽位身份，不以空数据页面替代业务验收。

## risks

- 公式展示依赖现有 `LarkixMath` 渲染器；渲染失败时保留完整文本回退。
- 搜索单次请求沿用 S63 的最大 `pageSize=50`，更多结果通过显式“加载更多”获取。
- S66 的全站主题、页脚、版权、版本和其他页面卡片统一未在本包处理。

## tests_or_checks

- 四份来源需求 `REQ-20260913-006/008/009/010`：schema validate 全部通过；digest 与派发值 4/4 一致；`status=dispatched`、Owner confirmed、`openQuestions=0`、`assumptions=0`。
- `node scripts/test-public-search-home-composition.js`：PASS。
- `node --experimental-sqlite scripts/run-public-search-home-browser-fixture.js`：PASS；真实 Edge/Chrome、390px 窄屏、8 个公式、large/small-1/small-2 三槽位均命中。
- `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js`：PASS。
- `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`：PASS。
- `node scripts/test-cms-draft-operations-controls.js`：PASS。
- `node --experimental-sqlite scripts/run-cms-draft-operations-browser-fixture.js --verify`：PASS，cleanup complete。
- `node scripts/run-security-formula-regression.js`：15 passed, 0 failed。
- `node scripts/run-formula-workline-regression.js`：15 passed, 0 failed；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`：PASS。
- `npm.cmd run codex:contract`：1299 passed, 0 warnings, 0 failures。
- `node --check`、`git diff --check`：PASS；只有既有 LF/CRLF 提示。

所有 API/浏览器检查均使用临时隔离 `DATA_DIR` 并完成清理；未触碰当前/生产数据、云、部署、秘密、迁移或越界业务文件。

## next_handoff

A00 已独立裁决 S65 为 `accepted`。仅在本包精确 commit/push 完成并由派发侧显式登记开放后，才可串行启动 S66；S67 继续关闭。
