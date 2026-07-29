# S20 公式创作抽屉交接

- 执行 Agent：`A27_FormulaAuthoringDrawer`
- 验收 Agent：`A00_ProjectDirector`
- 状态：`accepted_by_A00`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-008`
- next_handoff：`A00_ProjectDirector`

## 1. 实现状态

S20 已完成代码、专项测试与回归测试。文章公式入口已从正文内工具改为页面边缘固定的可折叠抽屉；现有公式卡 API、文章绑定、原子建卡、修订发布和分支推导逻辑均保持复用，没有新增持久化模型或自动保存文章。

A00 已接管并完成浏览器收敛：移除主编辑区布局动画，在固定入口 `pointerdown` 阶段捕获编辑状态并阻止默认聚焦位移；补齐工作台返回后的目录重载、移动按钮收敛和抽屉深色主题。专项、回归、API、契约及隔离浏览器矩阵均通过。

## 2. 状态保留设计

打开抽屉前会捕获：

- Markdown 全文；
- `selectionStart`、`selectionEnd` 与最后一次有效 LaTeX 选区；
- textarea `scrollTop`；
- 页面 `scrollY`；
- 当前焦点字段。

抽屉展开、收起和公式工作台往返时，文章 textarea 始终保持挂载。恢复链路先恢复 Markdown、选区和 textarea 滚动，再以双 `requestAnimationFrame` 和延迟校正恢复页面滚动；关闭抽屉后焦点返回原编辑字段。若从独立公式工作台返回时检测到 Markdown 已被其他操作修改，系统拒绝以旧快照覆盖当前内容。

公式插入仍使用动作前捕获的选区。搜索、筛选和快速预览不会替换该选区；已有公式插入后只修改目标范围。选区建卡继续调用 S13 已接受的原子文章/公式卡保存路径，不新增静默文章保存。

## 3. 抽屉与独立工作台边界

抽屉仅保留长文现场需要的快速动作：

- 按关键词、模块、分类和标签检索已有公式；
- 行内或块级插入；
- 从精确 LaTeX 选区创建公式卡；
- 预览实际可插入的当前或已发布修订；
- 跳转独立公式工作台并返回文章。

完整 Markdown 推导、发布状态、深层分类、依赖图和修订管理继续位于独立公式工作台。公式库公开/当前修订语义、归档边界和游客接口没有改变。

## 4. 长文章浏览器证据

A00 使用全新临时 `DATA_DIR`、端口 `5591`、隔离账号和 `1440 x 900` 视口复测，未打开当前或生产数据。测试稿包含 150 个段落，Markdown 长度 `13764`，页面高度约 `35702`。

- 顶部、中部 `scrollY=8000`、底部 `scrollY=34802.3984375` 均可访问固定 `∑` 入口。
- 页面布局稳定后，三处展开和收起的 `scrollY` 偏移均为 `0px`。
- 收起后焦点返回 `markdown`，正文长度及未保存内容保持不变。
- 独立工作台往返前后 hash 为 `#editor -> #formulas -> #editor`，Markdown 逐字一致，页面位置一致。
- 工作台返回后会重新加载目录，刚创建的公式卡无需刷新即可出现在抽屉中。

## 5. 公式动作与响应式证据

隔离库新建草稿公式卡 `formula.s20.boost-duty`，浏览器完成：

- 模块 `power-electronics`、分类 `计算书/BOOST`、关键词 `BOOST` 联合检索，结果 `1` 条。
- 快速预览显示草稿边界和实际插入 LaTeX。
- 行内插入使用动作前光标，原文保持不变并追加绑定到不可变修订的 shortcode。
- `Escape` 收起抽屉并把焦点返回 Markdown。
- 选区建卡的原子保存、回滚和不可变身份继续由 `test:article-formula-authoring` 覆盖。

响应式结果：

- `760 x 900`：`scrollWidth=745 <= 760`，抽屉边界 `12..732.8`，保存按钮与抽屉重叠面积 `0`。
- `390 x 844`：`scrollWidth=375 <= 390`，抽屉边界 `8..367.2`，保存按钮与抽屉重叠面积 `0`。
- 移动端独立工作台按钮收敛为 `38 x 36` 图标按钮，`font-size=0`，没有竖排文字。
- 深色主题抽屉使用深色表面和高对比文字；移动截图视觉验收通过。
- 页面控制台 `error/warning` 均为 `0`。

## 6. 修改文件

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-authoring-drawer.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md`

未修改 `styles/20-content.css`、后端、迁移、公式发布与推导图逻辑、当前/生产数据、云端、部署或 Git 状态；未回退、覆盖或格式化其他参与者改动。

## 7. 检查结果

以下最终通过：

- `node --check admin/admin.js`
- `npm.cmd run test:formula-authoring-drawer`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:formula-catalog`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run test:markdown`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
  - `ok=True`
  - `csrfBlocked=True`
- `npm.cmd run codex:contract`
  - `654 passed`
  - `0 warnings`
  - `0 failures`

## 8. 残余风险

1. 真实浏览器的精确 LaTeX 拖选受浏览器自动化输入能力限制，UI 原子建卡仍以专项集成测试作为主要证据。
2. 抽屉依赖公式目录 API；请求失败时保留文章编辑状态并通过现有 notice 报错，不会静默修改文章。

## 9. 验收结论

`A00_ProjectDirector` 接受 S20。公式创作抽屉已满足长文可达、未保存状态保留、搜索/预览/插入、工作台往返、键盘操作和桌面/半宽/移动响应式门禁。`next_handoff` 返回 A00，由 A00 路由 S21。
