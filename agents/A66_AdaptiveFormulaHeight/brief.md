# Agent 66 Adaptive Formula Height（高公式布局：完整显示且无纵向滚动）

## Mission

执行 `S57_adaptive_formula_height`。统一文章、公式页、推导正文、图谱、CMS 与 MD2File 的块级高公式自适应高度，同时保持行内数学紧凑对齐。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/requirements/active/REQ-20260911-002.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260911-001.json`
- `data/math-renderer.js`
- `styles/40-formula.css`
- `admin/admin.css`
- `formula-graph.js`

## May Edit

- `data/math-renderer.js`
- `styles/20-content.css`
- `styles/40-formula.css`
- `admin/admin.css`
- `admin/admin-dark.css`
- `formula-graph.js`
- `scripts/test-adaptive-formula-height.js`
- `docs/codex-workline/slices/S57_adaptive_formula_height_handoff.md`

## Contract

- 禁止公式容器 `overflow-y:auto/scroll`，不得通过统一超大固定高度掩盖问题。
- 块级公式按真实排版边界自适应；行内公式保持同行视觉居中。
- 字体加载、窗口变化、内容变化和图谱节点变化后安全重测，避免 ResizeObserver 循环。
- 极宽公式可沿用受控横向策略，但上下不得裁切。
- 使用固定普通、根号分式、嵌套分式、积分、矩阵、cases、boxed 样例验证。
- 不修改公式内容、关系数据、API、数据库、版本、Git 或生产环境。

## Done When

- 所有目标表面无纵向滚动和上下裁切。
- 普通公式保持紧凑，高公式获得与内容匹配的空间。
- 图谱节点重测后完整包住公式且连线重排正确。
- 专项 DOM/浏览器回归及受影响测试通过，并写中文 handoff 回传 A00。
