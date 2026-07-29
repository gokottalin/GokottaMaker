# S26 全站夜间主题交接

- 执行 Agent：`A32_FullSiteDarkTheme`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-009`
- 状态：`accepted_by_A00`
- next_handoff：`A00_ProjectDirector`

## status

实现、确定性审计、可完成回归和代表性浏览器取证已完成。未修改业务状态、
current/production 数据、云端、部署或 Git；等待 A00 独立复测与接受。

## scope_completed

1. `styles.css` 最后导入 `styles/28-full-site-dark.css`，提供游客端共享暗色
   token 与末端覆盖。
2. 首页公开推导空状态、Markdown、代码、数学、公式依赖/不可用状态、图画布、
   工具外壳及 success/warning/error/draft/published/archived/disabled/selected
   状态已覆盖。
3. `admin/admin-dark.css` 修复 CMS 聚焦门禁、可见性提示、公式抽屉/推导/状态/
   待决策、轮播缓冲、模态和课程路径表面。
4. 两个 CMS 页面都在 `admin.css` 后挂载暗色层；课程路径页接入现有主题按钮与
   `footer.js`，未改主题持久化逻辑。
5. 新增确定性测试，核验 14 个主页面、共享 token、手动/系统主题、状态选择器、
   受保护文件排除、暗色作用域和 AA token 对比度。
6. 根据 A00 独立复测，在 `admin/admin-dark.css` 增加 `1181–1320px`
   light/dark 共用双行顶栏兼容断点，消除品牌区与首个导航项的实际重叠。

## shared_token_selector_contract

- 表面：`--theme-dark-canvas/surface/surface-raised/surface-strong`
- 文字：`--theme-dark-text/muted/link/link-hover`
- 边框与焦点：`--theme-dark-border/border-strong/focus`
- 控件：`--theme-dark-disabled/selected-bg`
- 状态：`--theme-dark-success/warning/error/draft/published/archived`
- 代码：`--theme-dark-code-bg/code-text`
- 手动暗色：`[data-theme="dark"]`
- 系统回退：`@media (prefers-color-scheme: dark)` +
  `:root:not([data-theme="light"])`
- 显式 light 优先；所有新普通规则都在暗色或打印作用域内。
- `!important` 仅 1 处，用于覆盖只读源中的公式发布警告文字色。
- 唯一非主题作用域规则为 `1181–1320px` CMS 顶栏兼容断点，选择器白名单仅含
  `.admin-sidebar`、品牌、导航、主题按钮、导航组和导航链接。

## full_page_matrix

| 范围 | 页面 | 结果 |
| --- | --- | --- |
| 入口/首页 | `/`、`maker.html` | 通过；公开推导空状态已转暗 |
| 分类/正文/推导 | `category.html`、`post.html`、`derive.html` | 通过 |
| 项目 | `projects.html`、`project.html` | 通过 |
| 小程序/错误页 | `miniapps.html`、`404.html` | 通过 |
| 工具 | `md2doc.html`、`larkix-elec.html`、`gokotta-elec.html` | 通过 |
| CMS | `admin/index.html`、`admin/course-paths.html` | 通过 |

受聚焦模式隐藏的页面使用只读静态服务复核，未切换或写入业务状态。

## browser_evidence

代表页为游客 `maker.html`、CMS `admin/index.html`、工具
`tools/md2doc.html`。在 `1280x800`、`800x900`、`360x800` 下完成
light/dark 共 18 个场景：

- 18/18 `overflow=0`，破图 0。
- light/dark 的 `main`、`header`、`scrollHeight` 完全一致。
- 三个代表页控制台 `logs=[]`。
- 另完成 14 页桌面/半宽/移动 light/dark 样式扫描；非装饰亮面泄漏为 0。
- 仅保留三张暗色代表截图作会话目检，未写入仓库；没有继续扩展截图数量。

已确认计算色：

- 首页公开推导空状态：背景 `rgb(27,16,43)`，文字 `rgb(196,181,212)`，
  对比度 `9.44:1`。
- CMS 聚焦面板：背景 `rgb(27,16,43)`，正文 `rgb(248,250,252)`；
  警告文字对比度 `14.59:1`。
- MD2File 工作区为暗色；白色纸张仅为导出预览例外。

状态夹具测量 36 个元素，全部达到 `>=4.5:1`，最低为 disabled `6.19:1`。
success/warning/error 为 `11.29/12.69/9.27:1`，draft/published/archived 为
`13.83/14.20/13.49:1`，selected 为 `13.07:1`。图工具按钮在指针激活/
焦点后计算为选中暗底、强化边框和焦点色。

一次宽矩阵调用出现 Browser 宿主 Statsig telemetry timeout；页面自己的
`tab.dev.logs()` 为空。

### A00 复测回归收口

- 原始失败证据：`1280x900` 下品牌 `x=32,w=194.775`，首个导航项
  `x=137.4,w=92`，重叠约 `89.4px`。
- 修复策略：在受保护 `1180px` 断点上方补齐 `1181–1320px` 双行网格；
  品牌与主题按钮在第一行，导航独占第二行。
- 确定性矩形证据覆盖 `1181/1280/1320px`：品牌、导航、主题按钮两两不相交，
  导航无横向越界。
- `360px` 明确不命中新规则，保持既有移动布局。
- 隔离浏览器 `1280x900` dark/light：品牌
  `x=24,y=16,right=218.775`，首个导航项
  `x=115.8,y=77.8,right=239`，主题按钮
  `x=1196.8,y=14,right=1240.8`；三组相交均为 false，`overflow=0`。
- 隔离浏览器 `360x800` light：品牌、首个导航项、主题按钮相交均为 false，
  `overflow=0`，控制台 `warn/error=[]`。

## files_created_or_changed

- `styles.css`
- `styles/28-full-site-dark.css`
- `admin/index.html`
- `admin/course-paths.html`
- `admin/admin-dark.css`
- `scripts/test-full-site-dark-theme.js`
- `docs/full-site-dark-theme.md`
- `docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md`

## tests_or_checks

通过：

- `node --check scripts/test-full-site-dark-theme.js`
- `node scripts/test-full-site-dark-theme.js`
- `npm.cmd run test:formula-authoring-drawer`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run test:markdown`
- `node scripts/test-inline-math-layout.js`
- `npm.cmd run test:post-cover-coordinates`
- `npm.cmd run test:post-reading-minutes`
- `node scripts/test-focused-content-media.js`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-catalog`
- `npm.cmd run test:focus-mode`
- `npm.cmd run test:carousel-focus-buffer`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
- `npm.cmd run codex:contract`：`732 passed / 0 warnings / 0 failures`

隔离 API 结果包括 `ok=True`、公开文章 1、公开项目 2、公开公式节点 1、
聚焦模式默认开启、CSRF 拒绝和 UTF-8 检查通过。

## protected_boundaries

开工后与最终 SHA-256：

- `styles/20-content.css`：
  `c201a6eca1a6d2d1ce4d7a105d4530571c869c84dcb17a3db2b82900c3dd0752`
- `admin/admin.css`：
  `8ca8a5b700e43bccd2169057d71817de0c7a342c405cfb166a366f8e22c35c01`
- `styles/10-hero.css`：
  `d2589f70e9e1d2145ebdc5dca95c499ad21e896ad15479a8dfbe4aa460418fe5`
- `styles/26-inline-math.css`：
  `e257580e25fd9e9ec52eb0a55d9ad992da5d5b953e2db49bfde390d22b5f3d12`
- `styles/27-focused-content-media.css`：
  `8424b6a8c99b7ce7a431ea8cc4e744f5befbe9aef439a2b3e56c7d3c316b8a30`

未编辑以上文件。未执行 Git、云端、部署、恢复或回滚操作。

## risks_and_A00_retest

1. `formula-graph.js` 不在写集内，Cytoscape 固定色通过暗色 canvas filter 映射。
   A00 应在真实多层已发布公式图上独立检查节点、边、当前路径和点击辨识。
2. MD2File 白色导出纸张为刻意例外；A00 应确认应用外壳暗色与纸张边界清楚。
3. A00 应补做操作系统 light/dark 自动切换、键盘-only focus 和纯 hover；
   `1280px` CMS 顶栏与 `360px` 无溢出已由本轮隔离浏览器复测收口。
4. 浏览器网络面板未形成独立导出；已有代表页 console 为空、破图为 0，
   API 与资源行为由确定性/隔离回归覆盖。

`next_handoff=A00_ProjectDirector`

## A00 验收证据

- `A00_ProjectDirector` 于 2026-07-29 接受本切片。
- 专项审计 `node scripts/test-full-site-dark-theme.js` 通过：14 个页面、8 组对比度、
  3 个 CMS 顶栏宽度。
- 独立浏览器复测 `1280x900` dark：品牌、导航、主题按钮矩形两两不相交，
  页面无横向溢出。
- 独立浏览器复测 `360x800` dark：品牌、导航、主题按钮矩形两两不相交，
  聚焦模式面板和页面均无横向溢出。
- CMS 控制台 `warn/error=[]`。
- 受保护文件哈希保持不变。
