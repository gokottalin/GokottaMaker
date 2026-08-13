# S43 公式技术标识自动化交接

## status

`completed`

## scope_completed

- 服务端统一生成 `formulaId` 与 `slug`，直接建卡和文章框选建卡复用同一分配器。
- 普通创建与编辑请求不得提交技术标识；编辑路由只按已有卡片身份保存。
- CMS 新建表单已移除技术标识控件，保存后显示两项只读技术信息及独立复制反馈。
- 历史公式身份、公开 URL、文章绑定、导入和迁移均未改写。

## files_created_or_changed

- `server.js`
- `lib/validators.js`
- `lib/content.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/test-formula-identity-automation.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-reference-versioning.js`
- `scripts/test-linear-derivation-graph.js`
- `package.json`

## decisions

- 服务端拥有 `formulaId` 与 `slug` 的最终决定权。
- 既有公式标识、公开 URL、文章绑定和推导关系保持不变。

## risks

- 当前修改尚未进入 Git 或生产，线上仍需后续发布门禁。

## tests_or_checks

- `npm.cmd run test:formula-identity`：通过。
- `npm.cmd run test:article-formula-authoring`：通过。
- `npm.cmd run test:formula-catalog`：通过。
- `npm.cmd run test:formula-reference-versioning`：通过。
- `npm.cmd run test:linear-derivation-graph`：通过。
- 浏览器：新建 DOM 无身份控件；保存后两项只读值及复制成功；720x900、390x844 无横向溢出。

## next_handoff

- 已由 `A00_ProjectDirector` 验收；下一切片处理 `REQ-20260812-002` 动态内容缓存滞留。
