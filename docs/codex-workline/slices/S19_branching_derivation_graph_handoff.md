# S19 分支推导图交接

- 执行 Agent：`A26_BranchingDerivationGraph`
- 验收 Agent：`A00_ProjectDirector`
- 状态：`accepted`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-005`
- next_handoff：`A27_FormulaAuthoringDrawer`

## 1. 实现状态

已将公式卡的“唯一下一阶”线性关系升级为修订感知的有向无环分支网络：

1. 当前修订的 Markdown `{{formula-ref:<formulaId>}}` 是依赖边的唯一编辑来源。
2. 一张公式卡可引用多个直接依赖，多张公式卡可汇入同一依赖。
3. CMS 读取 `currentRevisionId`，访客读取 `publishedRevisionId`。
4. 正文依赖链接与网络图读取同一张修订依赖表，不维护第二套图表关系。
5. 旧线性 `set/replace/remove` API 保留兼容，但新 CMS 以多依赖 Markdown 工作台为主。

## 2. 迁移与兼容

`migrations/021_branching_derivation_graph.js` 新增修订级依赖存储、唯一约束、外键和禁止修改/删除旧依赖的触发器。旧 `formula_derivation_edges` 按对应旧修订迁移为 `provenance=legacy_linear`，不修改旧修订正文。

A00 安全复核发现公式名称、模块、分类、用途和标签原先没有进入修订快照，已补充 `migrations/022_formula_revision_presentation_snapshot.js`。这些展示字段现在与 LaTeX、Markdown 一起形成不可变修订；已发布卡片只改名称或标签时会进入待发布状态，游客继续读取上一已发布快照。

旧线性 remove 的兼容缺口已修复：当旧 Markdown 中没有依赖短码、但当前修订只有 `legacy_linear` 依赖时，remove 会强制创建一个无依赖的新不可变修订并切换 `currentRevisionId`；旧修订依赖原样保留。回归同时覆盖随后使用旧 set/replace 建立新的 Markdown 依赖。

## 3. 依赖语法与原子拒绝

语法：

```markdown
{{formula-ref:formula.example.target}}
```

保存事务会一次解析整篇 Markdown，并原子拒绝：

- 自引用；
- 同一修订重复依赖；
- 悬空目标；
- 直接循环；
- 多层循环。

隔离 API 实测拒绝证据：

| 场景 | HTTP | 结果 |
| --- | ---: | --- |
| 自引用 | 400 | `公式卡不能依赖自身` |
| 重复依赖 | 400 | 指明重复 `formulaId` |
| 悬空依赖 | 400 | 指明目标不存在 |
| 多层循环 | 409 | `此依赖会形成循环推导，保存已阻止` |

核心自动测试还验证拒绝后不创建修订、不改变原依赖。

## 4. 发布边界矩阵

| 状态 | CMS current 图谱 | 访客 published 图谱/正文 |
| --- | --- | --- |
| 当前修订已发布 | 显示当前修订 | 显示已发布修订 |
| 来源卡待发布 | 显示新依赖并提示待发布 | 继续显示来源卡上一已发布修订 |
| 目标仅草稿 | 显示目标和发布阻断提示 | 目标名称、LaTeX、Markdown、ID 均不进入公开载荷 |
| 目标已有发布修订后又编辑 | 显示目标当前修订及待发布状态 | 只读取目标上一已发布修订 |
| 目标归档 | CMS 保留历史并显示边界警告 | 目标不进入公开遍历，正文使用通用不可用提示 |

公开 API 改为显式白名单 DTO，删除顶层和嵌套的 `formulaId`、`revisionId`、发布状态、修订序号、修订原因、操作者、状态时间和待发布字段。公开 Markdown 的依赖键由内部 ID 转换为公开 slug；公开图节点只包含 slug、简短名称、公开结论 LaTeX、层级/方向和当前节点标记。

## 5. Graph Payload

CMS 与公开 API 均返回：

- `mode`：`current` 或 `published`；
- `currentNodeId`；
- `nodes[]`：有向节点、`rank`、`direction`、`current`；
- `edges[]`：`source -> target`；
- `initialNodeIds[]`；
- `expandableNodeIds[]`；
- `hiddenNodeCount`、`truncated`；
- `limits.initialNodes=24`、`limits.payloadNodes=240`。

CMS 节点额外包含公式/修订身份、发布状态、待发布和归档信息；公开节点不包含这些内部字段。

隔离大图 API 实测为 30 个公开节点，首屏 24 个，隐藏 6 个，可按边界展开。自动测试另以 36 节点验证首屏仍固定为 24、隐藏 12、载荷上限为 240。

## 6. CMS 与访客实现

CMS：

- 原线性面板升级为“多依赖工作台”；
- 可搜索公式并将多个短码插入 Markdown；
- 可逐项从 Markdown 移除；
- 显示 incoming、dependencies、循环/悬空/发布边界中文提示；
- 当前图只预览已保存的 current revision；
- 插入和移除本身不写独立图表数据，依赖随 Markdown 保存落库。

访客：

- 正文短码渲染为可见、可点击的公式名称与公开结论公式；
- 网络图位于当前公式“结论公式”之前；
- 当前公式突出，ancestors 在上、dependencies 在下；
- 节点不显示 `formulaId`、`revisionId` 或发布状态；
- 支持点击导航、缩放、拖动、适配、居中、展开和收起；
- 图标按钮提供中文 `title` 与 `aria-label`；
- Cytoscape.js 3.34.0 本地 vendor，MIT 许可证随仓库保留，无 CDN。

## 7. 隔离浏览器证据

A00 使用全新临时 `DATA_DIR` 和 5588 端口完成最终复测。没有打开或写入当前/生产 database 与 runtime-data；验收后服务、监听和临时目录均已关闭清理。

样本为三层分支汇聚：

`总损耗结论 -> 支路 A / 支路 B -> 公共基础项`

并在来源卡 current revision 额外加入仅草稿的“内部草稿补偿项”。实测：

- CMS current 依赖数为 3，public published 依赖数为 2；
- CMS 显示待发布名称 `SECRET-NAME-A00`，游客仍显示上一已发布名称；
- 公开 JSON 不含草稿名称、待发布名称、内部根公式 ID、`formulaId` 或 `revisionId`；
- 桌面 CSS viewport `1440 x 900`；
- 图谱显示 4 个公开节点、6 个图标控制；
- 3 个 Cytoscape canvas 均为非空尺寸，CSS 尺寸 `746 x 430`；
- `document.scrollWidth=1425 <= innerWidth=1440`；
- 图谱区域视觉/DOM 顺序在结论公式之前；
- 点击分支 B 正确导航到 `review-branch-b`；
- 放大、画布拖动、24 节点默认范围、边界展开 1 个节点及收起均通过；
- 30 节点公开图默认 24、隐藏 6，服务端载荷为 30；
- 半屏 `760 x 900` 与手机 `390 x 844` 均无横向溢出或按钮重叠；
- 最终控制台为 0 warning、0 error。

首轮曾发现 `/formula-graph.js` 未进入公开静态白名单而返回 403；已在 `server.js` 修复，并在分支测试中加入白名单回归。重启后脚本 200、图谱成功挂载。

自定义 `wheelSensitivity` 已移除，Cytoscape warning 清零。

## 8. 修改文件

- `migrations/021_branching_derivation_graph.js`
- `migrations/022_formula_revision_presentation_snapshot.js`
- `lib/content.js`
- `lib/validators.js`
- `server.js`
- `data/markdown-renderer.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `derive.html`
- `post.js`
- `formula-graph.js`
- `assets/vendor/cytoscape.min.js`
- `assets/vendor/cytoscape.LICENSE.txt`
- `scripts/test-linear-derivation-graph.js`
- `scripts/test-branching-derivation-graph.js`
- `scripts/test-formula-catalog.js`
- `scripts/test-formula-reference-versioning.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md`

`styles/20-content.css` 未由 A26 修改；共享工作区中该文件已有其他参与者脏改，A26 未覆盖或格式化。

## 9. 检查结果

最终以下全部通过：

- `test:branching-derivation-graph`
- `test:linear-derivation-graph`
- `test:formula-publication`
- `test:formula-catalog`
- `test:article-formula-authoring`
- `test:formula-reference-versioning`
- `test:markdown`
- `test:calculation-book`
- `scripts/verify-api.ps1`：`ok=True`、CSRF 拒绝通过
- `codex:contract`：654 passed，0 warnings，0 failures
- 相关 JavaScript 文件 `node --check`
- `git diff --check`，仅既有行尾提示

未执行 Git stage/commit/push，未写云端、生产或当前数据。

## 10. 残余风险

1. 当前 240 节点上限限制响应体，但服务端仍会先读取公开公式和边并统计整个连通分量；超大公式库后续应改为受限递归查询或缓存。
2. 既有静态目录前缀仍允许目录内文件公开读取；S19 新增的 `formula-graph.js` 和 Cytoscape 资源已明确纳入白名单，但全站静态边界应在独立安全切片治理。

## 11. 接管结论

S19 已由 A00 验收关闭。下一切片为 `S20_formula_authoring_drawer`，唯一写者为 `A27_FormulaAuthoringDrawer`。
