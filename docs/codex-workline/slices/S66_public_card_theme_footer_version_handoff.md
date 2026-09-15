# S66 Public Card Theme Footer Version Handoff

## status

accepted

## scope_completed

- 为 14 个公开页面和 2 个 CMS 页面接入同步 `theme-init.js`，且均位于首个样式表之前；只接受保存的 `light`/`dark`，未设置、非法值或存储不可用时固定为 `light`，不再跟随系统偏好。
- 保留既有主题切换、动画和 localStorage 持久化；`footer.js` 的后续初始化只沿用首帧主题或确定性的 `light` 回退。
- 建立共享公开卡片令牌，统一 Larkix 产品入口、Maker 小程序、电子基础、聚焦内容和搜索结果的圆角、边框、阴影、间距、宽度及移动单列规则，并保留主卡片渐变、封面和内容层级变体。
- 从 `data/site-meta.js` 的单一版本/build 源投影 `LarkixMaker v2.5.5 · Build 20260911.0001`，未升级版本、未新增第二套版本值。
- 所有公开页脚显示精确 ICP 与公安备案；公安图标位于文字前，指定公安链接使用 `_blank` 与 `noreferrer`。两个 CMS 页面只显示专业版本，不渲染备案导航。
- 将 Owner 提供的备案图标逐字节复制到受控资产；`server.js` 仅增加 `/data/theme-init.js` 与 `/assets/icons/beian.png` 两个精确聚焦公开静态资源门禁。

## files_created_or_changed

- `404.html`
- `category.html`
- `derive.html`
- `formula.html`
- `index.html`
- `maker.html`
- `miniapps.html`
- `post.html`
- `project.html`
- `projects.html`
- `search.html`
- `tools/gokotta-elec.html`
- `tools/larkix-elec.html`
- `tools/md2doc.html`
- `admin/index.html`
- `admin/course-paths.html`
- `data/theme-init.js`
- `data/footer.js`
- `data/site-meta.js`
- `server.js`
- `styles/00-base.css`
- `styles/20-content.css`
- `styles/40-responsive.css`
- `styles/larkix-home.css`
- `styles/larkix-elec.css`
- `styles/gokotta-elec.css`
- `assets/icons/beian.png`
- `scripts/test-public-card-theme-footer-version.js`
- `scripts/run-public-card-theme-footer-browser-fixture.js`
- `docs/codex-workline/slices/S66_public_card_theme_footer_version_handoff.md`

本次执行保留并未覆盖 A00 已落盘的 S66 治理登记文件；大量既有历史未跟踪文档也未触碰。

## decisions

- 首帧主题逻辑保持为独立、无依赖、同步 head 脚本；外部脚本出现在 stylesheet 之前，使 CSS 计算时根节点已经有确定主题。
- 旧 CSS 中系统暗色媒体查询继续作为历史兼容层存在，但同步脚本总会写入 `data-theme=light|dark`，因此未设置/非法状态不会命中 `:root:not([data-theme="light"])` 的暗色回退。
- CMS/公开页脚范围按 URL 中的 `/admin/` 边界判定；私有随机 CMS 前缀不影响识别。
- 版本展示仅格式化已有 `version` 和 `build` 字段：移除版本前导 `V` 后统一输出小写 `v`，构建号中的 `-` 映射为 `.`。
- 备案图标源与项目资产 SHA-256 均为 `8DFECAD0DFCB3DC584F2C2447943EEFB1FD65A058856EB0611E2C56DDC4C1FE1`。

## risks

- 若未来新增公开/CMS HTML 页面，必须在首个 stylesheet 前显式接入 `theme-init.js`，并由 focused 静态测试扩展页面清单。
- 外部备案站点的可用性不由本站控制；链接文本、目标和安全属性均保持可访问。
- S64 真实浏览器回归首跑出现一次既有 hash 导航竞态：期望 `#formulas` 时页面已切换到 `#editor`。全部先前阶段通过且夹具完成清理；不改任何 S64 文件的立即独立重跑完整通过，故记录为既有瞬时夹具竞态，不构成 S66 业务回归。

## tests_or_checks

- `REQ-20260913-011` 与 `REQ-20260913-012`：`codex:requirement validate` 均通过；digest 分别与确认值 `sha256:873a16407d48449ee500eb49f8e33f30ac7bc041fa5af12bdeb9df3a799ffa03`、`sha256:6b38436970c32b7541a893315ef9eb6ed3443b720c343b9bcc556c6ca7206031` 一致；均为 `status=dispatched`、Owner confirmed、`openQuestions=0`、`assumptions=0`。
- `node scripts/test-public-card-theme-footer-version.js`：PASS；覆盖 16 页 pre-style 初始化、确定性主题、共享卡片、版本投影、公开/CMS 页脚范围、精确链接/图标/白名单。
- `node --experimental-sqlite scripts/run-public-card-theme-footer-browser-fixture.js`：PASS；真实 Edge/Chrome 在强制系统暗色环境下验证 unset/invalid=`light`、保存 dark 的冷加载与跨页保持、精确公开备案、CMS 排除，以及 390×844 四类卡片/页脚无横向溢出。
- `node scripts/test-public-search-home-composition.js`：PASS。
- `node --experimental-sqlite scripts/run-public-search-home-browser-fixture.js`：PASS。
- `node scripts/test-cms-draft-operations-controls.js`：PASS。
- `node --experimental-sqlite scripts/run-cms-draft-operations-browser-fixture.js --verify`：首跑发生上述既有 hash 竞态；立即独立重跑 PASS，包含 cleanup complete。
- `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js`：PASS。
- `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`：PASS。
- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`：PASS。
- `node scripts/run-formula-workline-regression.js`：15 passed, 0 failed；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `node scripts/run-security-formula-regression.js`：15 passed, 0 failed。
- `npm.cmd run codex:contract`：1309 passed, 0 warnings, 0 failures。
- `node --check` 覆盖全部 S66 JavaScript：PASS；`git diff --check` 无错误，仅既有 LF/CRLF 提示。
- 保护检查：`git diff --name-only -- .env database runtime-data uploads` 为空，cached diff 为空；`larkix-s64-*`、`larkix-s65-*`、`larkix-s66-*` 临时目录均为 0。

## next_handoff

A00 已独立裁决 S66 为 `accepted`。仅在本包精确 commit/push 完成并由治理显式登记开放后，才可启动 S67；A76 不启动 S67。
