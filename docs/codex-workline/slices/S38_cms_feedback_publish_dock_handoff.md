# S38 CMS 悬浮反馈与发布栏交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已把文章保存草稿、发布和更新发布收敛到同一个 `contentForm` submit 处理器。
- 已移除文章模式中部的重复主要提交入口；项目和推导节点保留通用保存入口。
- 已新增右下角可折叠文章发布栏、统一脏状态、操作忙状态和本地折叠记忆。
- 已新增按 key 替换的分级 toast、3 秒短提示、持久阻断、可访问关闭和旧响应丢弃。
- 已把公式保存与公式发布接入带版本号的统一反馈通道。
- 已覆盖桌面、半宽、移动端、公式抽屉、软键盘偏移、安全区域、浅色、深色和减少动画。

## files_created_or_changed

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `scripts/test-cms-floating-feedback-publish-bar.js`
- `scripts/test-formula-authoring-drawer.js`
- `scripts/test-full-site-dark-theme.js`
- `docs/cms-feedback-publish-dock.md`
- `docs/codex-workline/slices/S38_cms_feedback_publish_dock_handoff.md`

## decisions

- 两个文章浮动按钮只声明草稿或发布意图，统一调用 `contentForm.requestSubmit()`，不复制业务状态机。
- 默认 toast key 为 `cms-global`；文章、公式保存、公式发布和字段校验使用独立 key，避免互相遮挡或旧结果回写。
- 错误默认持久，成功、信息和普通提醒默认 3 秒；字段级原生校验不被 toast 替代。
- 窄屏公式抽屉展开时发布栏在其上方；软键盘出现时使用 `visualViewport` 调整可见区域。

## risks

- 桌面自动化不能实际弹出移动操作系统软键盘；该组合由 `visualViewport` 运行时代码和 `390 x 844` 确定性矩形夹具验证。
- 当前 CMS 仍是单文件脚本，反馈控制器保持局部实现；后续若拆分模块，应保留 key、operation version 和单提交入口契约。

## tests_or_checks

- `node scripts/test-cms-floating-feedback-publish-bar.js`
- `node scripts/test-formula-authoring-drawer.js`
- `node scripts/test-full-site-dark-theme.js`
- `node --check admin/admin.js`
- `git diff --check -- <S38 allowed paths>`
- 隔离端口 `1969` 和临时 `DATA_DIR` 浏览器实测：文章字段阻断、后端阻断、保存、发布、更新发布、toast 时序、折叠记忆、1440/760/390、浅深色、公式抽屉、无横向溢出；临时服务和数据已清理。

## next_handoff

返回 `A00_ProjectDirector` 做独立回归与门禁验收；通过后进入 `S40_batch_regression_evidence / A46_BatchRegressionEvidence`。
