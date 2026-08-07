# S33 公式绑定标记交接

## status

`completed`

## scope_completed

- 文章正文和公式推导正文共用 `data/markdown-renderer.js` 的公式绑定标记协议。
- 新绑定保留作者原 LaTeX，只追加一个右上角紫色圆形 `↩` 链接。
- 行内公式相邻绑定、块级公式下一行绑定均不重复数据库公式正文。
- 普通公式、无效或不可解析绑定不显示标记。
- 标记提供准确的 `title`、`aria-label` 和稳定公式 slug 导航。
- 保留历史独立公式短码的单公式兼容渲染，避免旧文章内容消失。

## files_created_or_changed

- `data/markdown-renderer.js`
- `styles/26-inline-math.css`
- `scripts/test-markdown-renderer.js`
- `scripts/test-formula-binding-marker.js`
- `docs/formula-binding-marker.md`
- `docs/codex-workline/slices/S33_formula_binding_marker_handoff.md`

## decisions

- 新协议不改变短码身份字段；由“完整作者公式 + 相邻短码”表达装饰式绑定。
- 仅在绑定身份、修订、显示模式、目标 slug 和 LaTeX 均可解析时生成公开标记。
- 新协议和历史兼容路径在同一渲染函数内判定，CMS 与游客端无需各自实现样式。

## risks

- 后续 S35 必须保存完整选区公式并追加短码；若继续用短码替换选区，会落入历史兼容路径。
- 原生 `title` 在不同触控浏览器的展示时机由浏览器决定，但链接和可访问名称始终可用。

## tests_or_checks

- `npm.cmd run test:markdown`：通过。
- `npm.cmd run test:math-rendering`：通过。
- `node scripts/test-formula-binding-marker.js`：通过。
- 浏览器桌面夹具：2 个绑定生成 2 个圆形标记，作者公式各保留一份，数据库公式未重复，页面无横向溢出。
- 浏览器移动夹具：行内标记 `16 x 16`、块级标记 `17 x 17`；两者均在视口内，块级标记位于公式宿主右上角，正文块无重叠。
- 视觉截图确认复杂分式和 `boxed` 公式保持居中，标记不扩大边框、不另起文字链接行。

## next_handoff

交回 `A00_ProjectDirector` 验收。通过后可开启 `S35_article_formula_selection_create`，但应等待正在编辑 `server.js` 的 S34 结束，以维持单文件单写者。
