# 行内数学排版契约

## 共享结构

`data/markdown-renderer.js` 为每个行内公式输出同一结构：

```html
<span class="markdown-math markdown-math-inline ..."
      data-math-layout="inline-flow"
      data-math-structures="...">
  <span class="math-inline-frame">...</span>
</span>
```

结构标记仅由公式 HTML 中实际存在的 `fraction`、`integral`、`root` 和 `script`
生成，不绑定文章、公式 ID 或存储数据。块级公式继续输出
`markdown-math-display`，不增加行内包装。

## 布局规则

- 行内公式采用 `inline-flex + vertical-align: middle`，由公式实际高度扩展自然行盒。
- 分数使用两行网格；积分、根号和多层上下标参与正常尺寸计算，不使用负向位移。
- 独立的公式跳转标记可以使用悬停或图标微位移，但不参与公式行盒和数学结构布局。
- 复杂或较长公式保持内部不换行；当容器不足时，公式自身提供横向滚动，不推动页面产生横向溢出。
- 行内公式继承正文或链接颜色，分数线与根号横线继续使用 `currentColor`。
- 规则集中在 `styles/26-inline-math.css`，`styles/20-content.css` 保持只读。

## 确定性夹具

专项测试覆盖：

- 普通下标公式：`D_{buck}=V_{out}/V_{in}`
- 已发布 BUCK 纹波比例：`k_{ripple}=dI_{trans}/dI_{diag}`
- 堆叠分数：`\frac{V_{in}D}{L_{nom}f_{sw}}`
- 分子含积分、微分和根号，分母含嵌套根号
- 嵌套根号：`\sqrt{1+\sqrt{1+x_{n}^{2}}}`
- 多层上下标：`I_{L_{phase}}^{pk_{max}}`
- 复杂公式紧邻中文逗号和句号

运行：

```powershell
node scripts/test-inline-math-layout.js
```

浏览器验收使用相同夹具检查 CMS Markdown 预览、文章正文和推导正文，矩阵为
桌面、半宽、移动宽度乘日间、夜间主题。每个场景检查行盒间距、公式边界、分数线、
根号横线、页面横向溢出、控制台错误和失败网络请求。
