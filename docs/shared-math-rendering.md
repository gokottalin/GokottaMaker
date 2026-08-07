# 共享数学渲染

## 引擎

- 固定版本：KaTeX `0.16.22`
- 本地脚本：`/assets/vendor/katex/katex.min.js`
- 本地样式：`/assets/vendor/katex/katex.min.css`
- 统一接口：`window.LarkixMath.render(source, options)` 与
  `window.LarkixMath.validate(source, options)`

CMS 预览、文章、项目和推导页必须先加载 KaTeX，再加载
`data/math-renderer.js`，最后加载 `data/markdown-renderer.js`。不得使用 CDN，也不得在页面中复制第二套 LaTeX 解析逻辑。

## 返回契约

`render` 返回 `valid`、`blocking`、`source`、`displayMode`、
`diagnostics` 和 `html`。`validate` 返回除 `html` 外的同一组校验字段。

阻断诊断包含稳定的 `code`、中文 `message` 和行列范围。Markdown
渲染结果另提供 `canPublish`；无效公式只输出安全占位，不向游客暴露未闭合的原始 LaTeX。

## 展示规则

- `$...$` 与 `\(...\)` 为行内公式。
- `$$...$$` 与 `\[...\]` 为块级公式。
- 普通块公式不显示整行边框或装饰底色。
- 只有源公式显式使用 `\boxed{...}` 时，输出才带 `is-boxed` 标记。
- 移动端允许复杂公式横向滚动，不裁切根号、积分上下限和多层分式。

## 兼容边界

现有 DOCX 转换器仍由后续 MD2File 对齐切片接管。它在无浏览器 DOM 的内部
VM 中暂时使用旧的结构化数学输出，游客和 CMS 页面不允许走该兼容分支。
