# S34 MD2File 渲染一致性交接

## status

`completed`

## scope_completed

- MD2File 页面固定加载本地 KaTeX `0.16.22`、共享数学引擎和共享 Markdown 渲染器。
- 导入、粘贴、输入和刷新使用同一浏览器预览校验，错误诊断显示行号并禁用下载。
- 服务端 DOCX 转换使用同一共享数学引擎预检；阻断错误返回 `422`。
- DOCX 保留标题、段落、列表、表格、链接、图片位置、代码块和公式顺序。
- Office Math 支持根号、复杂分式、上下标和紧凑 `m:borderBox`。
- 修复复杂公式扩展类导致 DOCX 漏取，以及中文文件名导致 `Content-Disposition` 500。
- 远程图片不由服务端抓取，以替代文字保留语义位置。
- 移动端公式预览无外框、无纵向滚动条和页面横向溢出。

## files_created_or_changed

- `tools/md2doc.html`
- `tools/md2doc.js`
- `styles/md2doc.css`
- `lib/md2doc.js`
- `server.js`
- `scripts/test-md2file-docx-semantics.js`
- `scripts/verify-api.ps1`
- `docs/md2file-renderer-parity.md`
- `docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md`

## decisions

- 浏览器和服务端校验都使用共享 KaTeX 契约；DOCX 仅负责把已通过校验的语义转换为 OOXML。
- 无效输入同时在客户端和 API 阻断，不能依赖单侧校验。
- 图片导出采用不联网的替代文字策略，避免任意远程抓取和静默丢失。
- 中文文件名使用 ASCII `filename` 回退和 RFC 5987 `filename*`。

## risks

- DOCX 当前保留图片语义位置和替代文字，不嵌入图片二进制；后续若需要嵌图，必须增加受控本地资源解析和独立安全门禁。
- S39 仍负责聚焦模式下 MD2File 的公开入口，本切片没有改变游客路由策略。

## tests_or_checks

- `node scripts/test-md2file-docx-semantics.js`：通过。
- `npm.cmd run test:markdown`：通过。
- `npm.cmd run test:math-rendering`：通过。
- `node scripts/test-formula-binding-marker.js`：通过。
- 隔离 API：有效长文返回 DOCX；不完整 `$$` 返回 `422 / math.delimiter.unclosed / line 1`。
- 浏览器有效样例：KaTeX `0.16.22`、根号、嵌套分式和 `boxed` 正常，下载按钮启用。
- 浏览器错误样例：显示“第 3 行”，错误占位 1 个，下载按钮禁用。
- `390 px` 视口：页面宽度 `375 < 390`，编辑器与预览宽度一致，无页面溢出；公式横向容器可用、纵向无滚动条。

## next_handoff

交回 `A00_ProjectDirector` 验收。S34 与已通过的 S32 共同解除 `S39_md2file_public_entry` 依赖；公式主线可继续进入 `S35_article_formula_selection_create`。
