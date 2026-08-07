# S35 文章公式框选建卡 Handoff

## status

`complete`

## scope_completed

- 完整识别 `$...$`、`$$...$$`、`\\(...\\)` 与 `\\[...\\]`，拒绝残缺、多公式和混入正文的选区。
- 新增共享模块、主分类和标签检索/显式新建接口，并在 CMS 中提供单选模块、单选主分类和多选标签控件。
- 按规范化名称与 LaTeX 生成稳定公式身份，新卡固定为草稿。
- 使用来源哈希和服务器基线哈希保护文章并发更新。
- 在单一事务内创建公式卡、保存文章、同步绑定和写入审计；任一步失败时完整回滚。
- 原公式与定界符逐字保留，仅在其后追加统一公式绑定短码。

## files_created_or_changed

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `scripts/test-article-formula-authoring.js`
- `scripts/test-formula-authoring-drawer.js`
- `scripts/test-article-formula-selection-create.js`
- `docs/article-formula-selection-create.md`
- `docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md`

## decisions

- 不自动替管理员创建模块、主分类或标签；新项必须由对应“新增”按钮明确确认。
- 同一名称与 LaTeX 得到同一稳定身份，若已存在则引导复用已有公式卡。
- 草稿公式卡不能绕过既有发布流程，已发布文章需先转草稿再执行建卡绑定。
- 保留原 LaTeX，绑定标记由 S33 的共享渲染器显示在公式右上角。

## risks

- 浏览器自动化环境不能保留 textarea 的鼠标/键盘选区，因此完整框选后的保存动作由隔离数据库和真实 API 测试覆盖；浏览器独立覆盖抽屉结构、帮助入口、桌面/移动响应式和控制台状态。
- S39 同样修改 `server.js`，在 S35/S36 释放该文件前不得并行启动。

## tests_or_checks

- `node scripts/test-article-formula-selection-create.js`：通过。
- `node scripts/test-article-formula-authoring.js`：通过。
- `node scripts/test-formula-authoring-drawer.js`：通过。
- `node scripts/test-formula-publication-workflow.js`：通过。
- `node scripts/test-formula-binding-marker.js`：通过。
- `node scripts/test-formula-catalog.js`：通过。
- `npm.cmd run test:markdown`：通过。
- `npm.cmd run test:math-rendering`：通过。
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1 -Port 1965 ...`：隔离数据验证通过。
- 浏览器：1280px 无横向溢出；抽屉宽 390px；6 个字段帮助入口；390px 移动端抽屉宽 359px、内部滚动正常；控制台警告/错误为 0。
- `git diff --check` 与 Node 语法检查：通过。

## next_handoff

返回 `A00_ProjectDirector` 验收。通过后串行开放 `A42_DerivationWorkflowRecovery / S36_derivation_workflow_recovery`；`A45_MD2FilePublicEntry / S39_md2file_public_entry` 继续等待 `server.js` 单写者释放。
