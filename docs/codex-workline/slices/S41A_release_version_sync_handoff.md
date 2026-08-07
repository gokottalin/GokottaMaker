# S41A 发布版本同步交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已将站点版本从 `V2.5.2` 递增为 `V2.5.3`，npm 版本同步为 `2.5.3`。
- 已将静态资源 build 从 `20260730-0012` 递增为 `20260807-0001`。
- 已同步 server、site metadata、package/lock、README、MD2File 图标和全部 HTML 资源缓存键。
- 共在 20 个声明文件中完成 10 处版本替换和 95 处 build 替换，未改变功能内容。

## files_created_or_changed

- `404.html`
- `category.html`
- `admin/course-paths.html`
- `admin/index.html`
- `data/miniapps.js`
- `data/site-meta.js`
- `projects.html`
- `project.html`
- `post.html`
- `package.json`
- `package-lock.json`
- `miniapps.html`
- `index.html`
- `maker.html`
- `README.md`
- `server.js`
- `tools/gokotta-elec.html`
- `tools/larkix-elec.html`
- `tools/md2doc.html`
- `derive.html`
- `docs/codex-workline/slices/S41A_release_version_sync_handoff.md`

## decisions

- 新候选身份固定为 `V2.5.3+20260807-0001`，相对 HEAD 的
  `V2.5.2+20260730-0012` 同时递增补丁版本和 build。
- 只执行精确字符串替换，不修改页面结构、业务逻辑、内容、测试、API 或数据契约。
- 治理文档中作为历史基线出现的旧版本保留，不作为运行时残留处理。

## risks

- 本切片只解决版本唯一性，不代表 Git 或生产发布已经授权。
- S41 的 296 路径清单在加入版本治理文件和新增状态后已经过期，必须重新生成发布门禁。

## tests_or_checks

- `npm.cmd run check:version`：通过，`V2.5.3+20260807-0001`。
- 声明的 20 个运行时路径中不存在 `2.5.2` 或 `20260730-0012` 残留。
- `npm.cmd run test:batch-regression`：`37 passed / 0 failed`。
- 变化路径审计：`303/303 classified`，`0 staged`。
- 隔离 API、重定向 API、浏览器契约、UTF-8、空白、密钥和 Codex 契约均由统一回归覆盖并通过。

## next_handoff

返回 `A00_ProjectDirector` 独立验收；通过后重新开放发布与 Git 门禁复核，重建最终路径清单。Git 暂存、提交、推送和部署仍未授权。
