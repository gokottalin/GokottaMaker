# S63 Cross-Content Discovery Authority Handoff

## status

`rework_completed_pending_A00_review`

S63 已建立跨内容发现的后端权威层，并完成隔离迁移、API、并发计数、发布隐私、首页投影和受控上传回归。未实现 CMS/访客前端，未执行当前或生产数据迁移、Git 写入、部署、云、版本或外部服务操作。

A00 首轮裁决为 `rejected_with_rework`。本次仅在授权的 `server.js`、聚焦测试脚本和本 handoff 内修复两个 P1：公式图谱 continuation 不再重复计数，搜索分页参数改为正整数契约；未启动 S64。

## requirement_gate

- `REQ-20260913-006`：validate 通过；digest `sha256:bf852679bd934bfface88226a3af1d4fb71834e38460c7fddb5205704204314e`
- `REQ-20260913-007`：validate 通过；digest `sha256:9aa118a559dfcd6ca47c7a25be156933efc3dbf939c9fc74aac741042d86b108`
- `REQ-20260913-008`：validate 通过；digest `sha256:b436d1a51db1232308a438df83098644a1a5d4651b1e72c10af843681ee1fe58`
- `REQ-20260913-009`：validate 通过；digest `sha256:5cafea05254fe469c576688efa58c8c585968f2a1e4ac7faa60fb0095e5f6750`
- `REQ-20260913-010`：validate 通过；digest `sha256:3d394e711a47ca8898973908359cc27dcd8d35a341e28199c12e289e00407adb`
- 五包均为 `dispatched`、`confirmation.confirmed=true`、`confirmedBy=Owner`，`openQuestions=0`、`assumptions=0`。

## scope_completed

1. 新增顺序迁移 `029_cross_content_discovery_authority`：为文章、项目、推导节点、公式增加常用等级和浏览量，为项目增加阅读分钟；增加小程序发现元数据与首页三槽位表；迁移仅新增、可重复执行。
2. 六类授权 DTO 支持常用等级：`article/project/formula/derivation/focus/miniapp`。整数仅允许 1-10；新建默认 5；缺失或 `NULL` 读取/排序按 5；主动清空验证为 1。现有旧 schema 直接构造测试通过动态列兼容。
3. 五类公开详情读取内置原子浏览量增量；同访客/刷新不去重。公式大图谱只有首个不含 `cursor` 的详情请求计数，合法 continuation 返回后续图谱但不计数，空或非法 cursor 返回 400 且不计数。私有 CMS 路径、`preview=1`、`X-Larkix-Preview`、`X-Larkix-Automation`、失败和非公开读取不计数；未新增任意对象增量端点。
4. 新增 `GET /api/public/search`：固定 `article/project/derivation/formula/miniapp`，先取严格公开投影，再执行 NFKC 单字符包含匹配、分类、1 天/1 周/半年、文章/项目时长、稳定分页和四类排序。`page`/`pageSize` 必须为正整数，非法小数返回 400；计算、切片与响应元数据始终使用同一整数值。匿名结果不返回 `commonLevel`。
5. 公式发现只连接已发布修订和对应不可变发布记录；搜索可匹配并返回完整 `formulaId` 与 `{{formula-ref:完整formulaId}}`，返回结论 LaTeX 与最小卡片字段，不返回 Markdown。待发布修订的名称、时间与正文不会进入搜索或首页投影；现有公式详情 URL、详情 DTO 和版本契约保持兼容。
6. 推导链路封面继续使用 `knowledge_nodes.cover` 和既有受控图片上传验证。匿名 `/uploads/` 现在只允许已发布公开内容实际引用的封面或 Markdown 图片；草稿、未引用、已替换和已删除封面均为 404；私有 CMS 路径仍可预览。
7. 新增首页数据投影：最新已发布公式最多 8 张，按安全发布时刻倒序；聚焦文章 `large/small-1/small-2` 必须一次选满、互异且均已发布后事务保存。撤回或归档后公开槽位隐藏，管理 DTO 返回 `complete=false`、`missingSlots` 与原因，不自动替换。
8. `GET /api/content` 同步提供 `latestFormulas` 与 `focusedArticles`；另有最小 `GET /api/public/home-discovery`。聚焦内容未加入搜索类型。

## files_created_or_changed

- `migrations/029_cross_content_discovery_authority.js`（新增）
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `scripts/test-cross-content-discovery-migration.js`（新增）
- `scripts/test-cross-content-discovery-authority.js`（新增）
- `docs/codex-workline/slices/S63_cross_content_discovery_authority_handoff.md`（新增）

`lib/db.js`、`lib/uploads.js`、`admin/`、公开 HTML/JS/CSS、版本、部署和 Git 没有修改。

## schema_and_api_decisions

- 常用等级保存在各权威内容表；小程序使用 `discovery_aux_content`；首页聚焦等级属于稳定槽位记录，不复制文章等级。
- 浏览量保存在五类权威行，使用 `BEGIN IMMEDIATE` 包裹 `view_count = view_count + 1`，响应返回更新后的精确值。
- 公开搜索是单类型端点，不提供综合跨类型标签；所有 facet、total、空状态和分页都只从公开集合计算。
- 推导节点和项目若以 namespaced tags 表达 `module:*`/`category:*`，公开搜索投影优先使用该值；没有时只使用该类型现有字段。
- 公式公开搜索使用已发布修订的名称、模块、分类、标签和 LaTeX；卡片内部等级从不出现在匿名响应。
- 三槽位保存采用全量替换事务；任何缺项、重复或非公开文章使整个事务失败并保留旧配置。
- 上传文件未物理删除；删除封面指解除内容引用。解除后匿名直链立即 404，文件仍在私有 CMS 受控资源区，避免破坏性清理。

## checks

### 门禁与基线

- 五次 `npm.cmd run --silent codex:requirement -- validate <path>`：5/5 通过。
- 五次 `npm.cmd run --silent codex:requirement -- digest <path>`：5/5 与 Owner 值精确一致。
- 改动前 `node scripts/run-security-formula-regression.js`：15/15。
- 改动前 `npm.cmd run codex:contract`：`1261 passed, 0 warnings, 0 failures`。

### S63 聚焦验证

- `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js`：通过；覆盖旧库、空库、重复 `up`、migration runner 重启、默认 5、缺失/NULL 读取 5、主动清空 1、SQLite integrity。
- `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`：通过；覆盖五类型公开先过滤、单字符 OR 搜索、分类/模块/ID、时长、排序、分页、草稿/待修订隐私、24 并发不丢计数、内部/预览/自动化排除、六类等级、三槽位、最新 8 公式及封面上传预览/替换/删除直链边界。
- `node --check server.js`、`node --check lib/content.js`、`node --check lib/validators.js` 及两个新脚本：通过。
- `git diff --check -- <S63 paths>`：通过，仅有仓库既有 LF/CRLF 提示。

### A00 返工验证（2026-09-14）

- 先仅补断言后运行 `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js`：按预期失败，`pageSize=1.5` 实际 `200 !== 400`（测试第 235 行）。
- 只修整数分页后复跑同命令：分页断言通过，随后按预期失败，合法 continuation 后浏览量 `2 !== 1`（测试第 259 行）。
- 完成两个修复后复跑同命令：通过。隔离数据包含 245 个串联发布公式；首个无 cursor GET 后 `viewCount=1`，携带响应 continuation cursor 的成功 GET 后仍为 1，再次无 cursor GET 后为 2。3 篇公开文章上的 `pageSize=1.5&page=1/2` 均稳定返回 400。
- `node scripts/run-formula-workline-regression.js`：`15 passed, 0 failed`；digest 仍为 `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `npm.cmd run codex:contract`：`1261 passed, 0 warnings, 0 failures`。
- `node --check server.js`、`node --check scripts/test-cross-content-discovery-authority.js`：通过。
- `git diff --check -- server.js scripts/test-cross-content-discovery-authority.js docs/codex-workline/slices/S63_cross_content_discovery_authority_handoff.md`：通过，仅有既有 LF/CRLF 提示。

### 既有回归

- `node scripts/run-formula-workline-regression.js`：`15 passed, 0 failed`；digest `sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。
- `node scripts/run-security-formula-regression.js`：`15 passed, 0 failed`。
- `node --experimental-sqlite scripts/test-formula-cms-consolidated.js`：通过。
- `npm.cmd run codex:contract`：`1261 passed, 0 warnings, 0 failures`。

## evidence

- 24 个并发公开文章详情请求最终精确到 24；自动化标记、预览参数和私有 CMS 同一路径读取后仍为 24。
- 搜索响应全文断言不含 `commonLevel/common_level`、草稿名称或待发布修订名称；公式 ID 搜索仅返回已发布快照名称及完整 Formula ID/formula-ref。
- 未引用 `replacement.png`：公开 404、私有 CMS 200；绑定已发布推导后公开 200；替换旧封面后旧 URL 404；删除绑定后新 URL 404；草稿封面始终 404。
- 聚焦三槽位初始完整；将 `small-1` 文章撤回后公开仅隐藏该槽，CMS 返回 `missingSlots=["small-1"]`，未自动补位。

## risks_limitations

- 本包只交付后端权威层。后续 CMS/公开前端必须调用这些 API；目前静态小程序页面和详情页尚未接入新的搜索卡片、计数或槽位 UI。
- 浏览量口径绑定成功详情 API GET。公式 continuation 由 `cursor` 查询参数明确识别并排除计数；其他五类详情仍按每次成功公开打开或刷新计数。
- 自动化排除采用显式测试请求标记；该标记只允许跳过计数，不授予读取、写入或非公开内容权限。
- 删除封面是安全解除引用而非磁盘删除；物理资源清理仍需单独、可审计且明确授权的维护包。

## protected_boundary_proof

- 所有数据库/API 验证均使用系统临时目录中 `larkix-discovery-*` 前缀的隔离 `DATA_DIR`；测试 `finally` 校验路径前缀后清理。
- 最终临时目录枚举无 `larkix-discovery-*` 残留。
- `git diff --name-only -- .env database runtime-data uploads`：空。
- `git diff --cached --name-only -- <S63 paths>`：空；未 staging/commit/push。
- 未执行当前/生产 SQLite、真实数据迁移、秘密、腾讯云、外部服务、部署、版本变更、破坏性清理、`git reset` 或 `git checkout`。
- 工作树既有 S62 与其他用户修改保留；S63 仅在委托 mayEdit 路径追加补丁。

## next_handoff

仅回传 `A00_ProjectDirector` 独立复核 S63。建议复核命令：

```powershell
node --experimental-sqlite scripts/test-cross-content-discovery-migration.js
node --experimental-sqlite scripts/test-cross-content-discovery-authority.js
node scripts/run-security-formula-regression.js
node scripts/run-formula-workline-regression.js
npm.cmd run codex:contract
```

A00 未接受时由本会话在 S63 mayEdit 内返工；接受后本会话仍不得创建或启动 S64。

本次返工完成后直接回传复核派发会话 `01a09b08-eace-7d90-82e8-00e71331b369`。若任务投递接口不可用，将在当前会话明确报告，由派发会话建立 A00 复核。
