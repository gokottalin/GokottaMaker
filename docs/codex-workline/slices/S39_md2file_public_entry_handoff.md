# S39 MD2File 公开入口交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 完成小程序注册表的公开投影：保留全部注册数据，公开页面只得到一个正式名称为 `MD2File` 的记录。
- 品牌首页、Maker 首页和小程序中心各展示一个 MD2File 卡片，三个位置统一进入 `./tools/md2doc.html`。
- 聚焦模式下精确开放小程序中心、MD2File 页面脚本和规范转换 API；其他工具路径继续拒绝。
- 服务端与前端共同强制 MD2File 所在布局区块可见，旧布局配置不能隐藏入口。
- 完成专用自动化、双聚焦状态浏览器矩阵、基础工具交互与既有回归。
- A00 独立验收发现公开卡片仍显示旧版 `V0.3` 后，已将注册记录和公开身份统一为协议版本 `V0.4`，并增加公开投影版本断言。

## files_created_or_changed

- `data/miniapps.js`
- `index.html`
- `maker.html`
- `miniapps.html`
- `main.js`
- `site-layout.js`
- `server.js`
- `scripts/test-focus-mode.js`
- `scripts/test-md2file-public-entry.js`
- `docs/md2file-public-entry.md`
- `docs/codex-workline/slices/S39_md2file_public_entry_handoff.md`

## decisions

- 完整注册表继续使用 `window.LARKIX_MINIAPPS`；公开页面使用 `window.LARKIX_PUBLIC_MINIAPPS` 或 `LarkixMiniapps.publicList()`，不删除非 MD2File 记录。
- 公开身份固定为 `id=md2file`、`name=MD2File`、`href=./tools/md2doc.html`，不创建第二套工具实现。
- 聚焦模式精确例外为 `/miniapps.html`、`/tools/md2doc.html`、`/tools/md2doc.js` 和 `/api/md2file/convert`；不宽泛开放 `/tools/`。
- 聚焦模式关闭时保留其他工具直达路径和旧转换别名，满足“隐藏而不删除”的兼容边界。
- `home.miniapps`、`miniappsPage.miniappsHeader`、`miniappsPage.miniappRegistry` 是不可隐藏的公开入口区块。

## risks

- 非 MD2File 工具在非聚焦模式下仍可通过旧书签直接访问，但不会出现在三个公开列表；这是保留代码和历史资产的预期结果。
- 完整注册表仍作为静态数据提供，公开唯一性由投影层保证，不以物理删除实现。
- 额外执行 `node scripts/test-inline-math-layout.js` 时失败：该测试的全文件负向位移断言命中既有公式绑定标记 `translateY(-1px)`；涉及 `styles/26-inline-math.css` 与该测试均不在 S39 写集，S39 未越界修改。S39 指定的共享数学、Markdown、MD2File、聚焦、暗色与浏览器检查均通过。

## tests_or_checks

- `node --experimental-sqlite scripts/test-md2file-public-entry.js`：通过；验证注册数据保留、唯一投影、公开版本 `V0.4`、规范 URL、布局反隐藏、聚焦例外和精确拒绝。
- `node --experimental-sqlite scripts/test-focus-mode.js`：通过。
- `node scripts/test-md2file-docx-semantics.js`：通过。
- `npm.cmd run test:markdown`：通过。
- `npm.cmd run test:math-rendering`：通过。
- `node scripts/test-full-site-dark-theme.js`：通过。
- `node --check`：`data/miniapps.js`、`main.js`、`site-layout.js`、`server.js`、两个专用测试均通过。
- 浏览器矩阵：聚焦开/关 × `1280 / 800 / 390` × 品牌首页/Maker/小程序中心，共 18 个组合通过；每处一个可见 MD2File 卡片、零其他公开工具卡、统一 URL、无横向溢出。
- 浏览器导航：三个卡片动作均进入 `/tools/md2doc.html`；编辑器、预览、示例按钮存在，示例加载后预览有内容且下载按钮启用；控制台错误为零。
- 布局反隐藏浏览器复验：提交三个入口区块 `visible=false` 后，服务端返回值仍为 `true`，Maker 与中心移动视口仍各显示一个卡片。
- `npm.cmd run codex:contract`：通过，`932 passed / 0 warnings / 0 failures`。

全部服务端测试与浏览器复验使用临时 `DATA_DIR`；未执行 Git、部署、云写入、当前或生产数据修改，也未重启既有服务。

## next_handoff

交回 `A00_ProjectDirector` 验收 S39。验收时请核对上述 11 个允许路径与测试结果；S39 通过后可作为 S40 批次回归证据的输入。
