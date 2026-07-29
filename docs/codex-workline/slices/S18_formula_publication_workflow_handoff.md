# S18 公式发布工作流交接

生成角色：`A24_FormulaPublishingWorkflow`，由 `A00_ProjectDirector` 完成最终复测与收口
工作区：`E:/Project/2607-LarkixWeb`
记录日期：`2026-07-28`

## status

`complete`

S18 已完成 `REQ-20260728-003` 的公式卡 Markdown 推导、草稿/已发布/已归档三态、明确发布、待发布修订隔离、文章发布门禁与 CMS 分类选项管理。所有数据库和浏览器验证均使用新建隔离 `DATA_DIR`；未打开当前或生产数据库，未执行云写、部署、Git staging、commit 或 push。

## scope_completed

- 每条公式不可变修订同时保存结论 LaTeX 与独立 Markdown 推导正文；任一正文变化均可形成当前修订。
- 新公式卡默认 `draft`；只有显式发布后，游客公式页才可访问。
- 已发布卡保留独立 `publishedRevisionId`。继续编辑只生成待发布修订，游客继续读取上一已发布修订；再次显式发布后才切换。
- 归档卡保留稳定身份、修订、发布历史、文章绑定和推导关系，独立游客页隐藏；恢复后按既有发布历史回到已发布或草稿状态。
- 草稿公式可绑定草稿文章；文章发布时逐项阻止草稿公式、待发布修订和从未发布的归档修订，并返回稳定原因。
- 已归档公式不能建立新文章绑定；既有文章继续按保存的不可变 `revisionId` 渲染曾发布历史。
- 模块、主分类和标签新增受控选项表。模块与主分类为单选，标签为多选；支持搜索、显式新建、空格与 Unicode 规范化、slug 生成、精确复用及疑似重复确认。
- CMS 公式编辑器补齐中文字段说明、LaTeX/Markdown 双预览、三态徽标、待发布提示、发布按钮、修订发布历史与访客预览。
- 游客公式页按“结论公式、用途说明、Markdown 推导正文、推导关系、公式信息”展示，只使用公开修订。
- 公式目录 JSON 导入导出保留 Markdown、三态、当前/已发布修订指针和已发布修订历史。

## files_created_or_changed

新增：

- `migrations/020_formula_publication_workflow.js`
- `scripts/test-formula-publication-workflow.js`
- `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`

修改：

- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `post.js`
- `derive.html`
- `scripts/test-formula-catalog.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-reference-versioning.js`
- `scripts/test-linear-derivation-graph.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`

`scripts/test-linear-derivation-graph.js` 仅把旧夹具补为显式发布后再验证公开推导链，使测试基线符合“新卡默认草稿”；未改变线性推导图产品规则。

未修改 `styles/20-content.css`；该文件保留既有本地修改，继续由后续行内公式与媒体任务负责。

## migration_and_api_decisions

- migration 020 为 `formula_revisions` 增加 `markdown_derivation`，为 `formula_cards` 增加 `publish_status`、`published_revision_id` 和 `published_at`。
- 既有未归档卡迁移为已发布，既有归档卡迁移为已归档；两者当前修订均登记为历史已发布修订，从而保留旧游客内容和归档文章复现。
- `formula_revision_publications` 以不可更新、不可删除记录保存每次曾发布修订；触发器检查修订必须属于对应公式。
- 新增管理接口：
  - `GET/POST /api/admin/formula-classifications`
  - `POST /api/admin/formulas/:id/publish`
- 公开 `GET /api/formulas/:slug` 只联接 `published_revision_id` 且只接受 `publish_status=published`，不读取当前待发布修订。
- 文章保存为 `published` 时由服务端检查 Markdown 中的稳定公式绑定，不依赖前端提示。

## state_matrix

| 公式状态 | CMS 可见/编辑 | 新文章绑定 | 独立游客页 | 已有文章历史 |
| --- | --- | --- | --- | --- |
| 草稿 | 是 | 仅草稿文章 | 不可见 | 按绑定修订保留 |
| 已发布且无待发布修订 | 是 | 使用已发布修订 | 可见 | 按绑定修订保留 |
| 已发布且有待发布修订 | 是 | 新绑定仍使用上一已发布修订 | 继续显示上一已发布修订 | 按绑定修订保留 |
| 已归档 | 是，可恢复 | 禁止新建绑定 | 不可见 | 曾发布修订继续显示 |

## browser_evidence

隔离服务：`http://127.0.0.1:4386`，临时账号仅用于本次复测。测试数据位于操作系统 TEMP 下的 `larkix-s18-browser-*`。

- CMS 新建 `power-electronics / 功率变换/BOOST` 与“BOOST 占空比公式”，保存后显示“草稿”和“未发布”修订；游客页返回“公式卡不可用”。
- 首次发布后，游客页按结论、用途、Markdown 推导顺序显示修订 1，数学变量以下角标呈现。
- CMS 将 LaTeX 改为新值并把 Markdown 标题改为“待发布推导”后，状态显示“已发布 · 有待发布修订”；游客页仍显示旧公式与“伏秒平衡”，不出现新标题。
- 再次显式发布后，游客页切换到新公式和“待发布推导”，证明公开指针只在发布动作中更新。
- 归档后 CMS 仅保留“编辑/恢复”，游客页重新变为不可用；恢复后可继续显式发布。
- 点击“查看 LaTeX 说明”后显示中文帮助气泡，内容明确要求只填写公式本体、不要加入定界符且不改写 LaTeX。
- 半宽浏览器观测中，文档 `scrollWidth=1265`、`innerWidth=1280`，公式编辑器及可见控件均未越界，控件矩形无重叠。浏览器运行环境未能提供独立的窄 CSS 像素移动端视口，因此 430 CSS 像素级复核留给 S27 全量回归。
- CMS 与游客页 warning/error 控制台日志均为空。
- 浏览器会话已 finalize；端口 4386 的唯一隔离服务进程已停止。解析绝对路径并验证 TEMP 父目录与 `larkix-s18-browser-` 前缀后删除临时目录；最终 `PortStillListening=false`、`RemainingTempDirs=0`。

## tests_or_checks

以下检查均通过：

- `node --check migrations/020_formula_publication_workflow.js`
- `node --check scripts/test-formula-publication-workflow.js`
- `node --check lib/content.js`
- `node --check lib/validators.js`
- `node --check server.js`
- `node --check admin/admin.js`
- `node --check post.js`
- `node --check data/markdown-renderer.js`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:formula-catalog`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-reference-versioning`
- `npm.cmd run test:linear-derivation-graph`
- `npm.cmd run test:markdown`
- `npm.cmd run test:calculation-book`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`
- `npm.cmd run codex:contract`
- `git diff --check`

本轮 `scripts/verify-api.ps1` 输出 `ok=True`、`csrfBlocked=True`，登录、公开/管理边界、上传、内容 CRUD、知识节点、导出、sitemap、RSS 与退出均通过。

## risks

- migration 020 尚未在当前或生产数据运行；实际发布仍须经过备份、恢复演练和数据门禁。
- 分类管理当前覆盖登记、检索、复用、疑似重复确认和使用量查看；重命名或删除受引用分类不在本需求范围。
- 公式修订继续沿用既有内容寻址身份规则；恢复到完全相同的历史正文时可能复用原修订身份，而不是制造内容完全相同的新修订。
- 430 CSS 像素移动端视觉回归尚未在本浏览器运行环境中完成，必须在 S27 覆盖。

## next_handoff

交回 `A00_ProjectDirector` 接受 S18。

A00 接受后应按 `DISPATCH-20260728-001` 启动：

`A26_BranchingDerivationGraph（分支推导图：把线性公式链升级为可管理、可验证的分支 DAG 与网络视图）`

A26 必须以 S18 的三态公开边界为前提：游客图只能包含允许公开的公式节点，不得读取草稿或待发布修订。
