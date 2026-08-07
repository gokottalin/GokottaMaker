# S37 公式地图横向流程布局交接

status: `ready_for_a00_acceptance`

scope_completed:

- 将公式 DAG 改为稳定的来源到依赖横向拓扑布局；分支、汇合和深路径均按最长来源路径确定层级，所有有效边从左向右跨越节点边界。
- 接入共享 `LarkixMath`，以 KaTeX DOM 实测宽高驱动节点和连线几何；长公式与嵌套分式完整显示，不截断、不省略、不固定压缩。
- 保留 Cytoscape 的有向边、平移和缩放能力，增加 DOM 节点覆盖层同步、滚轮平移、触控平移/双指缩放、节点拖拽、键盘画布操作与节点点击导航。
- 初始视口限制在可读缩放区间；超宽图谱居中当前公式并可继续浏览。当前节点、选择、草稿、归档、明暗主题和焦点状态均保持清晰。
- 节点本身承担导航，节点内不生成公式绑定标记或额外跳转图标；公开/CMS 可见性与关系语义未改变。

files_created_or_changed:

- `formula-graph.js`
- `derive.html`
- `admin/admin.css`
- `scripts/test-formula-map-flow-layout.js`
- `docs/formula-map-flow-layout.md`
- `docs/codex-workline/slices/S37_formula_map_flow_layout_handoff.md`

decisions:

- 以全量载荷计算稳定深度，以当前可见集合计算列宽和纵向堆叠；展开旁支不会改变 DAG 方向。
- Cytoscape 节点作为透明实测几何锚点，KaTeX DOM 作为可访问、可点击、可拖拽的显示层，避免 canvas 文本无法渲染数学与固定尺寸的问题。
- 完整适配低于 `48%` 时保持可读下限并居中当前节点，不用不可读压缩换取一次显示全部节点。
- 游客节点使用原生链接语义；CMS 在 `navigation: false` 时使用按钮语义，只选择、不跳转。

risks:

- 极长公式会按真实宽度扩大图谱，这是“不截断、不压缩”的预期代价，依靠平移、滚动与缩放浏览。
- `node scripts/test-inline-math-layout.js` 仍有一项与本任务无关的既有失败：该测试全局禁止负向 `translate`，但受保护的 `styles/26-inline-math.css` 现有公式绑定标记包含 `translateY(-1px)` 和 `translateY(-0.02em)`；失败输出未涉及 S37 六个文件，本任务未越权修改。
- 未启动或重启项目服务，未访问当前/生产数据，也未执行 Git、部署、云写入或清理操作。

tests_or_checks:

- `node scripts/test-formula-map-flow-layout.js`：通过；覆盖分支、汇合、长公式、嵌套分式、深路径、DOM 实测、边方向、桌面/移动像素与溢出、鼠标/触控平移、工具栏/双指缩放、鼠标/触控拖拽、点击、暗色和无障碍契约。
- `node --check formula-graph.js`、`node --check scripts/test-formula-map-flow-layout.js`：通过。
- `npm.cmd run test:math-rendering`、`npm.cmd run test:markdown`：通过。
- `npm.cmd run test:linear-derivation-graph`、`npm.cmd run test:branching-derivation-graph`：通过。
- `node scripts/test-full-site-dark-theme.js`：通过，14 个页面、8 组对比度和 3 个 CMS 头部宽度均合格。
- `npm.cmd run test:formula-authoring-drawer`：通过。
- `npm.cmd run codex:contract`：通过，`932 passed / 0 warnings / 0 failures`。

next_handoff:

- 直接返回 `A00_ProjectDirector`，由 A00 复核 S37 六文件边界、专项浏览器证据与最终 contract；无需 Owner 转发。
