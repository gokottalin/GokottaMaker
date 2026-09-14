# S64 CMS Draft Operations Controls Handoff

## status

`rework_completed_pending_A00_review`

S64 已在现有 CMS 内交付文章/公式本地草稿保护、六类常用等级运营控件、推导链路封面管理和首页三卡聚焦编排。实现仅调用 S63 权威 API/DTO；未修改后端、迁移、公开页面、搜索类型、Hero 四槽位、身份、发布或访问控制语义，未执行 Git 写入。

## requirement_gate

- `REQ-20260913-005`：validate 通过；digest `sha256:be6130be14a685f5ba36def89d703b87d130cc8152a4fafdcbcf24384a9260ab`
- `REQ-20260913-007`：validate 通过；digest `sha256:9aa118a559dfcd6ca47c7a25be156933efc3dbf939c9fc74aac741042d86b108`
- `REQ-20260913-009`：validate 通过；digest `sha256:5cafea05254fe469c576688efa58c8c585968f2a1e4ac7faa60fb0095e5f6750`
- `REQ-20260913-010`：validate 通过；digest `sha256:3d394e711a47ca8898973908359cc27dcd8d35a341e28199c12e289e00407adb`
- 四包均为 Owner-confirmed，`openQuestions=0`、无未接受 assumptions。

## rework_record

- A00 首轮复核拒绝项 1：同编辑器处于冲突状态时，文章/公式 autosave 仍可能覆盖稳定 key 中唯一的旧本地侧。返工后，冲突期间的新编辑写入独立 `server-side-edit` working identity；明确保留服务器侧时，旧本地侧另存为 `preserved-local`，两侧均可从 picker 恢复。
- A00 首轮复核拒绝项 2：前端以 `commonLevel ?? 5` 复制了 S63 默认语义。返工已删除这两处客户端默认，CMS 直接消费并提交 S63 权威 DTO/API 值。
- 返工真实浏览器复测进一步定位到初始化自锁：自动恢复文章草稿后使用 `window.location.hash = "editor"`，会触发自身 `popstate` 脏保护并弹出确认。现仅在页面初始化自动恢复文章草稿的两条路径使用 `history.replaceState`，保留当前 pathname/search 并精确设置 `#editor`；用户真实 back/popstate 与站内导航 guard 未关闭、未绕过。

## scope_completed

1. 文章和公式全部编辑字段持续写入当前浏览器 localStorage；编辑对象按类型和稳定身份隔离，新建文章/公式每次明确“新建空白”都会生成新身份并保留旧草稿。
2. 脏/净状态接入刷新、关闭、返回、站内导航提示。文章和公式分别按自身 dirty 标记保存，任一编辑器的导航保护不会写入或清除另一编辑器 key；页面初始化自动恢复仅以 `history.replaceState` 内部切换到 `#editor`，不会反向触发自身 `popstate` guard。
3. 草稿记录保存服务器基线 token。基线不一致时保留服务器表单为安全默认，显示明确的恢复本地、保留服务器、丢弃本地选择；比较使用稳定 `kind + identity + baseToken` 等值。冲突期间同编辑器的新编辑进入独立 working record，明确保留服务器后旧 local 与 working 两侧仍分别可恢复。
4. 登录初始化与刷新恢复流程显式渲染文章/公式 picker；可枚举并分别打开多个新建草稿。仅正式保存成功清除对应草稿；校验、服务、网络失败继续保留。
5. 新增运营页，按 S63 DTO 回显和保存 `article/project/formula/derivation/focus/miniapp` 六类 1-10 常用等级；默认、缺失、清空和非法值语义不在前端复制，提交给 S63 权威接口处理。
6. 推导链路支持受控图片库上传/选择后的预览、替换和解除引用；解除引用只提交空 cover，不物理删除文件。无自定义封面时明确显示公开端简化关系图回退。
7. 首页聚焦运营控件固定 `large/small-1/small-2` 三槽位，只列已发布文章；前端预检选满、互异，保存后以权威 DTO 回显。撤回/归档造成的缺失槽位显示原因且不自动替换；Hero 维持原逻辑。
8. 补充浅色/深色、键盘可达、390px 移动布局和无横向溢出样式；保留 S62 双栏、依赖选择器、互斥保存与反馈语义。

## files_created_or_changed

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `scripts/test-cms-draft-operations-controls.js`（新增）
- `scripts/run-cms-draft-operations-browser-fixture.js`（新增）
- `docs/codex-workline/slices/S64_cms_draft_operations_controls_handoff.md`（新增）

以上 7 个文件是 S64 业务、测试与 handoff 写集；未把其他无关 untracked 历史文件纳入本包。

## governance_registration

以下 8 个路径属于 S64 注册范围，由派发/A00 产生，不计入上述 7 个 S64 实现写集；A00 接受后会在本包精确 Git 写入中一并纳入，绝不带入其他无关 untracked 历史文件：

- `.codex/larkix-governance.json`
- `PROJECT_WINDOW.md`
- `agents/A00_ProjectDirector/brief.md`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/task_registry.json`
- `docs/prompts/next_agents.md`
- `.codex/agents/a74-cms-draft-operations-controls.toml`
- `agents/A74_CmsDraftOperationsControls/brief.md`

## local_draft_decisions

- 版本与前缀：`larkixmaker_admin_autodraft_v2`，记录 `version=2`，另有同前缀 registry；旧单文章 key 只迁移，不静默丢弃。
- key：`${prefix}:${kind}:${identity}`；`kind` 为 `article` 或 `formula`。既有内容使用服务器稳定 ID/formulaId，新建表单使用 `crypto.randomUUID()` 或等价随机回退生成本次稳定身份。
- 内容：只存当前表单 snapshot、identity、savedAt、baseToken；不创建服务器草稿/修订，不发第三方。
- 冲突：服务器修订/更新时间等字段组成基线 token。token 变化时安全默认保留服务器侧，草稿保持原样并显示选择；只有管理员显式恢复才把本地 snapshot 放入表单。
- 清理：成功服务器保存后按保存前捕获的 identity 清理；任何前端校验、HTTP、网络失败均保留。切换新建表单只保存旧 dirty 草稿并生成新 identity，不删除旧记录。
- 隐私提示：localStorage 会在共享浏览器配置中保留作者输入；CMS 提供显式丢弃入口，但不会替管理员自动清理仍有恢复价值的草稿。
- 返工补充：冲突期间稳定 local snapshot 不被同编辑器 autosave 覆盖，新编辑保存为独立 `server-side-edit` working record；明确 keep-server 后旧 local 另存 `preserved-local`，picker 可分别恢复 preserved/working 两侧。

## checks

以下均为 A00 在返工后独立执行的结果：

- `node scripts/test-cms-draft-operations-controls.js`：S64 static PASS。
- `node --experimental-sqlite scripts/run-cms-draft-operations-browser-fixture.js --verify`：S64 browser PASS，最终 `cleanup complete`。
- `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js`：S63 migration PASS。
- `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`：S63 authority PASS。
- `node scripts/run-security-formula-regression.js`：S50 `15 passed, 0 failed`。首轮直接执行出现的 `cmd.exe EPERM` 属沙箱进程启动门禁；改用已授权 `powershell -NoProfile` 后为 `15/15`，不计为代码失败。
- `node scripts/run-formula-workline-regression.js`：S60 `15 passed, 0 failed`；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`：S62 PASS。
- `npm.cmd run codex:contract`：`1282 passed, 0 warnings, 0 failures`。

## browser_and_api_evidence

- 隔离真实浏览器逐阶段覆盖 login、文章/公式多个 new identity、刷新后 picker 枚举、冲突安全默认、跨编辑器隔离，以及文章和公式同编辑器冲突的双侧保留。
- 文章与公式在冲突期间修改服务器侧表单时，稳定 local snapshot 保持不变，working snapshot 独立保存；明确 keep-server 后，`preserved-local` 与 `server-side-edit` 均在刷新后的 picker 精确出现，并可分别恢复且不串载。
- dirty formula 切换到另一新建公式时恰好触发一次确认；用户确认后进入空白新身份。随后 clean 状态使用真实 `Page.navigate` 导航，持久 dialog guard 覆盖 load 与 post-load readiness，未自动 accept/dismiss dialog，阶段输出 `clean formula navigation passed`。
- 自动恢复既有文章或新建文章草稿时，内部路由使用保留 pathname/search 的 `history.replaceState` 设置 `#editor`；初始化未再触发自身 popstate confirm，真实用户 popstate/站内导航保护仍保留。
- 刷新后 preserved/working picker 完整渲染，文章和公式两侧均分别恢复成功；390×844 headless Edge 下 mobile、六类等级分组、三聚焦槽位及 `scrollWidth-clientWidth <= 1` 断言通过。夹具最终输出 `cleanup complete`，其自有隔离 DATA_DIR/profile 按 finally 路径清理。
- S63 authority 隔离 API 回归覆盖六类等级的 1/10、非法、缺失、新建默认、主动清空为 1，三槽位完整/互异/published 门禁与撤回缺失原因，以及推导封面上传、预览、替换、解除引用和匿名草稿资源 404。
- 初期 in-app Browser 的对话框驱动步骤曾超时，该失败未计作通过；最终验收依据是可重复、命令自断言、会退出并清理的 Edge CDP 夹具。

## risks_limitations

- localStorage 是浏览器配置级持久存储，共享设备可能残留敏感作者输入；应使用受控管理员浏览器配置，并由管理员在确认不再需要恢复后显式丢弃。
- 冲突门禁依赖 S63 DTO 提供的修订/更新时间等稳定基线；若未来 DTO 改名，需同步更新 token 构造并保留安全默认。
- 删除封面按契约只解除引用，资源文件仍存在于私有受控上传区；物理清理不属于 S64。
- 浏览器夹具使用本机 Edge/Chrome CDP；缺少两者时会在 12 秒内给出明确错误，不会退化为静态假通过。

## protected_boundary_proof

- 浏览器与 API/回归服务全部使用系统 TEMP 下独立 `DATA_DIR` 和浏览器 profile；各夹具自身最终输出 `cleanup complete`。不额外虚构未直接枚举的全局进程状态。
- protected-path diff：空；`.env`、database、runtime-data、uploads 等受保护边界无修改。
- cached diff：空；未 staging/commit/push。
- 未修改 `server.js`、`lib/content.js`、`lib/validators.js`、迁移、公开前端、搜索页、Hero、版本、备案、部署、云、秘密或当前/生产数据库。
- 未执行 `git reset`、`git checkout`、破坏性仓库清理或真实上传删除。

## next_handoff

仅回传 `A00_ProjectDirector` 任务 `01a09b08-eace-7d90-82e8-00e71331b369` 独立复核 S64。A00 若 `rejected_with_rework`，由本会话在原 mayEdit 内返工；若 accepted，仅 A00 可按 Owner 持续授权精确暂存、commit/push。本会话不得启动 S65-S67。
