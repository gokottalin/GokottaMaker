# Agent 78 Home Formula Derivation Consistency（首页公式推导一致性）

## Mission

在同一个执行任务内整体完成 `REQ-20260915-001`：统一首页公式卡、首页小程序卡、首页搜索控件，并为公开公式推导页建立可保持 URL/history 状态的“公式 / 公式推导”双视图。不得拆包、不得并行委派。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/requirements/active/REQ-20260915-001.json`
- `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`
- `docs/codex-workline/slices/S66_public_card_theme_footer_version_handoff.md`
- `docs/codex-workline/slices/S67_discovery_experience_regression_handoff.md`
- `index.html`
- `main.js`
- `search.html`
- `search.js`
- `formula.html`
- `formula.js`
- `derive.html`
- `derive.js`
- `formula-graph.js`
- `server.js`
- `data/math-renderer.js`
- `styles/larkix-home.css`
- `styles/20-content.css`
- `styles/40-formula.css`
- `styles/40-responsive.css`
- `scripts/run-discovery-experience-regression.js`

## May Edit

- `index.html`
- `main.js`
- `search.js`
- `formula.html`
- `formula.js`
- `derive.html`
- `derive.js`
- `formula-graph.js`
- `server.js` (only add `/assets/vendor/cytoscape.min.js` to both `publicStaticFiles` and `focusModePublicAssetFiles`)
- `styles/larkix-home.css`
- `styles/20-content.css`
- `styles/40-formula.css`
- `styles/40-responsive.css`
- `scripts/test-home-formula-derivation-consistency.js`
- `scripts/run-home-formula-derivation-browser-fixture.js`
- `docs/codex-workline/slices/S68_home_formula_derivation_consistency_handoff.md`

## Contract

- 需求 digest 必须为 `sha256:3245ca525ff7af0a418b25f88e56b1b9cd517285743259347c0eba8a74f50df9`，且保持 `status=dispatched`、Owner confirmed、`openQuestions=0`、`assumptions=0`。
- 首页公式卡复用搜索公式卡的公开 DTO、完整 `formulaId`、结论 LaTeX 渲染、双轴自适应与失败兜底；不得创建第二套数据协议或泄露非公开状态。
- 首页小程序卡保留原图标与文字，统一卡片背景/边框/圆角/阴影/内边距/悬停和 light/dark；桌面同排等宽，390px 单列通栏且无横向溢出。
- 首页搜索只保留右侧图标提交与有值时的 X；X 一次清空并保持焦点，空值隐藏；Enter 与图标进入同一既有搜索路由并携带当前关键词。
- 公式推导页顶部提供“公式 / 公式推导”双视图；普通公式入口默认公式，链路入口默认推导；URL、刷新、history back/forward 保持视图，不覆盖首次入口语义。
- 公式视图只展示与搜索一致的当前公开公式单卡；推导节点展示名称与渲染后的结论公式，节点点击切换对应公式视图并可继续以新根查看链路；换根不得残留旧图。
- 无上游依赖时仍显示唯一根节点与“暂无上游依赖”；LaTeX 失败和超长必须可见降级且页面稳定。
- A00 已独立确认真实路由的两层白名单阻断；`server.js` 仅授权把现有 `/assets/vendor/cytoscape.min.js` 精确加入 `publicStaticFiles` 与 `focusModePublicAssetFiles`。不得改其他静态路径、前缀、路由、API、业务逻辑、权限、数据模型或发布语义。

## Checks

- `node scripts/test-home-formula-derivation-consistency.js`
- `node --experimental-sqlite scripts/run-home-formula-derivation-browser-fixture.js`
- `node scripts/run-discovery-experience-regression.js`
- `node scripts/test-public-search-home-composition.js`
- `node --experimental-sqlite scripts/run-public-search-home-browser-fixture.js`
- `node scripts/test-public-card-theme-footer-version.js`
- `node --experimental-sqlite scripts/run-public-card-theme-footer-browser-fixture.js`
- `node scripts/run-security-formula-regression.js`
- `node scripts/run-formula-workline-regression.js`
- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`
- `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js`
- `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`
- `node scripts/test-cms-draft-operations-controls.js`
- `node --experimental-sqlite scripts/run-cms-draft-operations-browser-fixture.js --verify`
- `npm.cmd run codex:contract`
- `node --check` for every changed JavaScript file and focused test
- `git diff --check`, protected paths, cached diff, process/temp residue checks

真实浏览器必须覆盖桌面与 390px、light/dark、键盘/鼠标/触屏、入口默认、刷新、后退/前进、多层节点、无依赖根、超长/无效 LaTeX 和无横向溢出。所有服务/API/浏览器测试只能使用隔离临时 `DATA_DIR` 并在 `finally` 清理。

## Forbidden

拆包或创建第二执行任务；独立搜索筛选/排序重设计；除将 `/assets/vendor/cytoscape.min.js` 加入 `publicStaticFiles` 与 `focusModePublicAssetFiles` 外的任何 `server.js` 修改；API；数据模型；发布语义；完整 Markdown/编辑；浏览量、常用等级、聚焦或排序变更；当前/生产数据；Git；部署；云；服务；秘密；迁移；版本；mayEdit 外文件；reset/checkout/破坏性操作。

## Handoff

完成后写 `docs/codex-workline/slices/S68_home_formula_derivation_consistency_handoff.md`，逐条覆盖全部 12 个 acceptance ID、实际写集、隔离/清理证据、focused 与全回归，并直接回传 A00 独立复核。A78 不执行 Git；A00 accepted 前不得启动任何后续包。
