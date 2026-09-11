# S60 公式工作线回归证据

## 结论

2026-09-11 Wave 4B 在系统临时目录中的隔离 `DATA_DIR` 重新执行统一 runner。A70/S60A 修复并经 A00 验收后，15 项检查全部通过，因此 S60 状态更新为 `completed`，可回传 A00 执行 final acceptance。QA 未修改产品文件。

首轮阻断项 `npm.cmd run test:formula-relationship-projection` 已在完整矩阵中恢复通过：公开公式 API 不再出现先前的 HTTP 500 回归。为防止局部复跑掩盖连带问题，本轮重新执行了全部 15 项，而非只执行先前失败项。

## 可重复命令

```powershell
node scripts/run-formula-workline-regression.js
```

本次摘要：`S60 summary: 15 passed, 0 failed`。

本次结果摘要指纹：`sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`。该指纹只覆盖检查 ID 与 pass/fail 结果，不包含数据、凭据或机器路径。

## 需求—切片—检查矩阵

| 需求 | 已验收切片 | 统一检查 | 结果 | 证据范围 |
| --- | --- | --- | --- | --- |
| `REQ-20260824-001` | S56 | `map-contract` | PASS | 唯一 Schema、六阶分支/汇入 DAG、循环/自引用/重复边/缺失节点/公开泄漏负例、继续游标 |
| `REQ-20260824-001` | S56/S59 | `branching-dag` | PASS | 运行时 DAG、公开/CMS 投影、相对层级与边方向 |
| `REQ-20260824-001` | S56/S58/S59 | `relationship-projection` | PASS | 公开公式 API、关系投影与公开字段净化恢复通过 |
| `REQ-20260911-001` | S58 | `metadata-lifecycle` | PASS | 两级分类、禁止 L1/L2/L3、修订原因、影响预览、重命名、合并、迁移、归档、恢复、受保护永久删除、事务完整性 |
| `REQ-20260911-001` | S58 | `binding-authority` | PASS | 公式绑定权威与生命周期一致性 |
| `REQ-20260911-002` | S57 | `responsive-high-math` | PASS | 8 类普通/复杂高公式，文章/CMS/MD2File，390/768/1366/1920，明暗模式，共 24 个浏览器组合；无纵向滚动且容器包住数学边界 |
| `REQ-20260911-002` | S57 | `math-rendering`、`inline-math` | PASS | 共享渲染与行内/块级隔离 |
| `REQ-20260911-002` | S57/S59 | `graph-layout` | PASS | 深图、复杂公式节点、桌面/半宽/移动布局、重测、连线、缩放、拖动、明暗模式、ARIA 与键盘契约 |
| `REQ-20260911-003` | S59 | `detail-page` | PASS | 规范路由、稳定 slug、245 节点截断续载、草稿/发布/归档公开边界、签名游标、旧链接 308 静态契约 |
| `REQ-20260911-003` | S59 | `graph-ui` | PASS | 公式角标、公式节点/文章节点导航与无障碍名称 |
| 四项需求安全边界 | S56–S59 | `public-surface`、`private-cms` | PASS | 匿名 404 最小化、CMS 隐藏、认证与 CSRF；无公开管理入口泄漏 |
| 共享兼容与治理 | S56–S60 | `markdown`、`contract` | PASS | Markdown/DOCX 兼容；项目契约 0 failure |

## 响应式与显示矩阵

- 宽度：390、768、1366、1920。
- 主题：light、dark。
- 高公式表面：文章、CMS、MD2File。
- 固定数学样例：普通公式、分子根号分式、整体根号、嵌套分式、积分、矩阵、cases、boxed。
- 图谱专项另覆盖分支、汇入、深路径、复杂公式节点、pan、zoom、drag、click、键盘焦点与 ARIA 契约。

## 受保护边界

- runner 只把 `DATA_DIR` 指向 `os.tmpdir()` 下随机创建的 `larkix-s60-*` 目录，并在结束时校验路径后删除。
- 未读取或修改当前/生产数据库；未创建 migration；未执行部署、云/服务/密钥写入。
- 未执行 Git staging、commit、push、restore 或 rollback。
- S60 只新增 runner、本证据和交接；没有产品修复。

## 首轮阻断闭环

首轮 `relationship-projection` 曾稳定出现 `500 !== 200`，A69 如实阻断验收并回传 A00。A70/S60A 修复经 A00 验收后，本轮通过以下完整回归闭环：

```powershell
node scripts/run-formula-workline-regression.js
```

结果为 15 passed / 0 failed。先前 HTTP 500 与 Windows libuv closing assertion 均未复现；S60 不再保留未解决产品阻断，可进入 A00 final acceptance。
