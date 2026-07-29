# S25 聚焦内容卡片媒体交接

- 执行 Agent：`A25_FocusedContentMedia`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-007`
- 状态：`accepted_by_A00`
- next_handoff：`A00_ProjectDirector`

## status

实现、确定性测试和隔离浏览器取证已完成。A00 已完成独立复测并接受 S25。

## scope_completed

1. `main.js` 为主推荐、推荐列表和备用 article 卡分别加入
   `.focused-card-media--feature`、`.focused-card-media--row`、
   `.focused-card-media--article`，共同使用 `data-focused-card-media` opt-in。
2. `data/media.js` 新增 `hydrateFocusedMedia`、宿主 `ResizeObserver` 和
   `loading/ready/failed` 状态。推荐内容每次重渲染后主动 hydration。
3. `styles/27-focused-content-media.css` 让 `#homeRecommended` 媒体宿主拥有视口尺寸；
   普通图 `object-fit: cover`，S22 crop 由共享 `cropLayout` 按宿主尺寸重放。
4. 失败图透明退出但宿主背景和高度保持，不影响卡片布局。
5. 未加入固定 `aspect-ratio` 或 16:9 卡片规则，未复用 Hero 选择器。

## container_sizing_and_crop_contract

- 精确目标：`#homeRecommended .focused-card-media[data-focused-card-media]`。
- 主推荐宿主由 `.lesson-feature` 当前尺寸拉伸，不使用独立图片比例。
- row 宿主在桌面/半宽为 `96px`，移动端为 `210px`；article 备用宿主为
  `150px / 210px / 184px`，沿用既有卡片响应式尺寸。
- `.larkix-cover-crop` 填满宿主；`cropLayout` 以宿主当前宽高计算整张原图的绝对位置。
- 保存的 `coverCrop` 和源图数据未改动。非 16:9 宿主在保存区域内部继续 cover。

## hero_independence

- 新 CSS 全部限定在 `#homeRecommended`，无 `.hero`、`#homeHero` 或 `.hero-bg` 选择器。
- Hero 渲染段不含 `data-focused-card-media`，原 `applyToImage`、轮播、定时器、滑动和 overlay 未改。
- 专项测试拒绝 Hero opt-in、Hero 选择器、`aspect-ratio` 和 16:9 尺寸表达式。
- 浏览器证据中 Hero `focusedOptIn=false`、`object-fit=cover`；三档尺寸分别为
  `1224.80 x 660`、`744.80 x 660`、`326.80 x 450`。

## source_ratio_browser_matrix

隔离静态夹具使用带圆形和文字的方图、竖图、横图、超宽图，并包含一张 S22 竖图 crop。

| viewport | feature host | row host | cropped portrait image | overflow |
| --- | --- | --- | --- | --- |
| `1280x900` | `569.73 x 748.41` | `278.13 x 96` | `278 x 494.21` | false |
| `800x900` | `743.20 x 278.40` | `334.80 x 96` | `335 x 595.55` | false |
| `360x800` | `325.20 x 278.40` | `297.20 x 210` | `373.33 x 663.70` | false |

所有普通图为 `object-fit=cover`；crop 图保持 `540:960` 原始比例并覆盖宿主四边。失败图状态为
`failed`，桌面/半宽保持 `96px`，移动端保持 `210px`。页面 console `warn/error=[]`。

浏览器截图未写入仓库。一次截图调用的 Browser 宿主出现与页面无关的 Statsig telemetry timeout，
页面自身 console 仍为空，本地夹具 HTTP 资源无意外失败。会话已停止，A00 应独立复测并形成最终验收证据。

## files_created_or_changed

- `main.js`
- `data/media.js`
- `styles.css`
- `styles/27-focused-content-media.css`
- `scripts/test-focused-content-media.js`
- `docs/focused-content-media.md`
- `docs/codex-workline/slices/S25_focused_content_media_handoff.md`

## tests_or_checks

通过：

- `node scripts/test-focused-content-media.js`
- `node --check main.js`
- `node --check data/media.js`
- `node --check scripts/test-focused-content-media.js`
- `npm.cmd run test:post-cover-coordinates`
- `npm.cmd run test:post-reading-minutes`
- `npm.cmd run test:markdown`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run codex:contract`：`719 passed / 0 warnings / 0 failures`

最终复核通过：

- 7 个独占写集文本文件无尾随空白、无 UTF-8 replacement character；
- 新文件均为 UTF-8 without BOM；`styles.css` 保留既有 BOM，未做无关编码改写；
- 受保护的 5 个文件 SHA-256 与开工前完全一致。

## decisions

- 媒体宿主而非图片或 Hero 决定视口。
- 继续复用 S22 唯一 crop 数学，不复制第二套裁切算法。
- 失败图保留稳定背景和尺寸，不引入新上传、断点图片或业务数据。

## risks

1. 极端源比例仍会按 cover 裁掉边缘；有 S22 坐标时优先保留保存区域。
2. 主推荐高度跟随同一 grid 中的内容高度，属于当前卡片容器契约；A00 应用真实推荐条目复测长列表。
3. 浏览器证据来自隔离夹具，未读取或修改 current/production 数据；A00 应独立完成最终浏览器接受。

## protected_boundaries

- `styles/20-content.css`、`styles/10-hero.css`、`styles/25-cover-crop.css`、
  `styles/40-responsive.css` 和 `maker.html` 未编辑。
- 未修改 current/production 数据、文章封面文件、crop 坐标、CMS、阅读时间、公式或主题。
- 未执行云端、部署、恢复、回滚或任何 Git 操作。

## A00_acceptance

A00 独立重复了专项测试、JavaScript 语法检查、S22 封面坐标、S23
阅读分钟、Markdown、公式发布和分支推导图回归。多比例夹具在
`1280x900`、`800x900`、`360x800` 下均满足：

- 方图、竖图、横图、超宽图和失效图宿主 `overflow=hidden`。
- 普通图 `object-fit=cover`；S22 crop 图覆盖宿主四边并保持源图比例。
- `pageOverflow=false`，浏览器 console `warn/error=[]`。
- Hero `focusedOptIn=false`，未继承聚焦卡片规则。

真实隔离首页在三档宽度下也通过。主推荐媒体分别随实际卡片宿主变化，
图像尺寸与宿主一致，移动端无重叠或横向溢出。`styles/20-content.css`、
`styles/10-hero.css` 和 `maker.html` 的 SHA-256 与 A25 开工前一致。

`next_handoff=A00_ProjectDirector`
