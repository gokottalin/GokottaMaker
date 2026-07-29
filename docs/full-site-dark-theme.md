# 全站夜间主题

## 目标与边界

本次修复对应 `S26 / REQ-20260728-009`。我采用末端覆盖层统一游客端、CMS
和工具页的暗色表面与语义状态，不改品牌、排版、业务状态、主题持久化或内容数据。

- 游客端入口：`styles.css` 最后导入 `styles/28-full-site-dark.css`。
- CMS 入口：`admin/index.html` 与 `admin/course-paths.html` 在
  `admin.css` 后加载 `admin/admin-dark.css`。
- `styles/20-content.css` 与 `admin/admin.css` 保持只读。
- 新 CSS 只允许 `[data-theme="dark"]`、系统暗色媒体查询和打印作用域，
  以及 `1181–1320px` CMS 顶栏兼容断点。该断点仅调整品牌、导航和主题按钮
  的网格行，不改变任何颜色或业务行为。

## 共享语义 Token

| 语义 | Token |
| --- | --- |
| 页面与表面 | `--theme-dark-canvas`、`--theme-dark-surface`、`--theme-dark-surface-raised`、`--theme-dark-surface-strong` |
| 正文与次要文字 | `--theme-dark-text`、`--theme-dark-muted` |
| 边框、链接、焦点 | `--theme-dark-border`、`--theme-dark-border-strong`、`--theme-dark-link`、`--theme-dark-focus` |
| 控件状态 | `--theme-dark-disabled`、`--theme-dark-selected-bg` |
| 业务状态 | `--theme-dark-success`、`--theme-dark-warning`、`--theme-dark-error`、`--theme-dark-draft`、`--theme-dark-published`、`--theme-dark-archived` |
| 代码 | `--theme-dark-code-bg`、`--theme-dark-code-text` |

CMS 复用同一组 token。仅
`.formula-decision-publication-warning` 使用一次 `!important`，用于覆盖只读
`admin.css` 中已有的 `!important` 文字色。

## 页面审计

| 页面族 | 页面 | 结果 |
| --- | --- | --- |
| 入口与首页 | `/`、`maker.html` | 通过；公开推导空状态已改为暗色表面 |
| 内容 | `category.html`、`post.html`、`derive.html` | 通过；Markdown、代码、行内/块级数学、依赖与不可用推导状态已覆盖 |
| 项目与工具 | `projects.html`、`project.html`、`miniapps.html`、`404.html` | 通过；聚焦门禁隐藏页另用只读静态服务检查 |
| 三个工具页 | `md2doc.html`、`larkix-elec.html`、`gokotta-elec.html` | 通过；工具工作区无亮面泄漏 |
| CMS | `admin/index.html`、`admin/course-paths.html` | 通过；聚焦门禁、公式工作流、轮播缓冲、课程路径均覆盖 |

确定性测试逐页核验 14 个主入口都加载共享主题索引，并检查游客/CMS
选择器、手动暗色、系统暗色回退、显式日间优先和受保护文件边界。

## 状态矩阵

| 类型 | 覆盖状态 |
| --- | --- |
| 通用控件 | normal、hover、focus-visible、disabled、selected |
| 业务反馈 | success、warning、error |
| 发布流程 | draft、published、archived、unavailable、broken |
| 内容表面 | Markdown、inline code、blockquote、inline/display math、table |
| 公式 | 公共推导、依赖引用、图工具栏/画布、公式抽屉、待决策面板 |
| CMS | 聚焦模式、可见性提示、轮播缓冲、模态对话框、课程路径 |

浏览器状态夹具测量了 36 个关键元素。全部普通文字对比度不低于
`4.5:1`，最低为禁用态 `6.19:1`。代表值：

| 状态 | 对比度 |
| --- | ---: |
| 首页公开推导空状态 | `9.44:1` |
| Markdown inline code | `14.73:1` |
| 推导不可用 | `11.27:1` |
| success / warning / error | `11.29:1` / `12.69:1` / `9.27:1` |
| draft / published / archived | `13.83:1` / `14.20:1` / `13.49:1` |
| CMS 聚焦警告 | `14.59:1` |
| 公式抽屉 | `17.41:1` |
| 公式状态 draft / published / archived | `9.73:1` / `10.06:1` / `10.04:1` |
| 轮播断链 / danger | `8.36:1` / `8.36:1` |
| disabled / selected | `6.19:1` / `13.07:1` |

## 浏览器证据

代表页使用游客 `maker.html`、CMS `admin/index.html` 和工具
`tools/md2doc.html`，完成 `1280x800`、`800x900`、`360x800` 的
light/dark 共 18 个场景：

- `pageOverflow=0`，无破图。
- 同一页面的 `main`、`header` 和 `scrollHeight` 在 light/dark 下逐项一致。
- 三个代表页 `tab.dev.logs()` 均为 `[]`。
- 另完成 14 个主页面在桌面、半宽、移动端的 light/dark 计算样式扫描；
  未发现非装饰亮面泄漏。
- 截图未写入仓库。目检覆盖游客首页、CMS 聚焦面板和 MD2File 工具；
  MD2File 白色纸张是导出文档预览，不属于应用暗色表面。

一次宽矩阵运行出现 Browser 宿主 Statsig telemetry timeout；页面自身控制台为空，
与站点资源无关。

## CMS 1280px 顶栏兼容修复

A00 独立复测发现 `1280x900` 登录后，品牌右边界为 `226.775px`，首个导航项
左边界为 `137.4px`，实际重叠约 `89.4px`。根因是受保护的 `admin.css`
仅在 `max-width:1180px` 切换双行顶栏。

我在 `admin/admin-dark.css` 增加 `1181–1320px` 的 light/dark 共用兼容断点：

- 第一行放置品牌和主题按钮。
- 第二行导航独占 `grid-column: 1 / -1` 并允许内部换行。
- `1181px`、`1280px`、`1320px` 确定性矩形模型均确认品牌、导航、主题按钮
  两两不相交，导航左右边界均在视口内。
- `360px` 不命中新增断点，继续使用既有 `max-width:760px` 移动布局。

隔离 CMS 浏览器复测结果：

| 视口/主题 | 品牌 | 首个导航项 | 主题按钮 | 相交 | overflow |
| --- | --- | --- | --- | --- | ---: |
| `1280x900` dark | `x=24, y=16, right=218.775` | `x=115.8, y=77.8, right=239` | `x=1196.8, y=14, right=1240.8` | false | `0` |
| `1280x900` light | 同上 | 同上 | 同上 | false | `0` |
| `360x800` light | `x=14, y=14, right=330.8` | `x=21.8, y=103, right=168.4` | `x=286.8, y=415.6, right=330.8` | false | `0` |

`1280px` 导航容器从 `y=70` 开始，品牌在 `y=56` 结束，垂直间隔
`14px`；`360px` 控制台 `warn/error=[]`。

## 实现例外与风险

1. `formula-graph.js` 的 Cytoscape 颜色是固定值且不在写集内。我仅对暗色画布
   的渲染 canvas 使用色彩映射；A00 应用真实多层已发布公式图独立复测节点与边。
2. MD2File 应用外壳和预览舞台为暗色，导出纸张继续保持白底，确保所见即所得。
3. 当前聚焦模式会把部分项目、小程序和工具路由导向 404；我用只读静态服务补齐
   页面表面检查，没有修改业务状态。
4. 浏览器系统主题回退已由初始 system-dark 和确定性作用域校验覆盖；
   A00 可补做操作系统主题切换与键盘-only 独立复测。

## 验证命令

以下命令均通过：

```text
node --check scripts/test-full-site-dark-theme.js
node scripts/test-full-site-dark-theme.js
npm.cmd run test:formula-authoring-drawer
npm.cmd run test:formula-publication
npm.cmd run test:branching-derivation-graph
npm.cmd run test:markdown
node scripts/test-inline-math-layout.js
npm.cmd run test:post-cover-coordinates
npm.cmd run test:post-reading-minutes
node scripts/test-focused-content-media.js
npm.cmd run test:article-formula-authoring
npm.cmd run test:formula-catalog
npm.cmd run test:focus-mode
npm.cmd run test:carousel-focus-buffer
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1
npm.cmd run codex:contract
```

契约结果为 `732 passed / 0 warnings / 0 failures`。API 检查使用隔离数据目录，
未访问或修改 current/production 数据。
