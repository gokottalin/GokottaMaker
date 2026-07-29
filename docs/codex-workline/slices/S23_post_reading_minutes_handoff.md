# S23 文章阅读时间交接

- 执行 Agent：`A30_PostReadingMinutes`
- 最终验收：`A00_ProjectDirector`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-006`
- 状态：`accepted_by_A00`
- next_handoff：`A00_ProjectDirector`

## 1. 交付结论

S23 已把文章阅读时间改为作者可选填的正整数分钟。空值从数据库、DTO、修订记录到游客端均保持 `null`，不再补写或展示固定的“10 分钟阅读”。项目与推导节点不使用该字段。

CMS 仅在文章编辑模式显示“建议阅读时间”，单位为“分钟”，允许留空，只接受 `1-9999` 的正整数。首页、分类页、聚焦内容卡片和文章详情页仅在保存了真实数值时显示阅读时间；空值不会留下占位文字、分隔符或布局空隙。

## 2. 数据与迁移

- `migrations/025_post_reading_minutes.js` 增加 nullable `reading_minutes`。
- 新增写入与更新触发器，拒绝非整数、非正数和超出 `1-9999` 的值。
- 已存在文章不回填，迁移后保持 `null`。
- 新建隔离数据库时，兼容旧种子中的严格数字 `read_time`，转换后清除旧值。
- 修订、恢复、管理 DTO 和公开 DTO 均使用 `readingMinutes`。

## 3. 确定性检查

以下检查均通过：

- `npm.cmd run test:post-reading-minutes`
- 9 个相关 JavaScript 文件语法检查
- `npm.cmd run test:post-cover-coordinates`
- `npm.cmd run test:markdown`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run codex:contract`

专项测试覆盖旧文章空值、合法边界、非法输入、保存与清空、修订与恢复、管理/公开 DTO、API 以及各游客端渲染函数。

## 4. A00 浏览器验收

A00 使用独立临时 `DATA_DIR` 创建两篇已发布文章：

- `S23 八分钟阅读验收文章`：保存 `8`。
- `S23 未设置阅读时间验收文章`：保持空值。

验收结果：

- CMS 内容列表：有值文章显示“电子基础 / 8 分钟阅读 / 日期”，空值文章显示“电子基础 / 日期”。
- 游客首页：有值卡片显示“8 分钟阅读”，空值卡片没有分钟占位。
- 分类页：有值卡片显示“8 分钟阅读”，空值卡片没有分钟占位。
- 文章详情：有值文章页头显示“8 分钟阅读”，空值文章页头只显示日期。
- CMS 输入在 `640x900` 与 `360x800` 下，输入框、单位和帮助文本无重叠或横向溢出。
- 游客详情和首页在 `360x800` 下可读，阅读时间与日期没有重叠。
- 浏览器控制台 `warn/error=[]`。

隔离浏览器服务已停止，临时 viewport 已恢复。

## 5. 修改文件

- `migrations/025_post_reading_minutes.js`
- `lib/content.js`
- `lib/validators.js`
- `data/posts.js`
- `maker.html`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `main.js`
- `category-page.js`
- `post.js`
- `scripts/test-post-reading-minutes.js`
- `package.json`
- `docs/post-reading-minutes.md`
- `docs/codex-workline/slices/S23_post_reading_minutes_handoff.md`

## 6. 保护边界

- 未编辑 `styles.css`、`styles/20-content.css`、`styles/26-inline-math.css` 或 A31 的行内数学文件。
- 未修改 current/production 数据、云端、部署状态或远程服务。
- 未执行 Git staging、commit、push、branch 或 remote 操作。

`next_handoff=A00_ProjectDirector`
