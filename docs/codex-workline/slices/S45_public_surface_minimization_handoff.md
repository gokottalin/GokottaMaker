# S45 公开表面最小化交接

## status

`complete_and_accepted_by_A00`

## scope_completed

- 匿名内容接口改为服务端最小公开投影，内部状态、聚焦元数据和管理字段不再进入游客响应。
- 聚焦模式公开小程序注册表只保留 MD2File；其他小程序代码、数据和历史资产仍保留在服务器端。
- 公开页面移除 CMS 链接、静态内容种子和非 MD2File 小程序标识，不再由前端接收完整数据后隐藏。
- 聚焦禁止路由、资源和随机未知路径统一返回通用 HTML 404；公开 SEO、robots、sitemap 不再暴露管理端或私有小程序。
- A00 已完成专项回归、项目契约及桌面和移动端真实浏览器验收。

## files_created_or_changed

- `server.js`
- `lib/seo.js`
- `data/miniapps.js`
- `data/content-store.js`
- `index.html`
- `maker.html`
- `category.html`
- `projects.html`
- `miniapps.html`
- `post.html`
- `project.html`
- `derive.html`
- `tools/md2doc.html`
- `site-layout.js`
- `main.js`
- `scripts/test-public-surface-minimization.js`
- `scripts/test-focus-mode.js`
- `scripts/test-md2file-public-entry.js`
- `scripts/test-public-content-freshness.js`
- `package.json`
- 本交接文件及 S45 总控路由文件。

## decisions

- 游客端仅消费服务端公开投影，浏览器本地存储和静态完整种子不再作为公开内容后备来源。
- 保留 CMS 全量读取能力，但只允许后续私有网关与现有认证后的管理端使用。
- 聚焦模式使用服务端资源白名单，不物理删除未来可能恢复的小程序资产。
- 私有 CMS 路径、认证命名空间与轮换策略继续由 S46 单独实现，避免安全边界混入本切片。

## risks

- S45 为兼容现有回归暂时保留本机旧认证端点；S46 必须将标准管理页面、登录、会话和管理 API 全部收口到可轮换私有命名空间。
- 本次未修改版本、当前或生产数据库，未部署、未写入秘密，也未执行 Git 写入。

## tests_or_checks

- `npm.cmd run test:public-surface`：通过。
- `npm.cmd run test:focus-mode`：通过。
- `npm.cmd run test:public-content-freshness`：通过。
- `node --experimental-sqlite scripts/test-md2file-public-entry.js`：通过。
- `git diff --check`：通过，仅有仓库既有行尾转换提示。
- 真实浏览器桌面与 `390 x 844` 移动端：MD2File 唯一公开，CMS/私有小程序标识为 0，移动端无横向溢出。
- `/admin/index.html` 与随机未知路径：状态、标题、正文均为同一通用 404。

## next_handoff

- S45 已由 `A00_ProjectDirector` 验收。唯一活动写入者转为 `A55_PrivateCmsGateway`，执行 S46 私有 CMS 网关。
