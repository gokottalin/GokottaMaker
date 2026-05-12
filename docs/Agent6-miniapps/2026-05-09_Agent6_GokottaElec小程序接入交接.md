# Agent6 小程序功能接入交接

日期：2026-05-09
对接对象：Agent0
范围：访客端小程序中心、GokottaElec 第一个小程序、`/api/elec/*` 最小后端接口
当前同步版本：GokottaElec `V1.3`

## 2026-05-09 V1.3 批注同步

- 访客端小程序中心卡片版本由 `V1.2` 更新为 `V1.3`。
- 后端 `/api/elec/*` 返回版本同步为 `V1.3`，避免工具页、接口和小程序中心显示不一致。
- 本轮未改变 Agent6 的接口边界：新增小程序仍统一登记在 `data/miniapps.js`，工具页仍保持独立于文章、项目和 CMS 数据模型。

## 2026-05-11 主页 Elec 更新呈现

- 依据 `docs/2026-05-11_Agent20测试修复与Agent分工.md`，Agent6 只处理 miniapps 版本一致性与工具页加载结果。
- 首页新增“网页小程序 / Mini App Updates”区块，直接读取 `data/miniapps.js`，展示 GokottaElec 当前版本 `V1.3`、状态、能力标签和工具入口。
- 主页、小程序中心、工具页、后端接口、`gokotta-elec-core/package.json` 当前版本核对均为 `V1.3`。
- Playwright DOM 验证：首页区块显示 `电路生成 / V1.3 / GokottaElec`，入口指向 `./tools/gokotta-elec.html`；小程序中心和工具页同步显示 `V1.3`。
- 新增截图证据：
  - `docs/Agent6-miniapps/visual-20260511/home-elec-update-1366.png`
  - `docs/Agent6-miniapps/visual-20260511/home-elec-update-390.png`

## 2026-05-09 V1.2 同步记录

- 源头仓库：`D:\Project\2605-Elec`
- 源头提交：`c9cc7ee Release GokottaElec V1.2`
- 源头 tag：`v1.2`
- 拉取状态：`git fetch origin` 成功，确认 `HEAD`、`origin/main`、`v1.2` 一致；`git pull --ff-only` 重试时 GitHub 连接重置，但无落后提交需要合并。
- 网页侧已同步：`gokotta-elec-core/package.json`、`gokotta-elec-core/scripts/render-svg.mjs`、`gokotta-elec-core/scripts/generate-20-circuit-gallery.mjs`
- 网页侧版本标注已同步：`server.js`、`data/miniapps.js`、`tools/gokotta-elec.html`

## 本次完成

- 新增访客端小程序中心：`miniapps.html`
- 新增小程序注册清单：`data/miniapps.js`
- 新增 GokottaElec 工具页：
  - `tools/gokotta-elec.html`
  - `tools/gokotta-elec.js`
  - `styles/gokotta-elec.css`
  - `tools/assets/gokotta-elec-icon.png`
- 导航新增“小程序”入口：首页、分类页、项目列表页、文章详情页、项目详情页。
- 新增后端公开接口：
  - `GET /api/elec/samples`
  - `POST /api/elec/build`
- 在站点内放置受控运行核心：`gokotta-elec-core/`

## 管理与扩展规则

后续新增小程序时，优先按以下结构接入，避免和文章、项目、CMS、SEO 分工混在一起：

```text
data/miniapps.js                 小程序注册清单
miniapps.html                    访客端小程序中心
tools/<miniapp-id>.html          小程序页面
tools/<miniapp-id>.js            小程序交互
styles/<miniapp-id>.css          小程序样式
tools/assets/<miniapp-id>*       小程序图标或专属资产
```

每个小程序在 `data/miniapps.js` 中登记 `id`、`title`、`summary`、`href`、`icon`、`version`、`capabilities`。列表页只读取这个清单，不直接写死新增项目。

## GokottaElec 接口说明

`GET /api/elec/samples` 从 `gokotta-elec-core/samples` 读取官方 Sample，返回：

```json
{
  "ok": true,
  "version": "V1.3",
  "samples": []
}
```

`POST /api/elec/build` 接收 CNL 文本，限制单次输入 200KB、最多 10 个电路块。服务端把输入写入受控临时目录，再用参数数组调用：

```text
node gokotta-elec-core/scripts/build-paste.mjs <input> <output-dir>
```

接口返回 `artifacts.svg`、`artifacts.ir`、`artifacts.ercText`，并兼容 `circuits[0]` 回退结构。

## 安全边界

- 不允许访客传入输入/输出路径。
- 不拼接 shell 命令字符串。
- 构建进程 30 秒超时。
- 临时目录位于 `.tmp/gokotta-elec`，请求结束后清理。
- SVG 返回前检查内容以 `<svg` 开始。
- 当前为一期接入，SVG 深度清洗、工程保存、分享链接、导出包仍为预留入口。

## 与其他 Agent 边界

- Agent1：只需在发布时携带 `gokotta-elec-core/`，并验证 `/api/elec/*` 可用。
- Agent2：本次没有修改 CMS 数据模型；如后续小程序需要数据库保存工程，再由 Agent2 设计表结构。
- Agent3：本次没有修改管理端；如后续要在 CMS 管理小程序清单，再由 Agent3 接入管理界面。
- Agent4：本次新增访客页和工具页；后续若全站视觉规范调整，小程序中心和工具页需要跟随复核。
- Agent5：如 GokottaElec 的 CNL、IR、ERC、Sample 或 LLM 对接文档变化，需要通知 Agent6 评估界面与文案同步。

## 验证记录

- `node --check server.js`：通过。
- `node --check tools/gokotta-elec.js`：通过。
- `node gokotta-elec-core/scripts/build-paste.mjs samples/Sample-01-voltage-divider.txt output/web-api-v13-smoke`：通过。
- Node fetch 冒烟：
  - `/api/elec/samples` 返回 5 个 Sample，`version: "V1.3"`。
  - `/api/elec/build` 返回 `ok: true`、`version: "V1.3"`、1 个 circuit、SVG 长度约 3694、diagnostics 为空。
- Playwright 可视化验证：
  - `docs/Agent6-miniapps/visual-20260509/miniapps-1366.png`
  - `docs/Agent6-miniapps/visual-20260509/gokotta-elec-1366.png`
  - `docs/Agent6-miniapps/visual-20260509/miniapps-390.png`
  - `docs/Agent6-miniapps/visual-20260509/gokotta-elec-390.png`

## 需要 Agent0 知悉

本次已经把“小程序”作为独立访客功能域建立起来。后续增加第二个、第三个小程序时，不建议塞进开源项目或文章体系，直接登记到 `data/miniapps.js` 并新增 `tools/` 独立页面即可。
