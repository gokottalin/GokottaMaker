# S32 聚焦内容封面复验交接

## status

`completed`

## scope_completed

- 在隔离本地预览 `http://127.0.0.1:1961/maker.html` 复验真实游客首页。
- 分别在 `1280 x 900`、`800 x 900`、`360 x 800` 视口检查聚焦内容封面。
- 聚焦封面在三个断点均与卡片宿主宽高一致，使用 `object-fit: cover`，无空白带、拉伸或横向溢出。
- 无裁剪信息的当前样例使用 `object-position: 50% 50%` 居中回退。
- Hero 继续使用独立容器与裁剪规则，未带 `data-focused-card-media`，未继承聚焦卡片尺寸。
- 新建独立浏览器标签页复验，控制台错误为零。

## files_created_or_changed

- `docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md`

本切片没有修改产品代码；现有 S25 聚焦媒体实现已经满足本次需求，避免无依据重复修复。

## decisions

- 依据“先复现真实页面，再做最小修复”的门禁，本次结论为无需新增产品改动。
- 保留现有响应式卡片宿主比例、保存的焦点回放及居中 `cover` 回退。
- Hero 比例和裁剪策略继续独立，不引入固定 `16:9`。

## risks

- 当前隔离数据只在真实首页展示一个聚焦主推荐；横图、竖图、方图和超宽图的多比例覆盖由自动化浏览器夹具补足。
- 浏览器会话保留过一次修复前的历史日志，因此另开全新标签页确认当前加载无错误。

## tests_or_checks

- `node scripts/test-focused-content-media.js`：通过，4 种源图比例、6 个卡片视口均通过。
- `npm.cmd run test:post-cover-coordinates`：通过。
- 真实页面 `1280`：宿主/图片 `570 x 733`，无溢出，居中 `cover`。
- 真实页面 `800`：宿主/图片 `743 x 278`，无溢出，居中 `cover`。
- 真实页面 `360`：宿主/图片 `303 x 319`，无溢出，居中 `cover`。
- 三个视口页面宽度均未超过视口；Hero 均保持 `focusedOptIn=false`。
- 全新浏览器标签页日志：`[]`。

## next_handoff

交回 `A00_ProjectDirector` 验收。S32 通过后，可在 S34 完成后开启 `S39_md2file_public_entry`。
