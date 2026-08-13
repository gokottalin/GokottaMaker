# S49 公式角标与图谱界面交接

## status

`completed_and_accepted_by_A00`

## scope_completed

- 每个正文公式绑定仅渲染一个紫色圆形右上角跳转标记，保留准确的 `title` 与 `aria-label`。
- 移除公式正文旁重复的可见引用文字，以及公式详情页重复的下级关系卡片输出。
- 图谱节点区分“文章引用”和“公式推导”，并按节点类型生成公开跳转或 CMS 编辑行为。
- CMS 图谱中的草稿、已发布、已归档节点同时使用颜色、边框和文字状态；公开投影不携带这些管理状态。
- 修正私有 CMS 深路径中的文章跳转，固定指向站点根路径 `/post.html?id=`。
- 复杂公式、分支、合并、移动端布局、键盘语义与深色主题均已复测。

## files_created_or_changed

- `data/markdown-renderer.js`
- `formula-graph.js`
- `post.js`
- `derive.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-formula-marker-graph-ui.js`
- `scripts/test-branching-derivation-graph.js`
- `package.json`

## verification

- `node --check formula-graph.js`
- `node --check post.js`
- `node --check admin/admin.js`
- `npm.cmd run test:formula-marker-graph-ui`
- `npm.cmd run test:formula-binding-marker`
- `npm.cmd run test:formula-map-flow-layout`
- `npm.cmd run test:formula-relationship-projection`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run test:markdown`

以上检查全部通过。

## protected_boundaries

- 未修改数据库结构或当前/生产数据。
- 未执行部署、服务操作、版本变更、密钥写入或任何 Git 写操作。

## next_handoff

- A59 仅生成 S50 安全与回归证据；如发现产品失败，必须回传 A00，不得在 QA 切片内夹带产品修复。
