# S30 Shared Math Rendering Handoff

## 状态

`ready_for_a00_acceptance`

## 交付

- 固定版本 KaTeX `0.16.22` 已完整本地化，包含脚本、样式、字体和许可证。
- `LarkixMath.render/validate` 已成为 CMS 与游客 Markdown 页面的统一数学接口。
- 行内与块级公式支持上下标、根号、积分、多层分式及紧凑 `\boxed`。
- 非显式 boxed 块公式不再继承整行装饰边框。
- 无效定界符或 LaTeX 返回结构化阻断诊断，并只显示安全占位。

## 验证

- `node scripts/test-math-rendering.js`
- `npm.cmd run test:markdown`
- `node scripts/test-inline-math-layout.js`
- `node --check data/math-renderer.js`
- `node --check data/markdown-renderer.js`
- `npm.cmd run codex:contract`

## 边界

- `admin/index.html` 的加载接入由 A37 单一写入完成。
- MD2File 的最新语法与 DOCX 等价转换由 S34 接续。
- 未执行 Git、部署、云写入、服务重启或当前/生产数据变更。
