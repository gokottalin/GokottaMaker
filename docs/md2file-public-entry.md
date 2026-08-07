# MD2File 公开入口

## 公开投影

`data/miniapps.js` 继续保留全部小程序注册记录。公开页面只调用 `LarkixMiniapps.publicList()`，该投影只返回一个正式名称为 `MD2File` 的记录，并把入口规范化为 `./tools/md2doc.html`。即使旧缓存中的完整注册表包含其他工具，Maker 与小程序中心的本地回退也只选择 `id=md2file` 的第一条记录。

品牌首页保留 LarkixMaker、开源项目与一个 MD2File 卡片，不再公开展示 LarkixElec 工具卡；Maker 首页和小程序中心均从同一公开投影渲染一个 MD2File 卡片。其他工具的注册数据、代码和资产未删除。

## 聚焦模式

聚焦模式新增以下精确公开例外：

- `/miniapps.html`
- `/tools/md2doc.html`
- `/tools/md2doc.js`
- `/api/md2file/convert`

其他 `/tools/` 路径继续返回 404；旧转换别名 `/api/md2doc/convert` 在聚焦模式下也不属于例外。聚焦模式关闭后，原有工具直达路径与旧转换别名仍保持兼容。

## 布局约束

服务端布局归一化始终把 `home.miniapps`、`miniappsPage.miniappsHeader` 和 `miniappsPage.miniappRegistry` 设为可见。`main.js` 与 `site-layout.js` 同时执行前端防御，避免旧缓存或旧布局载荷隐藏 MD2File 入口。

## 验证

- `node --experimental-sqlite scripts/test-md2file-public-entry.js`
- `node --experimental-sqlite scripts/test-focus-mode.js`
- `node scripts/test-md2file-docx-semantics.js`
- `npm.cmd run test:markdown`
- `npm.cmd run test:math-rendering`
- `node scripts/test-full-site-dark-theme.js`
- `node --check data/miniapps.js`
- `node --check main.js`
- `node --check site-layout.js`
- `node --check server.js`
- `npm.cmd run codex:contract`

浏览器复验覆盖聚焦模式开、关两种状态，以及 `1280 x 900`、`800 x 900`、`390 x 844` 三个视口。品牌首页、Maker 首页和小程序中心共 18 个组合均只有一个可见 MD2File 卡片，链接均为规范 URL，页面无横向溢出。三个入口均可进入同一工具页；示例加载、预览和下载启用状态正常。

所有运行时验证均使用临时 `DATA_DIR` 和随机或隔离端口；未读取或修改当前、生产数据，未重启既有服务。
