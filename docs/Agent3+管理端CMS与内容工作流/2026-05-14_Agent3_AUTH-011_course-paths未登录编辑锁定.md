# 2026-05-14 Agent3 AUTH-011 course-paths 未登录编辑锁定

## 输入依据

- `docs/Agent0+总控与集成/2026-05-14_23-20_第4次复测结果处理与分工.md`
- 问题：`/admin/course-paths.html` 未登录可访问并编辑本地覆盖配置，容易让访客误以为写入 CMS / 数据库。

## 处理结论

`/admin/course-paths.html` 短期继续定位为“课程路径本地预览工具”，不作为正式 CMS 持久化功能。页面现在默认锁定，必须通过 `/api/session` 确认为已登录用户后才允许读取、保存、恢复或清空 `localStorage[gokottamaker_course_meta_v1]`。

## 改动范围

- `admin/course-paths.html`

## 已完成

- 页面首屏文案改为“课程页面本地预览配置”，明确只写入当前浏览器 `localStorage`，不写入 CMS 或数据库。
- 新增登录状态提示区：
  - 未登录：显示“未登录，编辑器已锁定”，提供返回 CMS 登录入口。
  - 已登录：显示“已登录，可编辑本地预览覆盖值”，提示只影响本浏览器。
- HTML 初始态即禁用 JSON 编辑器、保存、恢复、清空按钮，避免 session 校验前的短暂可写窗口。
- 脚本新增 `/api/session` 校验：
  - 未登录不读取本地覆盖值。
  - 未登录点击保存、恢复、清空时直接拦截，不写入 `localStorage`。
  - 已登录后才 `loadOverride()` 并解锁本地预览工具。

## 验证结果

| 项目 | 结果 |
| --- | --- |
| `node --experimental-sqlite --check server.js` | 通过 |
| `node scripts/check-version.js` | 通过，`V2.4.9+20260514-1635` |
| `git diff --check -- admin/course-paths.html` | 通过 |
| inline script 语法解析 | 通过 |
| Browser 未登录访问 `/admin/course-paths.html` | 通过，编辑器和保存/恢复/清空按钮均 disabled |
| Browser 未登录控制台 | 通过，0 error / warn |
| Browser 登录后访问 `/admin/course-paths.html` | 通过，编辑器和本地覆盖按钮解锁 |
| Browser 登录后控制台 | 通过，0 error / warn |

## 交接

- Agent20 复测时重点确认未登录态按钮 disabled、页面文案不再暗示 CMS / 数据库写入。
- 若后续升级为正式 CMS 功能，需由 Agent2 增加受保护 API 和服务端持久化；不应继续只依赖 `localStorage`。
