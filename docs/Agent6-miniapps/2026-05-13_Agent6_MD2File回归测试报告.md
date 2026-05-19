# Agent6 MD2File 回归测试报告

日期：2026-05-13
候选版本：`V2.4.9+20260513-1148`
范围：Agent0 第2次测试问题处理分工中的 Agent6/Leo 小程序与工具页复测

## 结论

MD2File 已完成本轮 Agent6 复测和小范围修复。当前结果：

- 小程序中心入口显示 `MD2File V0.3`，`LarkixElec V1.3` 保持正确。
- `tools/md2doc.html` 可见中文文案已修复，无三连问号污染。
- 同步滚动开启时，Markdown 输入区与预览区比例同步通过。
- 同步滚动关闭时不会自动同步；点击“对齐当前位置”后可按最近滚动来源手动对齐。
- DOCX 导出可用，下载文件头为 `504b0304`。
- `/api/md2file/convert` 错误提示版本已同步为 `V0.3`。

## 本轮修复

- `tools/md2doc.html`：修复页面标题、meta 描述、导航、返回入口、文件名、页边距、等待转换等文案。
- `tools/md2doc.js`：修复同步关闭时最近滚动来源未记录的问题，手动对齐可正确使用当前滚动源。
- `server.js`：同步 MD2File API 响应版本到 `V0.3`，修复 MD2File 与 LarkixElec 小程序接口中的可见错误提示。
- `data/miniapps.js`：`MD2File` 版本更新为 `V0.3`。

## 验证命令

```text
node --check tools\md2doc.js
node --check lib\md2doc.js
node --experimental-sqlite --check server.js
node scripts\check-version.js
```

本地服务：

```text
http://127.0.0.1:4336/healthz
http://127.0.0.1:4336/miniapps.html
http://127.0.0.1:4336/tools/md2doc.html
```

## 接口复测

- `POST /api/md2file/convert`，`format=docx`：返回 `200`，MIME 为 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`，文件头 `504b0304`。
- `POST /api/md2file/convert`，空 Markdown：返回 `400`，`version=V0.3`，提示 `Markdown 内容不能为空。`
- `POST /api/md2file/convert`，`format=pdf`：返回 `400`，`version=V0.3`，提示当前仅支持 DOCX，PDF 后续接入。
- `GET /api/elec/llm-handoff` 和 `?mode=full`：返回 `V1.3`，内容无三连问号污染。

## 浏览器复测

Browser 插件路径：

- in-app browser 完成页面身份、入口卡片、工具页标题、主要控件和控制台检查。
- in-app browser 点击滚动区内按钮时出现坐标层点击失败，因此同步滚动细节和下载流程改用捆绑 Playwright 复测。

捆绑 Playwright 结果：

- 小程序中心：`MD2File`、`V0.3`、`LarkixElec V1.3` 可见。
- 工具页：`MD2File Markdown 转换器`、`同步滚动 开`、`对齐当前位置`、`下载 DOCX` 可见。
- 同步滚动开启：输入区比例 `0.6200`，预览区比例 `0.6201`。
- 同步滚动关闭：输入区比例 `0.8200`，预览区保持 `0`。
- 手动对齐：输入区比例 `0.8200`，预览区比例 `0.8200`。
- 控制台：无 error/warn。

## 视觉证据

```text
docs/Agent6-miniapps/visual-20260513-md2file-v03/miniapps-md2file-v03-1366.png
docs/Agent6-miniapps/visual-20260513-md2file-v03/md2file-v03-1366.png
docs/Agent6-miniapps/visual-20260513-md2file-v03/md2file-v03-390.png
```

## 后续建议

语义级同步滚动仍建议由 Agent6/Leo 与 Agent9 协作：当前已通过的是比例同步，适合长文普通编辑；如果要按标题 AST 精准对齐，需要由 Markdown renderer 输出稳定 heading map 后再接入。
