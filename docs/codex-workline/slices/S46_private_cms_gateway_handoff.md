# S46 私有 CMS 网关交接

## status

`complete_and_accepted_by_A00`

## scope_completed

- 新增仅由部署环境提供的 `PRIVATE_CMS_PATH`，要求 48-128 位 URL-safe 高熵单段值；生产缺失或弱值时拒绝启动。
- CMS 页面、静态资源、登录、会话与全部管理 API 统一进入私有命名空间；标准 `/admin/`、旧认证端点和旧管理 API 默认与随机未知路径返回相同 404。
- 管理端从当前私有页面地址派生 API 前缀，源码、公开 HTML、公开 API、日志和审计不保存具体入口值。
- 私有 API 在入口正确但未登录时仍返回通用 404；登录后继续执行会话、授权、CSRF、登录限速和失败审计。
- 会话 Cookie 使用入口摘要命名、私有路径作用域、`HttpOnly` 和 `SameSite=Strict`；入口轮换后旧 Cookie 无法进入新命名空间。
- 生产只接受 HTTPS 反向代理；仅显式 `ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK=true` 的双回环隔离测试允许明文 HTTP。
- Nginx 私有命名空间关闭访问日志与缓存并设置 `no-referrer`；标准 HTTP 站点跳转 HTTPS。

## files_created_or_changed

- `server.js`
- `admin/admin.js`
- `admin/index.html`
- `deploy/nginx-gokottamaker.conf`
- `.env.example`
- `scripts/gokottamaker.env.example`
- `docs/deployment.md`
- `scripts/test-private-cms-gateway.js`
- `scripts/verify-api.ps1`
- 受影响的隔离 `scripts/test-*.js` 启动环境，仅显式打开旧 API 回环兼容。
- `package.json`
- 本交接文件及 S46 总控路由文件。

## decisions

- 不把隐藏路径当作唯一安全边界；私有入口之外继续保留管理员认证、CSRF、会话、限速和审计。
- 默认关闭旧 API 兼容，且生产环境无法开启；历史回归只能在未配置私有入口、非生产、双回环条件下显式启用。
- 私有入口根路径不自动跳转登录页，Owner 使用完整的 `/<私有值>/admin/index.html`，减少错误探测差异。
- 入口轮换不迁移账户或内容，通过入口摘要 Cookie 名和路径作用域使旧会话不能跨入口复用。

## risks

- 当前生产服务器尚未写入真实 `PRIVATE_CMS_PATH` 或应用新 Nginx 配置；发布时必须在服务器本地生成秘密，执行 `nginx -t` 并验证新入口后再使用。
- Windows 本机没有 Nginx 可执行文件，未运行真实 `nginx -t`；配置通过文本策略和 Node 端代理头测试，线上加载前仍必须执行 Nginx 语法检查。
- 浏览器桌面入口、登录、完整 CMS 数据、旧路径 404 和控制台已验收；当前浏览器连接未实际应用临时移动视口覆盖，因此没有新增移动端截图证据。
- 本次未改版本、当前或生产数据库，未部署、未写入真实秘密，也未执行 Git 写入。

## tests_or_checks

- `npm.cmd run test:private-cms-gateway`：通过；覆盖生产缺失/弱值拒绝、404 一致性、HTTP/HTTPS、认证、CSRF、限速、审计、轮换、数据保留和秘密缺失扫描。
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1 -Port 5499`：通过；覆盖登录、内容/公式相关管理能力、上传、CRUD、公开投影、导出与退出。
- `test:public-surface`、`test:focus-mode`、`test:public-content-freshness`、`test:md2file-public-entry`：通过。
- `test:carousel-focus-buffer`、`test:formula-catalog`、`test:formula-identity`、`test:article-formula-authoring`、`test:formula-reference-versioning`、`test:linear-derivation-graph`、`test:post-reading-minutes`、`test:legacy-formula-migration`：通过。
- `npm.cmd run codex:contract`：`1089 passed, 0 warnings, 0 failures`。
- `node --check` 与 `git diff --check`：通过，仅有仓库既有行尾转换提示。
- 真实浏览器：完整私有地址显示登录页，登录后 CMS 可见且控制台 error/warning 为 0；标准 `/admin/index.html` 与随机未知路径显示相同 404。

## next_handoff

- S46 已由 `A00_ProjectDirector` 验收。唯一活动写入者转为 `A56_FormulaBindingAuthority`，执行 S47 统一公式绑定权威模型与隔离迁移。
