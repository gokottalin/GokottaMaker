# 当前 Agent 总控交接入口

更新时间：2026-05-12 13:26
当前有效版本：V2.4.7+20260512-0838

本文件是后续 Agent 接入项目时的第一入口，用来说明当前项目状态、各 Agent 职责边界、协作顺序、已通过的验证项和仍需继续跟进的事项。若其他阶段性报告与本文件冲突，以本文件和最新代码为准。

## 当前结论

本轮已合并 Agent1、Agent2、Agent3、Agent4、Agent5、Agent6/Leo、Agent8 的阶段性成果，并继续收口 Agent20 测试回归问题。当前发布候选版本为 V2.4.7+20260512-0838。

- 访客端非法文章或项目 id 不再回退到第一条公开内容。
- 未上线项目只暴露目录概述，不暴露完整 Markdown。
- Markdown 代码高亮不再二次污染生成的 HTML。
- 首页“最新教程”查看全部入口改为全量分类入口。
- 首页轮播限制为 4 个固定槽位，排序只允许 0-3。
- 上传图片可通过 `/uploads/...` 稳定公开访问。
- GokottaElec 小程序中心版本同步到 V1.3。
- Agent6/Leo 新增 MD2File 小程序，提供 Markdown 到 DOCX 的转换能力。
- 静态资源版本检查通过，站点版本统一为 V2.4.7+20260512-0838。

## Agent 职责边界

| Agent | 名称 | 主责 | 不负责 |
| --- | --- | --- | --- |
| Agent1 | 运维与发布稳定性 | 云端服务、systemd、部署脚本、备份恢复、发布健康闭环、上传目录线上可访问性 | 页面视觉、CMS 交互、内容创作 |
| Agent2 | 后端与数据模型 | `server.js`、SQLite、API、公开内容过滤、轮播 0-3 槽位规则、上传与敏感文件保护 | CSS/UI、部署脚本 |
| Agent3 | 管理端 CMS 与内容工作流 | `admin/`、内容蓝图、编辑器、封面上传、轮播管理 UI、内容列表工作流 | 前台 Hero、底层数据库迁移、云端部署 |
| Agent4 | 访客端体验、视觉与前端架构 | 首页、分类页、详情页、项目页、`main.js`、响应式、日夜模式、Markdown 访客体验 | 认证、数据库迁移、部署 |
| Agent5 | 内容、SEO 与知识体系 | 内容分类、标签、RSS、sitemap、SEO 文案、文章和项目内容规范 | CMS 交互、后端接口实现 |
| Agent6 / Leo | 小程序功能接入 | 小程序中心、GokottaElec、MD2File、`tools/` 独立页面、`/api/elec/*`、`/api/md2file/convert`、`data/miniapps.js` | 文章/项目/CMS 数据模型 |
| Agent7 | 视觉品牌与样式设计 | 品牌规范、Logo 与主题方向、视觉 token、设计准则 | 直接发布与后端逻辑 |
| Agent8 | 市场部设计 | 商业模式、内容制作顺序、课程/资料包/服务规划、技术壁垒策略 | 代码实现 |
| Agent9 | 内容生成对接规范 | 内容生产格式、引用规范、图片需求、技术文章模板 | CMS 和后端实现 |
| Agent20 | 体验测试与问题上报 | 游客与管理员视角测试、复现、标注优先级、验收回归 | 修复执行 |

## 推荐协作顺序

当前需要多人协作时，仍按下面顺序推进：

1. Agent1 确认发布环境、备份和健康检查。
2. Agent2 确认数据模型、API、安全和上传链路。
3. Agent3 修改管理端 CMS 和内容工作流。
4. Agent4 修改访客端视觉、页面行为和响应式。
5. Agent5 做内容、SEO、RSS/sitemap 与知识结构验收。
6. Agent6 仅在小程序中心、GokottaElec、MD2File 或工具 API 相关变更时介入。
7. Agent20 最后做体验测试和回归报告。

## 小程序接口契约

### GokottaElec

- 页面：`tools/gokotta-elec.html`
- 配置：`data/miniapps.js` 中 `id: "gokotta-elec"`
- API：`/api/elec/samples`、`/api/elec/llm-handoff`、`/api/elec/build`
- 当前版本：V1.3

### MD2File

- 页面：`tools/md2doc.html`
- 配置：`data/miniapps.js` 中 `id: "md2file"`
- 主 API：`POST /api/md2file/convert`
- 兼容 API：`POST /api/md2doc/convert`
- 输入限制：Markdown JSON 请求体不超过 512 KB
- 当前输出：DOCX
- 当前版本：V0.2
- 后续扩展：PDF、HTML、更多模板样式

## 已通过验证

本轮本地复核已通过：

- `node --experimental-sqlite --check server.js`
- `node --check lib/content.js`
- `node --check lib/seo.js`
- `node --check lib/md2doc.js`
- `node --check main.js`
- `node --check admin/admin.js`
- `node --check tools/gokotta-elec.js`
- `node --check tools/md2doc.js`
- `node scripts/check-version.js`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-api.ps1 -Port 4340`
- `POST /api/md2file/convert` 烟测，返回 DOCX MIME 与可下载二进制

API 回归覆盖登录、CSRF、轮播排序越界拦截、上传、文章 CRUD、项目 CRUD、导出、sitemap、RSS 和退出登录。

## 发布前确认

当前没有阻断发布的本地问题。云端上线前仍需 Agent1 或管理员确认：

- `/healthz` 返回 `V2.4.7+20260512-0838`。
- `/uploads/...` 图片可公开访问。
- `sitemap.xml`、`rss.xml` 返回 200。
- 云端工作区无未处理 dirty 文件。
- 服务器执行 `sudo bash scripts/deploy-update.sh` 前先备份当前数据。

## 后续建议

- Agent3 与 Agent4 后续若继续调整 CMS 编辑区，需要避免再次改变 MD2File 和 GokottaElec 的独立工具页面契约。
- Agent6 后续新增小程序时，需要同步 `data/miniapps.js`、独立工具页面、必要 API、版本检查和小程序交接文档。
- Agent2 若调整静态白名单，必须保留 `/tools/`、`/assets/`、`/uploads/` 的访问规则，同时继续屏蔽 `lib/`、`database/`、`docs/`、`scripts/`。
