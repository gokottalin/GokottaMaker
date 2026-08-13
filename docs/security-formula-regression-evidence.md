# S50 安全与公式回归证据

## 结论

- 执行日期：2026-08-13
- 执行命令：`npm.cmd run test:security-formula-regression`
- 最终结果：`15 passed, 0 failed`
- 产品失败：无
- 当前或生产数据、服务、部署、密钥、版本、Git：未修改

## 可重复入口

`package.json` 注册：

```json
"test:security-formula-regression": "node scripts/run-security-formula-regression.js"
```

运行器串行执行完整矩阵。任一检查失败时继续收集其余结果，最终返回非零退出码；失败输出会对常见入口、口令、令牌、Cookie 和 Authorization 值脱敏。

## 结果矩阵

| 顺序 | 检查 | 结果 | 主要证据 |
| ---: | --- | :---: | --- |
| 1 | `test:public-surface` | PASS | 公开最小化、MD2File 范围、404、SEO、保留资产 |
| 2 | `test:private-cms-gateway` | PASS | 私有入口、轮换、404 等价、HTTPS、认证、CSRF、限速、审计、数据保留、密钥缺失扫描 |
| 3 | `test:formula-binding-authority` | PASS | 统一关系权威、来源保留、退役、幂等、自环与循环拒绝 |
| 4 | `test:formula-relationship-projection` | PASS | CMS 生命周期、公开过滤、聚焦范围、解绑、硬删除、API 脱敏 |
| 5 | `test:article-formula-authoring` | PASS | 文章公式绑定创建与更新 |
| 6 | `test:formula-reference-versioning` | PASS | 公式引用版本稳定性 |
| 7 | `test:formula-publication` | PASS | 发布生命周期与公开边界 |
| 8 | `test:linear-derivation-graph` | PASS | 线性推导图兼容 |
| 9 | `test:branching-derivation-graph` | PASS | 分支、合并、DAG 与循环保护 |
| 10 | `test:legacy-formula-migration` | PASS | 旧公式迁移、重复运行与保留边界 |
| 11 | `test:formula-binding-marker` | PASS | 每个绑定单一右上角角标、可访问名称与跳转 |
| 12 | `test:formula-marker-graph-ui` | PASS | 文章/公式节点、CMS 状态、公开无状态泄漏、无重复关系 UI |
| 13 | `test:formula-map-flow-layout` | PASS | 桌面、半宽、移动端真实浏览器像素与交互 |
| 14 | `test:markdown` | PASS | Markdown、公式与推导短码渲染 |
| 15 | `codex:contract` | PASS | `1089 passed, 0 warnings, 0 failures` |

## 浏览器证据

- 桌面：`1440 x 900`，浅色主题，图谱和 Cytoscape 边非空，复杂公式完整落在节点内。
- 半宽：`768 x 900`，浅色主题，真实视口截图像素有效，当前节点可见，节点、公式和边无越界或重叠。
- 移动端：`390 x 844`，深色主题，触控平移、双指缩放、节点拖动和跳转可操作。

## 隔离与边界

- 数据型专项测试自行创建并清理临时 `DATA_DIR`，未指向当前或生产数据库。
- 私有入口测试使用运行时随机测试值；证据、运行器和输出不保存真实入口或凭据。
- 未运行生产迁移，未启动或重启现有服务，未修改 Nginx、云端、版本或 Git 状态。
- 非 MD2File 工具与历史资产只验证保留和不公开，不执行物理删除。

## 发布门禁

- Windows 本机不具备生产 Nginx 环境，正式部署时仍须在服务器加载配置前执行 `sudo nginx -t`。
- 真实生产 `PRIVATE_CMS_PATH` 必须在服务器本地生成、保存和轮换，不进入仓库、公开响应或证据文件。
