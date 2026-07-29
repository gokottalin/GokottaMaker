# S22 文章封面坐标交接

- 执行 Agent：`A29_PostCoverCoordinates`
- 验收 Agent：`A00_ProjectDirector`
- 工作区：`E:/Project/2607-LarkixWeb`
- 需求：`REQ-20260728-001`
- 状态：`accepted_by_A00`
- next_handoff：`A30_PostReadingMinutes + A31_InlineMathLayout`

## 1. 交付结论

S22 已完成并通过 A00 最终验收。最小完整纵向链路包括 Migration 024、validator、文章 DTO、保存/修订/恢复、
CMS 草稿与 payload、可逆 DOM 取景器、原图上传和公共共享回放。代码中已移除
`canvas.toDataURL` 裁切上传，不生成 `*-cover.jpg`，不覆盖或删除原图。

确定性测试、隔离 API、相关公式/Markdown 回归、合同、whitespace 与真实浏览器验收
全部通过。

## 2. Schema 与坐标

`posts` 新增六个 nullable 字段：

- `cover_crop_x`
- `cover_crop_y`
- `cover_crop_width`
- `cover_crop_height`
- `cover_crop_source_width`
- `cover_crop_source_height`

Migration INSERT/UPDATE 触发器与 validator 都要求六字段 all-or-none、归一化矩形不越界、
原图尺寸为 `1-100000` 整数，并校验
`(width*sourceWidth)/(height*sourceHeight)=16/9`。容差为
`max(1 px, expectedWidth*0.001)`。旧文章输出 `coverCrop: null`。

`lib/content.js` 已覆盖 `allPosts`、`postById`、`savePost`、
`createRevision/listRevisions`、`upsertPostSnapshot/restoreRevision`。重置只清空坐标，
原 `cover` URL 不变。

## 3. CMS

- 完整原图显示在稳定舞台；框外灰度并 `blur(5px)`，框内为同一原图的清晰彩色副本。
- 框体可拖动，四角以对角为锚点等比缩放，全部限制在原图边界内。
- Pointer Events 覆盖 mouse/pen/touch；框体与四角均支持键盘；`Escape` 取消并恢复焦点。
- 新文件应用时只上传原始 data URL 一次并保存坐标；已有图片重开调整不上传。
- `currentSnapshot`、`applySnapshotToForm`、`applyItemToForm`、`buildPayload` 已携带
  `coverCrop`；本地草稿、取消、重开和重置可逆。
- 项目和推导节点不新增 crop schema；其文件选择只上传原图。

## 4. 公共回放

`data/media.js` 提供唯一 `normalizeCrop/cropLayout/hydrateCrops` 实现，并保留优化
`<picture>` 的 WebP `srcset`。首页文章卡、课程/聚焦、首页 hero、分类列表/推荐入口和
文章 hero 均传入 `coverCrop`。

回放始终按原图宽高等比缩放。16:9 容器显示完整保存区域；非 16:9 聚焦容器保持原尺寸，
仅在保存区域内部继续 cover，因此没有拉伸，也没有把所有聚焦卡强制改成 16:9。

## 5. 原图字节与 API 证据

隔离 `DATA_DIR` 上传横、竖、方、超宽四张 PNG，源文件与上传文件 SHA-256 全部相等：

- 横图：`C331A996DB11B01AE26398E06A4F4083C7D72BB37D1255981FCA5A48E89E8CE9`
- 竖图：`81902016E2E6F60C855F5BB1F1EBDFB133BFE6CBE3328F2C2810E9167011CBFD`
- 方图：`562C5CB6FA5CDFC823B5D2585F352A7020D6DB640790120B5E841786CA5E9DE3`
- 超宽图：`71F37D1FB5CF57CE98F2F93A705BAD473B82504F04D0E215B0AA03B284DCA889`

同一文章两次坐标保存前后，上传目录文件数均为 `4`。API 修订恢复得到原坐标
`{x:0,y:0.1,width:1,height:0.5625,sourceWidth:900,sourceHeight:900}`，原 URL
保持 `/uploads/2026-07-29-b26b026d6b9d709d.png`。错误比例 payload 返回 HTTP 400。

## 6. 验证结果

通过：

- 9 个变更 JavaScript 文件 `node --check`：`9/9 passed`
- `npm.cmd run test:post-cover-coordinates`
- `npm.cmd run test:article-formula-authoring`
- `npm.cmd run test:formula-reference-versioning`
- `npm.cmd run test:formula-publication`
- `npm.cmd run test:branching-derivation-graph`
- `npm.cmd run test:markdown`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1 -Port 5531`
- `npm.cmd run codex:contract`：`680 passed`、`0 warnings`、`0 failures`
- `git diff --check`：无 whitespace error，仅有工作树既有 LF/CRLF 提示

`verify-api` 结果包括 `ok=True`、`csrfBlocked=True`、
`carouselOrderBlocked=True`、`publicKnowledgeNodes=1`。

浏览器已完成：

- 在隔离 5529 服务登录 CMS，刷新后读取新增文章；已检查的页面阶段无 console
  error/warn。
- API 上传四类图片、保存/调整/恢复坐标和错误 payload 检查均在该隔离环境完成。
- A00 在隔离 5541 服务中完成框体 pointer 拖动、左上角 pointer 缩放和键盘缩放；
  保存后重新进入编辑器，坐标、原图 URL 和“调整取景 / 恢复完整原图”操作均正确回读。
- `Escape` 取消不写入坐标；重新打开仍显示已保存的
  `起点 11%、17%，尺寸 89% × 75%` 和 `684 × 385 px / 16:9`。
- A00 发现并修复四角手柄被 selection overflow 裁切的问题；四个 22 px 圆形手柄改为
  完整位于边框内侧。
- A00 发现并修复 NW/NE/SW 角键盘方向映射问题；方向键现在按实际角点方向移动，
  `Shift` 步长缩放后仍保持 16:9 且不越界。
- 640×800 与 360×800 截图均确认弹窗无横向溢出、按钮不重叠、四角可见，框内彩色清晰、
  框外灰度模糊。
- 发布隔离验收文章后，首页数据、电子基础分类页和文章详情 hero 使用同一归一化坐标；
  图片无拉伸，页面控制台 `error/warn = []`。
- A00 复测：`node --check admin/admin.js`、`npm.cmd run test:post-cover-coordinates`、
  `npm.cmd run codex:contract`（`680 passed / 0 warnings / 0 failures`）及
  `git diff --check` 全部通过。

## 7. 修改文件

- `migrations/024_post_cover_coordinates.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/media.js`
- `styles.css`
- `styles/25-cover-crop.css`
- `main.js`
- `category-page.js`
- `post.js`
- `scripts/test-post-cover-coordinates.js`
- `package.json`
- `docs/post-cover-coordinates.md`
- `docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md`

## 8. 风险与保护边界

1. 公共非 16:9 容器会在已保存 16:9 区域内部继续 cover，这是保持原容器形状且不失真的
   明确策略。
2. 未修改 `styles/20-content.css`；其现有脏改动保持原样。
3. 未接触 current/production 数据、物理旧数据清理、云端、部署、恢复/回滚或 Git
   stage/commit/push。
4. 5529/5531/5541 隔离服务均已停止；5541 数据目录仅位于系统临时目录，不属于项目
   current/production 数据。

`next_handoff=A30_PostReadingMinutes+A31_InlineMathLayout`
