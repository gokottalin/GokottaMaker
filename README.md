# LarkixMaker

LarkixMaker 是一个面向嵌入式电子、电力电子推导、STM32/ESP32 实践和独立硬件项目的技术内容网站。项目采用本地 Node.js HTTP 服务和 SQLite 内容库，提供访客端文章/项目展示、管理端 CMS、Markdown 与公式渲染、计算书生成链、公式卡片库、推导网络、封面媒体管理和部署门禁脚本。

当前仓库版本为 `V2.5.4`（`package.json` 为 `2.5.4`，站点构建标识为 `V2.5.4+20260814-0001`）。

## 当前版本更新

`V2.5.4` 的重点是把 LarkixMaker 从普通技术博客推进到“文章 + 公式库 + 推导网络 + 工程计算书”的一体化内容工作台：

- 公式卡片支持草稿、已发布和归档三态；LaTeX 与 Markdown 推导正文采用不可变修订，访客端只读取明确发布过的版本。
- 文章编辑器加入常驻公式抽屉，可以从公式库插入指定修订，也可以从选中的正文公式创建新的草稿公式卡。
- 公式更新或归档后，绑定它的文章会生成逐篇版本决策，作者可选择保留旧修订、采用当前修订或另建公式卡。
- 推导正文支持 `{{formula-ref:<formulaId>}}` 依赖短码，服务端校验无悬空引用、无重复依赖和无环图；访客端与管理端均可展示公式推导关系。
- 计算书链路以 JSON 母版作为唯一事实来源，可生成 Mathcad 15 工作表和 Larkix L1/L2/L3 内容，并保留公式、来源、结果和跳转映射的一致性。
- 旧公式迁移提供隔离验证和快照保护；当前/生产数据物理清理仍需单独授权和备份恢复证据。
- 文章封面支持保存 16:9 裁切坐标，访客端在不同卡片尺寸中按原图比例回放，不拉伸、不强制所有卡片改成 16:9。
- 文章可保存建议阅读分钟数；无值时访客端不输出空占位。
- 行内复杂公式、分数、根式、积分和多层上下标使用共享数学排版结构，避免正文横向溢出。
- 访客端、管理端和工具页补齐全站深色主题，覆盖内容表面、公式状态、禁用控件、提示信息和弹窗。
- 批量回归入口覆盖 Markdown、计算书、公式库、文章公式、推导图、聚焦媒体、深色主题、API/CMS 边界和发布门禁。

## 功能概览

- 访客端：`index.html`、`post.html`、`category.html`、`projects.html`、`project.html`、`derive.html`、`miniapps.html`。
- 管理端：文章、项目、知识/公式内容、轮播槽位、封面裁切、聚焦模式、导入导出和健康检查。
- 内容运行时：SQLite 数据库、上传目录、Markdown 渲染器、SEO/sitemap、审计日志和认证模块。
- 公式与推导：公式目录、文章绑定、修订决策、分支推导图、公开公式卡页和 Cytoscape 图谱渲染。
- 工程计算书：`content/calculation-books/` JSON 母版、`tools/calculation-book/` 校验/生成工具、Mathcad 与 Larkix 输出。
- 小工具：MD2File、LarkixElec、GokottaElec 以及 `gokotta-elec-core/` 的电路 CNL/渲染工具链。
- 运维门禁：版本一致性检查、隔离数据测试、备份/恢复/回滚脚本和部署健康检查。

## 本地运行

需要 Node.js `>=22.5.0`，并启用 Node 内置 SQLite：

```powershell
npm install
npm run start
```

等价命令：

```powershell
node --experimental-sqlite server.js
```

开发时可使用监听模式：

```powershell
npm run dev
```

常用入口：

```text
http://localhost:4173
http://localhost:4173/admin/
http://localhost:4173/derive.html
http://localhost:4173/miniapps.html
http://localhost:4173/healthz
```

## 管理端账号

默认管理员账号由环境变量控制：

```text
ADMIN_USERNAME=Larkix
ADMIN_PASSWORD=change-this-before-public-deploy
```

数据库中保存密码哈希和盐，不保存明文密码。首次启动会创建管理员账号；如果账号已存在，默认不会覆盖密码。需要强制重置时，临时设置：

```text
ADMIN_RESET_PASSWORD_ON_START=true
```

重置成功后应改回 `false`。

## 数据目录

生产环境建议设置：

```text
DATA_DIR=/var/data
```

服务会把 SQLite 和上传图片保存到：

```text
/var/data/database/gokottamaker.sqlite
/var/data/uploads/
```

这两个目录必须放在持久磁盘中，并定期备份。测试、预览和迁移验证应使用隔离 `DATA_DIR`，不要直接写当前数据或生产数据。

## 常用验证

版本一致性：

```powershell
npm run check:version
```

核心回归：

```powershell
npm run test:markdown
npm run test:calculation-book
npm run test:formula-catalog
npm run test:article-formula-authoring
npm run test:formula-publication
npm run test:branching-derivation-graph
npm run test:legacy-formula-migration
npm run test:post-cover-coordinates
npm run test:post-reading-minutes
npm run test:focus-mode
npm run test:carousel-focus-buffer
```

当前版本的批量回归入口：

```powershell
node scripts/run-batch-regression-evidence.js
```

治理与资源边界检查：

```powershell
npm run codex:contract
npm run codex:resources
npm run codex:check
```

## 项目结构

```text
admin/                    管理端页面、CMS 交互和管理端主题
assets/                   品牌、封面、Hero、设计稿和第三方图谱库
content/                  Markdown 内容与计算书 JSON 母版
data/                     前端数据、Markdown 渲染器、站点元信息
docs/                     架构、部署、回归和功能契约文档
gokotta-elec-core/        电路 CNL、SVG 渲染和 LLM 交接工具链
lib/                      服务端内容、认证、数据库、上传、SEO、校验模块
migrations/               SQLite schema 迁移
scripts/                  测试、治理、备份、恢复、部署和回滚脚本
styles/                   访客端分层 CSS
tools/                    MD2File、电子工具和计算书生成器
server.js                 Node HTTP 服务入口
```

## 部署与运维

项目已包含：

- `package.json`：Node 启动脚本和版本要求。
- `render.yaml`：Render Blueprint 示例，包含持久磁盘配置。
- `Dockerfile`：VPS、Docker 平台或容器平台部署入口。
- `.env.example`：环境变量模板。
- `scripts/deploy-update.sh`：服务器更新入口。
- `scripts/backup-linux.sh`、`scripts/restore-linux.sh`、`scripts/rollback.sh`：备份、恢复和回滚入口。

生产服务提供基础健康检查：

```text
http://服务器地址:4173/healthz
```

服务器更新推荐使用：

```bash
cd /opt/LarkixMaker
bash scripts/deploy-update.sh
```

如果需要重新安装 systemd 服务，先准备环境文件：

```bash
sudo cp scripts/gokottamaker.env.example /etc/gokottamaker.env
sudo nano /etc/gokottamaker.env
sudo cp scripts/gokottamaker.service /etc/systemd/system/gokottamaker.service
sudo systemctl daemon-reload
sudo systemctl restart gokottamaker
```

详细步骤见 [docs/deployment.md](docs/deployment.md)。生产发布、回滚和数据清理必须先满足最新备份、恢复演练、版本一致性和健康检查门禁。
