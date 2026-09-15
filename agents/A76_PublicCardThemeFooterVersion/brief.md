# Agent 76 Public Card Theme Footer Version（公开卡片、主题首帧、版本与备案页脚）

## Mission

在 S65 已验收的公开页面上统一主要卡片视觉，消除日夜主题首屏闪烁，并以权威元数据投影专业版本格式和公开备案页脚。本包只处理共享公开壳层及 CMS 的版本/主题初始化，不改变内容权威或工作流。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/requirements/active/REQ-20260913-011.json`
- `docs/codex-workline/requirements/active/REQ-20260913-012.json`
- `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`
- `data/footer.js`
- `data/site-meta.js`
- `styles/00-base.css`
- `styles/20-content.css`

## May Edit

- `404.html`, `category.html`, `derive.html`, `formula.html`, `index.html`, `maker.html`, `miniapps.html`, `post.html`, `project.html`, `projects.html`, `search.html`
- `tools/gokotta-elec.html`, `tools/larkix-elec.html`, `tools/md2doc.html`
- `admin/index.html`, `admin/course-paths.html`
- `data/theme-init.js`, `data/footer.js`, `data/site-meta.js`
- `server.js`（仅允许公开 `/data/theme-init.js` 与 `/assets/icons/beian.png`）
- `styles/00-base.css`, `styles/20-content.css`, `styles/40-responsive.css`, `styles/larkix-home.css`, `styles/larkix-elec.css`, `styles/gokotta-elec.css`
- `admin/admin.css`, `admin/admin-dark.css`
- `assets/icons/beian.png`（必须逐字节复制 Owner 提供的 `C:/Users/10731/Downloads/备案图标.png`）
- `scripts/test-public-card-theme-footer-version.js`
- `scripts/run-public-card-theme-footer-browser-fixture.js`
- `docs/codex-workline/slices/S66_public_card_theme_footer_version_handoff.md`

## Contract

- Maker 小程序、首页电子基础/聚焦及搜索结果卡片共享圆角、边框、阴影、间距、宽度和字体层级令牌；保留必要的内容变体，同网格等宽，手机单列满宽且无横向溢出。
- 所有公开页与两个 CMS 页面都必须在样式首次绘制前应用主题；只接受保存的 `light`/`dark`，未设置或非法值固定为 `light`，不得跟随系统偏好。
- 白天、夜间冷加载和跨页导航均不得先绘制相反主题；既有切换和持久化继续工作。
- 权威版本展示统一为 `LarkixMaker v2.5.5 · Build 20260911.0001`，不得引入第二版本源或执行版本升级。
- 所有公开页脚显示 `粤ICP备2026065094号-1` 与 `粤公网安备44522402000188号`；公安图标位于文字前，指定链接新标签打开且 `rel="noreferrer"`。CMS 只显示版本，绝不显示备案栏。
- `server.js` 只能增加 `/data/theme-init.js` 与 `/assets/icons/beian.png` 两个静态白名单项。

## Checks

- 两份来源需求 schema/digest/确认状态
- focused 静态测试和真实浏览器冷启动/首帧/跨页/响应式测试
- S65 focused、S64、S63、S62、S60、S50 与 `codex:contract` 全回归
- `node --check`、`git diff --check`、保护路径与临时残留检查

所有浏览器/API 检查只使用隔离 `DATA_DIR`，结束后清理进程、profile 和临时目录。

## Forbidden

内容/API/CMS 工作流/迁移修改；S67 实现；系统主题默认；CMS 备案栏；版本升级；生产/当前数据、Git、部署、云、服务、秘密或破坏性操作。

## Handoff

完成后写入 `docs/codex-workline/slices/S66_public_card_theme_footer_version_handoff.md` 并直接回传 A00。A00 未接受时只在本写集内返工；不得启动 S67。
