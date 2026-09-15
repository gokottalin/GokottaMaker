# S68 Home Formula Derivation Consistency Handoff

## status

`accepted`

REQ-20260915-001 已在唯一 A78/S68 执行会话中作为一个原子包完成。首页公式卡、小程序卡、搜索控件及公式/公式推导双视图均已实现，focused、真实浏览器、全部指定回归和最终 contract 全绿；未执行 Git、生产、当前数据、云、部署、迁移、秘密、版本或破坏性操作。

## scope_completed

- 首页与 Maker 首页的搜索框使用最右侧图标提交；有输入时显示 X，一次清空并保持焦点，空值隐藏；鼠标、触屏和 Enter 均进入既有 `/search.html?q=...`。
- Maker 首页公式卡加载既有 KaTeX、`math-renderer.js` 和公式样式，保持完整 `formulaId`，与搜索公式卡统一公式居中、双轴自适应、名称/模块顺序及可见失败兜底。
- 首页小程序卡复用公开卡片 token，具备背景、边框、圆角、阴影、内边距、明暗主题及 hover/focus 反馈；公开焦点模式显式建立 grid，桌面三列等宽同排，`<=760px` 单列通栏。
- `/formula/<slug>` 顶部提供“公式 / 公式推导”双视图；普通公式入口默认单公式卡，推导入口默认图；URL/history 保存视图，刷新、后退、前进和换根均保持一致。
- 推导图节点显示名称及渲染后的结论公式，支持多层展开、节点点击切换公式根；无依赖公式仍显示唯一根及“暂无上游依赖”；超长与无效 LaTeX 均可见降级且无横向溢出。

## route_blocker_and_governance_exception

1. 首次真实复现命令 `node --experimental-sqlite scripts/run-home-formula-derivation-browser-fixture.js` 在 `/assets/vendor/cytoscape.min.js` 得到 HTTP 404；`window.cytoscape` 缺失导致图无法挂载。A78 按原 brief 停止并回传 A00。
2. A00 首轮仅授权把精确路径加入 `publicStaticFiles`；复跑仍为 HTTP 404，因为焦点模式在 `serveStatic` 前由 `isFocusModePublicStaticPath` 拦截。A78 再次停止并回传精确路由链。
3. A00 第二轮把治理例外精确扩展为：同一路径仅加入现有 `publicStaticFiles` 与 `focusModePublicAssetFiles`。最终 `server.js` 差异恰为这两个新增集合项；没有新增前缀、目录白名单、其他资产、API、路由、业务、权限、数据模型或发布语义。

## acceptance_matrix

- `ac.home-formula-parity`: PASS；桌面与 390px 首页公式以 KaTeX 渲染，完整公式与搜索卡结构/顺序一致，超长内容不截断。
- `ac.home-formula-fallback`: PASS；隔离响应注入无效 LaTeX 后显示明确兜底，页面稳定且无横向溢出。
- `ac.miniapp-card-style`: PASS；light/dark 计算样式验证背景、边框、圆角、阴影、内边距及真实鼠标 hover transform。
- `ac.miniapp-responsive`: PASS；1280px 三卡同排等宽，390px 单列通栏且无溢出。
- `ac.search-controls`: PASS；鼠标/触屏/键盘覆盖图标位置、X 条件显示、一次清空和焦点保持。
- `ac.search-submit`: PASS；点击图标与 Enter 均携带相同关键词进入既有独立搜索页。
- `ac.formula-tabs-entry`: PASS；公式卡入口默认公式视图，“查看推导链路”入口默认推导视图，Tab 与 URL 同步。
- `ac.formula-view`: PASS；只显示当前公式单卡，不出现完整 Markdown。
- `ac.derivation-nodes`: PASS；真实 Cytoscape 图覆盖多层 A→B→C、公式名称/KaTeX、节点换根和继续查看链路。
- `ac.derivation-empty`: PASS；无上游依赖时显示唯一根节点与“暂无上游依赖”。
- `ac.view-persistence`: PASS；刷新、跨公式换根、后退和前进均恢复对应视图与当前公式。
- `ac.single-session`: PASS；实现、返工、测试和交接均在同一 A78/S68 会话完成，未创建或委派子 Agent、第二会话或拆分包。

## files_created_or_changed

- `index.html`
- `main.js`
- `search.js`
- `formula.html`
- `formula.js`
- `formula-graph.js`
- `server.js`（仅两个精确 `/assets/vendor/cytoscape.min.js` 集合项）
- `styles/20-content.css`
- `styles/40-formula.css`
- `styles/40-responsive.css`
- `scripts/test-home-formula-derivation-consistency.js`
- `scripts/run-home-formula-derivation-browser-fixture.js`
- `docs/codex-workline/slices/S68_home_formula_derivation_consistency_handoff.md`

brief 允许但本次无需修改的 `derive.html`、`derive.js`、`styles/larkix-home.css` 保持未改。工作树中的 A00 治理文件与历史未跟踪文件为本会话接手前既有状态，A78 未改写。

## decisions

- 保持需求 digest `sha256:3245ca525ff7af0a418b25f88e56b1b9cd517285743259347c0eba8a74f50df9`、`status=dispatched`、Owner confirmed、`openQuestions=0`、`assumptions=0`。
- 复用现有公开公式 API、`/formula/<slug>`、KaTeX、`math-renderer.js`、Cytoscape 和 `formula-graph.js`，不增加数据协议或服务端业务语义。
- 浏览器夹具仅在隔离响应副本中注入无效 LaTeX，不修改公式修订、当前数据库或数据模型。
- 强化 fixture 发现公开焦点模式下 `.home-miniapp-grid` 缺少 `display:grid`；在既有 S68 CSS 中显式建立桌面三列与移动单列，不扩展样式白名单。

## risks

- 未发现剩余功能或门禁风险。A00 已独立复现 S68 focused 与 S67 12/12 保护回归并接受本包。
- 工作树包含 A78 接手前的其他治理和历史未跟踪内容，后续 Git 审核必须继续按明确路径区分所有权。

## tests_or_checks

- `node scripts/test-home-formula-derivation-consistency.js`: PASS，覆盖 12 项 acceptance、两层精确 Cytoscape 白名单、公开首页 grid 和双视图契约。
- `node --experimental-sqlite scripts/run-home-formula-derivation-browser-fixture.js`: PASS；覆盖隔离真实路由、1280px/390px、light/dark、鼠标/触屏/键盘、默认入口、刷新、后退/前进、多层节点、无依赖根、超长/无效 LaTeX、无横向溢出；输出 `S68 cleanup complete`。
- `node scripts/run-discovery-experience-regression.js`: PASS，12 passed / 0 failed，保护边界 PASS，cleanup complete；S60 digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- S65：`test-public-search-home-composition.js` 与真实浏览器 fixture 均 PASS；CSS 最终返工后已补跑。
- S66：`test-public-card-theme-footer-version.js` 与真实浏览器 fixture 均 PASS；CSS 最终返工后已补跑。
- `run-security-formula-regression.js`: PASS，15/15。
- `run-formula-workline-regression.js`: PASS，15/15，digest 与上项 S60 证据一致。
- `test-formula-cms-consolidated.js`: PASS。
- `test-cross-content-discovery-migration.js`: PASS。
- `test-cross-content-discovery-authority.js`: PASS。
- S64：`test-cms-draft-operations-controls.js` 与 `run-cms-draft-operations-browser-fixture.js --verify` 均 PASS，cleanup complete。
- `node --check`: `main.js`、`search.js`、`formula.js`、`formula-graph.js`、`server.js` 及两个 S68 focused 脚本全部 PASS。
- `npm.cmd run codex:contract`: PASS，1329 passed / 0 warnings / 0 failures。
- `git diff --check`: PASS（只有既有 LF/CRLF 提示）；cached diff 为空。
- 边界：`.env`、`database`、`runtime-data`、`uploads`、`.codex-logs` tracked/untracked diff 均为空；`server.js` 仅上述两个精确新增行。
- 隔离与清理：所有 S68 服务/API/浏览器运行使用系统临时目录下 `larkix-s68-browser-*` DATA_DIR 和 `larkix-s68-cdp-*` profile，并由 `finally` 校验路径后清理；最终两类目录残留 0，相关 Node 服务进程残留 0。
- Git staging/commit/push：未执行。

## A00_independent_acceptance

- `node scripts/test-home-formula-derivation-consistency.js`: PASS。
- `node --experimental-sqlite scripts/run-home-formula-derivation-browser-fixture.js`: PASS，cleanup complete。
- `node scripts/run-discovery-experience-regression.js`: 12/12 PASS，S60 digest 精确匹配，protected-boundary PASS，runner DATA_DIR cleanup complete。
- 7 个变更 JavaScript 文件 `node --check`、`git diff --check`、cached diff 与受保护路径检查全部通过。
- A00 裁决：`accepted`；队列收口为空。

## next_handoff

返回 `A00_ProjectDirector`；S68 后无已确认执行包。
