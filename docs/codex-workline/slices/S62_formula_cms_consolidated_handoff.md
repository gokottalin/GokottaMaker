# S62 Formula CMS Consolidated Handoff

## status

`accepted_by_A00`

四个 Owner-confirmed 需求已在一个共享写集执行包内完成。未执行 Git 写入、生产/当前数据操作、云、部署、迁移、服务发布或破坏性清理。

## requirement_gate

- `REQ-20260913-001`: validate 通过；digest `sha256:a2e1ebe2fac0e7715dbc754d5b72453c195c0e9d2c4a432af37dab0439ff9745`
- `REQ-20260913-002`: validate 通过；digest `sha256:745162a50f9658fab2fcf643e4c9507bc32b4d7e1ddfc75c3f4c26d52be46144`
- `REQ-20260913-003`: validate 通过；digest `sha256:71bb4dd15fae68117433f26369451fc475bf964adef880d4cfe2164ac6907456`
- `REQ-20260913-004`: validate 通过；digest `sha256:fd9a7c4a2c0b24cacf4ac2dddccea95645dca9cd01dacac0536bd1e404132637`
- 四包均为 `dispatched`、`confirmation.confirmed=true`；唯一问题项已标记 `resolved`，无未决产品决定。

## scope_completed

1. 公式卡新建与编辑共用左预览、右编辑工作台；结论 LaTeX 与 Markdown 均实时渲染。`<=760px` 时改为预览在上、编辑在下。
2. Markdown 仅由右侧编辑区按滚动比例驱动左侧预览；修复数学自适应样式把预览滚动容器覆盖为 `overflow: visible` 的问题。
3. 保存按钮使用独立稳定层叠和完整矩形命中；表单增加保存中互斥门禁，一次提交只发起一次保存；必填失败和请求失败均进入统一 CMS 反馈。
4. 公式库卡片不再直接显示完整 Formula ID，改为逐卡“复制公式 ID”按钮；成功与失败反馈分离，函数内不调用保存、编辑、发布或修订接口。
5. Markdown 编辑区增加发布态依赖选择器：按发布态先过滤，再支持模块/分类浏览及名称、完整 Formula ID、模块/分类 OR 搜索；结果仅返回/显示分类、名称、完整 Formula ID、LaTeX 核心预览。
6. 候选点击在当前光标/选区原位写入 `{{formula-ref:完整formulaId}}` 并恢复编辑焦点；保留合法手工输入。
7. 当前公式与会形成间接循环的候选置灰并说明。新候选 API 不返回 Markdown、用途、草稿、归档或待发布修订身份。
8. CMS 创建/更新 API 在同一 SQLite 事务写入前，按当前权威图原子拒绝自引用、间接循环、目标不存在、未发布、归档和待发布修订目标；内部导入/迁移调用仍保留旧顺序兼容，不向 HTTP 请求开放绕过标志。

## files_created_or_changed

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `admin/admin-dark.css`
- `server.js`
- `lib/content.js`
- `scripts/test-formula-cms-consolidated.js`（新增，隔离 API/数据与静态 UI 合并验收）
- `scripts/run-formula-cms-consolidated-browser-fixture.js`（新增，仅用于隔离真实浏览器验收并清理）
- `scripts/test-linear-derivation-graph.js`（A00 复核：同步 S59 公式独立页断言）
- `scripts/test-legacy-formula-migration.js`（A00 复核：同步规范路由并修复 Windows 延迟清理）
- `docs/codex-workline/slices/S62_formula_cms_consolidated_handoff.md`（新增）
- `lib/validators.js` 未修改。

## decisions

- “短码”继续仅指 `formula-ref` 语法整体，引用键始终为完整 `formulaId`；没有新增 `shortId`、尾段解析、迁移或版本语义。
- 候选采用专用最小摘要 API，不复用会返回完整卡片正文的公式目录/详情响应。
- “已发布候选”要求 `publish_status=published`、未归档、当前修订等于已发布修订且存在发布记录；因此草稿、归档和待发布修订不会进入结果或计数。
- 发布态依赖门禁由 HTTP 创建/更新 API 显式开启；内容层的内部导入/迁移顺序保持兼容。

## checks

### 前置门禁

- 四次 `npm.cmd run --silent codex:requirement -- validate <path>`：4/4 通过。
- 四次 `npm.cmd run --silent codex:requirement -- digest <path>`：4/4 与 Owner 提供值精确一致。

### 聚焦和核心回归

- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`：通过。覆盖发布态先过滤、最小摘要、分类浏览、名称/ID/分类 OR 搜索、自引用、A→B→C 闭环、草稿、归档、待发布修订、无效目标、失败原子性和合法手工引用。
- `node --check admin/admin.js && node --check lib/content.js && node --check server.js`：通过。
- `git diff --check -- <本包文件>`：通过，仅有仓库既有 LF/CRLF 提示，无空白错误。
- `node scripts/run-formula-workline-regression.js`：`15 passed, 0 failed`；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `npm.cmd run codex:contract`：`1250 passed, 0 warnings, 0 failures`。
- 以下逐项通过：formula authoring drawer、publication workflow、branching DAG、binding authority、relationship projection、metadata management、identity automation、formula detail、adaptive formula height、CMS feedback/publish dock、private CMS gateway、reference versioning、article formula authoring、marker graph UI、map flow layout、Markdown renderer。

### A00 聚合复核

- `node scripts/run-security-formula-regression.js`：`15 passed, 0 failed`。
- A00 将线性推导页断言同步到 S59 后的 `formula.html` 契约，并将旧公式迁移重定向断言同步到规范 `/formula/<slug>` 路由。
- Windows 下服务器夹具退出后 SQLite 文件可能短暂保持占用；测试现在仅对该平台的 `EPERM` 安排父进程退出后的受限临时目录清理，其他错误仍立即失败。

## browser_API_evidence

真实浏览器连接至随机端口、独立 `DATA_DIR` 的本地测试实例：

- 1440×1000：结论和 Markdown 均为预览在左、编辑在右；两列实测同宽 629 px；页面无横向溢出。
- 390×844：两处均为预览在上、编辑在下；页面无横向溢出；日/夜与视口切换后 LaTeX/Markdown 内容和预览保留，可继续输入。
- 长 Markdown 含多标题、长段和块公式：右侧中点 `82.4/165` 时左侧为 `325.6/652`；右侧底部 `164.8/165` 时左侧为 `651.2/652`。
- 连续复制两卡剪贴板精确得到 `formula.browser.duty-cycle`、`formula.browser.input-voltage`；公式库可见文本不显示这些完整 ID。
- 选择器名称搜索仅返回“输入电压基准”；插入后文本为 `{{formula-ref:formula.browser.input-voltage}}`，焦点回到 Markdown 编辑框且光标位于短码后。
- 保存按钮 390 px 视口实测矩形 `133×44`；`elementFromPoint` 在左、中、右三点均命中 `#formulaSaveButton`，按钮外 5 px 命中相邻 `DIV`。中央创建后修订数 1，左侧点击后 2，右侧点击后 3，证明每次真实点击各产生且只产生一个修订。
- 空必填提交显示“请完整填写必填项后再保存公式卡”；手工填入未发布依赖后服务端拒绝，UI 显示准确原因，修订数保持 3。
- API 聚焦测试对每个非法目标比较失败前后 `markdown`、全部 `revisionId` 与依赖边，均完全不变。

## risks_limitations

- 选择器单页最多返回 50 项；超过时明确提示使用搜索缩小范围，不会静默暴露额外计数以外的正文或身份。
- 浏览器控制接口不能可靠构造 textarea 选区，因此真实浏览器验证覆盖光标插入与焦点恢复；选区替换由聚焦静态契约断言确认，代码直接使用 `selectionStart/selectionEnd` 原位替换。
- 剪贴板成功路径已做真实浏览器验证；失败路径由显式异常分支和聚焦静态无副作用断言覆盖，未人为改变浏览器权限。
- 旧 S50 两项基线已由 A00 在复核中修正，完整聚合器现为 15/15。

## protected_boundary_proof

- 所有 API/数据库验证均使用 `os.tmpdir()` 下前缀校验的隔离目录；聚焦测试 `finally` 清理。
- 浏览器夹具目录已验证删除，父/子 Node 进程均停止；复核时无 `larkix-formula-cms-*` 临时目录或夹具进程残留。
- `git diff --cached --name-only -- <本包文件>`：空；未 staging/commit/push。
- `git diff --name-only -- .env database runtime-data uploads`：空。
- 未访问或修改当前/生产数据库、真实数据、秘密、腾讯云、部署、迁移或服务发布状态。
- 未使用 `git reset`、`git checkout` 或破坏性仓库清理；工作树其他用户/会话修改保持原状。

## handoff

`A00_ProjectDirector` 已完成复核，复核命令为：

```powershell
node --experimental-sqlite scripts/test-formula-cms-consolidated.js
node scripts/run-formula-workline-regression.js
npm.cmd run codex:contract
```

A00 已确认专用候选接口最小披露、HTTP 门禁与内部迁移兼容边界、真实保存按钮矩形证据，并清零旧 S50 两项测试基线问题。生产、腾讯云、当前数据、迁移与版本发布仍未执行。

最初直接投递尝试因任务接口返回 `paginated_threads is not supported yet` 未能确认送达；当前 A00 会话已直接读取本交接并完成复核，未创建替代会话。
