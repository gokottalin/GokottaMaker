# S44 游客内容新鲜度交接

## status

`complete_and_accepted_by_A00`

## scope_completed

- Nginx 先匹配 `/api/`，动态接口统一关闭代理缓存并返回 `no-store, no-cache, must-revalidate, max-age=0`；普通静态 JavaScript 继续保持长缓存。
- Node 的 JSON 与 `/api/content.js` 响应补齐相同的禁止缓存头。
- 游客端建立一个共享公开快照：可见页面每 5 秒重新验证，窗口重新聚焦或恢复可见时立即重新验证，失败响应不会覆盖最近一次成功快照。
- 首页、分类页、文章详情页和站点布局统一监听 `larkix:public-content-updated`，不再各自轮询并形成互相竞争的状态。
- CMS 发布文章后同时确认公开列表与公开详情，确认失败时不再显示虚假的发布成功。
- A00 已依据专项回归、项目契约和真实浏览器证据验收 S44。

## files_created_or_changed

- `deploy/nginx-gokottamaker.conf`
- `server.js`
- `data/content-store.js`
- `site-layout.js`
- `main.js`
- `category-page.js`
- `post.js`
- `admin/admin.js`
- `maker.html`
- `category.html`
- `post.html`
- `scripts/test-public-content-freshness.js`
- `scripts/test-focus-mode.js`
- `package.json`
- 本交接文件及 S44 治理路由文件。

## decisions

- 动态 API 优先级在 Nginx 与 Node 两层明确保证。
- 游客端只消费服务端公开投影，并以有序有限重新验证刷新页面。
- 静态脚本继续长期缓存，仅为本次变更的入口脚本增加新缓存键；不以全站禁缓存掩盖问题。
- 保持聚焦模式的服务端过滤权威，不在客户端绕过被隐藏内容。

## risks

- Windows 本机与可用 WSL 环境没有 Nginx 可执行文件，因此未运行真实 `nginx -t`；专项测试已验证生产配置的 location 顺序、动态禁止缓存与静态长缓存策略。线上应用配置前仍必须执行 `sudo nginx -t`。
- 本次未改版本、未接触当前或生产数据库、未部署、未重启线上服务，也未执行任何 Git 写入。

## tests_or_checks

- `npm.cmd run test:public-content-freshness`：通过。
- `npm.cmd run test:focus-mode`：通过。
- `npm.cmd run test:carousel-focus-buffer`：通过。
- `npm.cmd run check:version`：通过，版本仍为 `V2.5.3+20260807-0001`。
- `node --check`：`server.js`、`data/content-store.js`、`site-layout.js`、`main.js`、`category-page.js`、`post.js`、`admin/admin.js` 全部通过。
- `npm.cmd run codex:contract`：`1006 passed, 0 warnings, 0 failures`。
- 隔离 API：公开列表、公开详情、焦点外阻断及 `/api/content(.js)` 禁止缓存头通过；静态 `main.js` 未被错误改为 `no-store`。
- 真实浏览器：已打开的游客分类页从 `0 篇内容` 自动更新为 `1 篇内容`，无需刷新；新文章详情可访问；`390 x 844` 无横向溢出；控制台 warning/error 为 0。

## next_handoff

- S44 已回传并由 `A00_ProjectDirector` 验收。当前无短任务 Agent，等待新的已确认需求或明确发布授权。
