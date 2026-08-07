# S31 Carousel Slot Authority Handoff

## 状态

`ready_for_a00_acceptance`

## 交付

- 新增 `026_hero_carousel_slots`，建立四槽唯一约束与历史冲突审计表。
- Hero 与 CMS 轮播管理器均改为读取槽位权威源。
- 删除游客端静态文章、聚焦兜底和最新内容补位。
- 冲突保存返回 `409 / CAROUSEL_SLOT_CONFLICT`，不再静默覆盖或自动替换。
- 发布、修订恢复、归档及硬删除均不能绕过槽位管理。
- 聚焦开关已移动到 CMS 排布页，页面只有一个开关。
- CMS 已按 A36 契约加载本地 KaTeX 与共享数学渲染器。

## 验证

- `node --experimental-sqlite scripts/test-hero-carousel-authority.js`
- `npm.cmd run test:carousel-focus-buffer`
- `npm.cmd run test:focus-mode`
- `node --check migrations/026_hero_carousel_slots.js`
- `node --check lib/content.js`
- `node --check server.js`
- `node --check admin/admin.js`
- `node --check main.js`
- `npm.cmd run codex:contract`

## 边界

- 所有数据库验证使用临时隔离目录。
- 未清理历史冲突记录，未删除任何文章本体。
- 未执行 Git、部署、云写入、服务重启或当前/生产数据变更。
