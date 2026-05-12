# Agent6 MD2File 小程序接入记录
日期：2026-05-12
范围：第二个网页小程序，Markdown 多格式转换；当前支持 Word DOCX，后续预留 PDF 等格式。

## 命名

- 用户初始建议名：`Trans`
- 第一版临时名：`MD2Doc`
- 当前采用名：`MD2File`
- 原因：`MD2Doc` 过度绑定 Word/DOCX；`MD2File` 表达 Markdown to File，更适合后续继续增加 PDF、HTML、EPUB 等导出格式。

## 接入文件

```text
data/miniapps.js
tools/md2doc.html
tools/md2doc.js
styles/md2doc.css
tools/assets/md2doc-icon.svg
lib/md2doc.js
server.js
```

说明：当前保留 `md2doc` 文件名和 CSS class，避免无必要的大范围移动；对用户可见的名称、注册 id 和新 API 入口已改为 `MD2File` / `md2file`。

## 功能范围

- 左侧 Markdown 输入。
- 右侧实时预览。
- 复用现有 `data/markdown-renderer.js` 做浏览器预览。
- 服务端 `lib/md2doc.js` 通过 VM 加载同一个 Markdown 渲染器，再生成 DOCX。
- 支持标题、段落、列表、表格、代码块、引用和分隔线的基础 Word 结构。
- 新公开接口：`POST /api/md2file/convert`
- 兼容旧接口：`POST /api/md2doc/convert`

## 接口约束

- 单次 Markdown 输入限制：`512 KB`。
- 当前 `format` 仅支持 `docx`。
- 传入其它 `format` 会返回 `FORMAT_UNSUPPORTED`，为后续 PDF 等格式保留清晰扩展点。
- 不写入数据库。
- 不返回服务器路径。
- DOCX 在内存中生成后直接以附件下载。

## 小程序注册

`data/miniapps.js` 当前配置：

```text
id: md2file
name: MD2File
version: V0.2
href: ./tools/md2doc.html
```

当前小程序中心版本备注：

- `GokottaElec`：`V1.3`
- `MD2File`：`V0.2`

## 验证项

- `node --check tools/md2doc.js`
- `node --check lib/md2doc.js`
- `node --experimental-sqlite --check server.js`
- `POST /api/md2file/convert` 返回 DOCX MIME。
- Playwright 检查小程序中心出现 2 个小程序、MD2File 页面预览和下载按钮可见。

## 2026-05-12 最终复核

- 站点版本检查：`node scripts/check-version.js` 通过，当前为 `V2.4.8+20260512-2002`。
- 差异检查：`git diff --check` 通过，仅输出当前工作区已有的 CRLF 提示。
- DOCX 接口烟测：`POST /api/md2file/convert` 返回 `200`、MIME 为 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`、文件头为 `504b0304`。
- 文件名处理：用户传入 `smoke.docx` 时下载名保持 `smoke.docx`，不会重复追加扩展名。
- 视觉证据：
  - `docs/Agent6-miniapps/visual-20260512-md2file/miniapps-md2file-1366.png`
  - `docs/Agent6-miniapps/visual-20260512-md2file/md2file-1366.png`
  - `docs/Agent6-miniapps/visual-20260512-md2file/md2file-390.png`
