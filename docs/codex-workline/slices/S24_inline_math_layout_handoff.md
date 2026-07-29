# S24 复杂行内数学排版交接

- 执行 Agent：`A31_InlineMathLayout`
- 最终验收：`A00_ProjectDirector`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-002`
- 状态：`accepted_by_A00`
- next_handoff：`A00_ProjectDirector`

## 1. 交付结论

S24 已建立全站共享的行内数学结构和样式契约。CMS Markdown 预览、游客文章正文与
公开推导正文使用相同 renderer 输出和 `styles/26-inline-math.css`，不包含 BUCK
文章、文章 ID 或公式 ID 专用选择器。

简单公式与复杂公式都进入自然行盒；复杂分数、积分/微分、根号与嵌套根号、多层上下标
可按自身高度扩展正文行，不与相邻段落重叠。窄屏公式在自身范围内横向滚动，不推动页面
产生横向溢出。块级公式保持原有 block 行为。

## 2. 共享结构

行内公式统一输出：

```html
<span class="markdown-math markdown-math-inline ..."
      data-math-layout="inline-flow"
      data-math-structures="fraction integral root script">
  <span class="math-inline-frame">...</span>
</span>
```

`inlineMathProfile` 仅根据已渲染 HTML 的结构生成 `is-complex`、
`is-scrollable` 和结构标记。公式含义、存储 LaTeX、公式发布状态及块级公式输出不变。

## 3. 样式策略

- `inline-flex + vertical-align: middle` 让公式与中文正文形成自然基线关系。
- `math-inline-frame` 按实际数学内容撑开行盒。
- 分数保持两行网格，分子和分母边界不重叠；嵌套分数按局部比例缩放。
- 根号、积分和上下标参与正常尺寸计算；行内积分上下限不再使用负向位移。
- 复杂行内公式在桌面保持可见溢出，在 640px 及以下切换为公式自身横向滚动。
- 颜色继承正文/链接，日间与夜间模式继续使用现有主题色。
- `styles/20-content.css` 未修改。

## 4. 确定性夹具

`node scripts/test-inline-math-layout.js` 覆盖：

- 普通下标公式 `D_{buck}=V_{out}/V_{in}`
- 已发布 BUCK 纹波比例
- 堆叠分数
- 分子含积分、微分和根号，分母含嵌套分数与嵌套根号
- 双层根号
- 多层上下标
- 复杂公式紧邻中文标点
- 块级公式不获得行内包装
- 新样式导入顺序和无文章专用选择器

专项夹具、`node --check data/markdown-renderer.js`、
`npm.cmd run test:markdown`、`npm.cmd run test:formula-publication`、
`npm.cmd run test:branching-derivation-graph` 和
`npm.cmd run test:post-cover-coordinates` 均通过。

## 5. A00 浏览器验收

A00 使用同一夹具完成 `CMS / post / derive` ×
`1280 / 640 / 360` × `light / dark` 共 18 个场景。

每个场景均得到：

- 行内公式数：`6`
- `pageOverflow=false`
- `paragraphOverlap=false`
- `clip=false`
- 块级公式：`display:block`
- 1280px：公式 overflow 策略为 `visible`
- 640px / 360px：公式 overflow 策略为 `auto`
- 日间公式颜色：`rgb(24, 24, 27)`
- 夜间公式颜色：`rgb(237, 233, 254)`

桌面像素检查中，所有公式的 frame 边界均位于公式自身边界内，分子/分母无交叠，
根号子元素无越界。360px 夜间截图确认长积分分式、嵌套根号、多层上下标及中文标点
均可读；浏览器 console `warn/error=[]`。

## 6. 修改文件

- `data/markdown-renderer.js`
- `styles.css`
- `styles/26-inline-math.css`
- `scripts/test-inline-math-layout.js`
- `docs/inline-math-layout.md`
- `docs/codex-workline/slices/S24_inline_math_layout_handoff.md`

## 7. 保护边界

- 未编辑 `styles/20-content.css`。
- 未编辑 A30 的 migration、content、validator、CMS、文章页面或阅读时间文件。
- 未修改公式数学含义、存储 LaTeX、发布数据或 current/production 数据。
- 未执行云端、部署、恢复/回滚、Git staging、commit、push 或 branch/remote 操作。
- 浏览器夹具服务已停止，临时 viewport 已恢复。

`next_handoff=A00_ProjectDirector`
