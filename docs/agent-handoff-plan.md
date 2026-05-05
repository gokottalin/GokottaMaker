# GokottaMaker Agent Handoff Plan

更新时间：2026-05-05 14:08  
当前版本：V1.5.0+20260504-1655  
规划基线提交：9263f08 Force HTTP1 for deploy git operations  
线上地址：http://81.71.156.122:4173/  
健康检查：http://81.71.156.122:4173/healthz

## 1. 项目定位

GokottaMaker 是一个面向嵌入式、模拟电子、STM32、ESP32 与独立开源硬件项目的个人技术网站。

当前形态：

- Node.js 原生 HTTP 服务
- SQLite 内容数据库
- 管理端登录、文章/项目增删改、封面上传、Markdown 导入
- 访客端首页、分类页、文章详情、项目详情
- 腾讯云 Ubuntu 22.04 直部署
- systemd 管理服务
- GitHub 托管代码

项目当前最重要的方向不是继续堆单点效果，而是把“内容生产、上线运维、可扩展架构、视觉体系”拆成清晰边界，让多个 agent 可以并行推进。

## 2. 当前运行信息

### 本地

项目目录：

```text
D:\Project\26-WEB\GokottaMaker
```

启动：

```powershell
node --experimental-sqlite server.js
```

默认访问：

```text
http://localhost:4173/
http://localhost:4173/admin/
```

### 服务器

服务器：

```text
腾讯云 Ubuntu 22.04
IPv4: 81.71.156.122
IPv6: 2402:4e00:c013:8100:5ade:a904:9826:0
```

部署目录：

```text
/opt/GokottaMaker
```

运行数据：

```text
/srv/gokottamaker-data/database/
/srv/gokottamaker-data/uploads/
```

备份目录：

```text
/srv/gokottamaker-backups
```

systemd 服务：

```text
gokottamaker.service
```

生产环境配置：

```text
/etc/gokottamaker.env
```

后续更新：

```bash
cd /opt/GokottaMaker
bash scripts/deploy-update.sh
```

## 3. 关键文件地图

### 后端与数据

| 文件 | 作用 |
|---|---|
| `server.js` | Node 服务入口，包含 SQLite、认证、API、上传、SEO、静态文件、健康检查 |
| `data/posts.js` | 静态示例文章种子 |
| `data/seed.js` | 静态示例项目种子 |
| `data/content-store.js` | 前台内容读取封装，优先读取服务端注入内容 |
| `data/markdown-renderer.js` | 轻量 Markdown 渲染器 |

### 访客端

| 文件 | 作用 |
|---|---|
| `index.html` | 首页 |
| `main.js` | 首页文章/项目渲染、搜索、Hero 轮播和 Hero SVG 流线 |
| `category.html` | 分类列表页 |
| `projects.html` | 项目列表页 |
| `post.html` | 文章详情页 |
| `project.html` | 项目详情页 |
| `post.js` | 文章/项目详情 Markdown 渲染 |
| `styles.css` | 全站主样式，包括 Hero、卡片、Markdown、响应式、打印样式 |

### 管理端

| 文件 | 作用 |
|---|---|
| `admin/index.html` | 管理端页面 |
| `admin/admin.js` | 登录、内容 CRUD、封面上传、导出、图片库 |
| `admin/admin.css` | 管理端样式 |

### 运维

| 文件 | 作用 |
|---|---|
| `scripts/deploy-update.sh` | 服务器一键更新，强制 Git HTTP/1.1 |
| `scripts/install-systemd.sh` | 安装 systemd 服务和环境文件 |
| `scripts/gokottamaker.service` | systemd 服务模板 |
| `scripts/gokottamaker.env.example` | 生产环境变量模板 |
| `scripts/backup-linux.sh` | 备份 SQLite 和上传目录 |
| `scripts/restore-linux.sh` | 恢复备份 |
| `deploy/nginx-gokottamaker.conf` | Nginx 反代模板 |
| `docs/deployment.md` | 部署说明 |
| `docs/architecture.md` | 架构说明 |

### 静态资产

| 目录 | 作用 |
|---|---|
| `assets/logo/` | Logo 与图标 |
| `assets/hero/` | 首页 Hero 图片 |
| `assets/covers/` | 示例文章/项目封面 |
| `content/posts/` | 示例 Markdown 文章 |

## 4. 已实现能力

### 访客端

- 首页 Hero 轮播，10 秒切换
- 4 个方向内容：模拟电子、STM32、ESP32、开源项目
- 文章列表、项目列表
- 文章详情 Markdown 渲染
- 文章目录导航
- 代码块高亮样式
- 封面图显示
- 移动端阅读优化
- 404 页面
- RSS：`/rss.xml`
- Sitemap：`/sitemap.xml`
- Robots：`/robots.txt`
- Manifest：`/site.webmanifest`

### 管理端

- 服务端 Session 登录
- Cookie 记住登录状态
- 文章/项目新增、编辑、删除、恢复、永久删除
- 发布状态：草稿/已发布
- 项目状态：规划中/开发中/已上线
- 规划中项目访客不可进入详情
- 封面上传
- 图片库选择封面
- Markdown 文件导入
- Markdown 预览
- 标签字段
- 内容导出 JSON

### 后端

- SQLite 数据库存储
- 密码 scrypt 哈希和盐
- 登录失败限流
- 上传图片类型和大小限制
- `/healthz` 基础健康检查
- `/api/admin/health` 管理员详细健康检查
- 静态文件响应头
- CSS/JS 版本参数缓存修复

### 运维

- 腾讯云 Ubuntu Node 直部署
- systemd 服务
- `/etc/gokottamaker.env` 环境文件
- 一键更新脚本
- 数据备份脚本
- GitHub 托管

## 5. 当前主要风险

1. `server.js` 职责过多
   - 认证、数据库、API、SEO、静态文件、上传、健康检查都在一个文件中。
   - 后续建议拆分模块。

2. 管理端缺少 CSRF 防护
   - 当前写接口依赖 Cookie Session。
   - 需要 CSRF Token 或 SameSite + 自定义 header 双保险。

3. 缺少操作审计
   - 删除、恢复、上传、导出没有记录。
   - 后续排查内容变更时不方便。

4. 图片优化不足
   - Hero 和封面图片较大。
   - 需要上传后自动压缩、生成 WebP、多尺寸。

5. Markdown 渲染能力较轻
   - 当前偏安全和简单。
   - 技术文章后续需要表格、警告块、图片尺寸、数学公式。

6. 内容源存在双轨
   - 静态种子文件和 SQLite 数据库同时存在。
   - 需要明确数据库为生产事实来源，静态文件只做初始种子。

## 6. Agent 分工总览

建议拆成 5 个 agent。每个 agent 都应遵守：

- 不回滚其他 agent 的改动
- 只修改自己负责的文件范围
- 输出最终变更摘要、验证命令、风险和后续建议
- 涉及数据库或运行数据时，先说明迁移策略
- 所有代码修改必须通过本地语法检查或服务级验证

## 7. Agent 1：运维与发布稳定性

### 目标

让线上部署、更新、回滚、健康检查、备份恢复变得稳定可诊断。

### 责任范围

主要负责：

```text
server.js 中 health/deployment 相关逻辑
scripts/
deploy/
docs/deployment.md
README.md 的部署章节
.env.example
```

不负责：

- 页面视觉设计
- 管理端交互细节
- Markdown 渲染功能
- 文章内容创作

### 输入

- 当前服务器信息：
  - `/opt/GokottaMaker`
  - `/srv/gokottamaker-data`
  - `/etc/gokottamaker.env`
  - systemd 服务名 `gokottamaker`
- 当前健康接口：
  - `/healthz`
  - `/api/admin/health`
- 当前更新脚本：
  - `scripts/deploy-update.sh`

### 输出

- 更稳的部署脚本
- 回滚脚本
- 健康检查增强
- 备份校验机制
- 更新后的部署文档
- 验证日志示例

### 推荐下一步任务

1. 增加 `scripts/rollback.sh`
2. 增加备份完整性校验
3. 增加 `/healthz` 中数据库文件大小、上传目录大小
4. 增加部署前后版本对比输出

### 验证接口

```bash
curl http://127.0.0.1:4173/healthz
bash scripts/deploy-update.sh
sudo systemctl status gokottamaker --no-pager
```

## 8. Agent 2：后端与数据模型

### 目标

把 `server.js` 从单文件服务演进为可维护的后端结构，并强化数据库模型。

### 责任范围

主要负责：

```text
server.js
未来可新增 lib/
未来可新增 migrations/
data/seed.js
data/posts.js 的种子逻辑
```

不负责：

- CSS 视觉
- 管理端 UI 布局
- 部署脚本

### 输入

- 现有 SQLite 表：
  - `admin_users`
  - `sessions`
  - `posts`
  - `projects`
- 现有 API：
  - `/api/content`
  - `/api/content.js`
  - `/api/session`
  - `/api/login`
  - `/api/logout`
  - `/api/admin/content`
  - `/api/admin/export`
  - `/api/admin/health`
  - `/api/posts`
  - `/api/projects`
  - `/api/uploads`

### 输出

- 模块化后端结构
- 数据库迁移策略
- 更清晰的 API 分层
- 标签、分类、项目资料等正式模型
- API 文档

### 推荐下一步任务

1. 拆分 `server.js`
   - `lib/db.js`
   - `lib/auth.js`
   - `lib/content.js`
   - `lib/uploads.js`
   - `lib/seo.js`
   - `lib/static.js`
2. 增加 CSRF Token
3. 增加操作审计表 `audit_logs`
4. 把 tags 从文本字段升级为正式表
5. 给 posts/projects 增加 `created_at`、`updated_at`、`published_at`

### 验证接口

```bash
node --experimental-sqlite --check server.js
curl http://127.0.0.1:4173/api/content
curl http://127.0.0.1:4173/healthz
```

## 9. Agent 3：管理端 CMS 与内容工作流

### 目标

让管理员真正高效地维护文章和项目，减少误操作和内容丢失。

### 责任范围

主要负责：

```text
admin/index.html
admin/admin.js
admin/admin.css
server.js 中管理端 API 的调用契约
```

不负责：

- 前台 Hero 视觉
- systemd 部署
- 后端底层数据库迁移，除非与 CMS 功能强相关

### 输入

- 管理员登录 Cookie Session
- `/api/admin/content`
- `/api/posts`
- `/api/projects`
- `/api/uploads`
- `/api/admin/export`
- `/api/admin/health`

### 输出

- 更好用的管理端
- 内容保存状态提示
- 自动草稿
- 离开页面提醒
- 批量操作
- 标签管理界面
- 图片库管理

### 推荐下一步任务

1. 保存前离开提醒
2. 自动草稿到 localStorage，但必须清楚标记“草稿未入库”
3. 批量发布/回收
4. 图片库删除和重命名
5. 管理端健康面板，显示 `/api/admin/health`
6. 内容列表搜索和筛选

### 验证接口

```text
http://localhost:4173/admin/
```

测试路径：

1. 登录
2. 新建文章
3. 上传封面
4. 保存草稿
5. 发布
6. 回收
7. 恢复
8. 导出内容

## 10. Agent 4：访客端体验、视觉与前端架构

### 目标

提升网站视觉品质、阅读体验、移动端体验和前端代码可维护性。

### 责任范围

主要负责：

```text
index.html
category.html
projects.html
post.html
project.html
main.js
post.js
styles.css
site.webmanifest
assets/
```

不负责：

- 后端认证
- 数据库迁移
- 部署脚本

### 输入

- `window.GokottaContent.getPosts()`
- `window.GokottaContent.getProjects()`
- `/api/content.js`
- 静态图片资产
- 当前视觉方向：蓝白科技、电子实验室、高质量摄影、玻璃流线 Hero

### 输出

- 更稳定的视觉系统
- 模块化 CSS
- 阅读增强
- 搜索体验增强
- 图片优化方案
- 移动端优化

### 推荐下一步任务

1. 拆分 `styles.css`
   - `base.css`
   - `layout.css`
   - `components.css`
   - `hero.css`
   - `markdown.css`
   - `responsive.css`
2. 把 Hero 流线配置从 `main.js` 抽成独立数据
3. 增加文章阅读进度条
4. 增加图片灯箱
5. 优化移动端 Hero
6. 生成 WebP/多尺寸图片

### 验证接口

```text
http://localhost:4173/
http://localhost:4173/post.html?id=stm32-adc-dma-precision
http://localhost:4173/projects.html
```

浏览器检查：

- 1920x1080
- 1366x768
- 390x844
- 首页 Hero 不重叠
- 卡片文字可读
- Markdown 代码块可读

## 11. Agent 5：内容、SEO 与知识体系

### 目标

把网站从“能展示文章”升级为“可长期沉淀电子技术知识库”。

### 责任范围

主要负责：

```text
content/posts/
data/posts.js
data/seed.js
README.md 中内容说明
SEO 相关页面文案
文章分类与标签规划
```

可协作：

- 与 Agent 2 协作正式标签模型
- 与 Agent 4 协作详情页 SEO 和阅读体验

不负责：

- 部署脚本
- 管理端 CRUD 逻辑
- 后端认证

### 输入

- 当前 4 个方向：
  - 模拟电子
  - STM32
  - ESP32
  - 独立开源项目
- 当前示例文章：
  - 有源低通滤波器设计与仿真分析
  - STM32 ADC 模拟采样从原理到精度优化
  - ESP32 低功耗智能家居节点设计指南
  - 开源桌面功率放大器项目规划

### 输出

- 内容地图
- 标签体系
- 文章模板
- 项目文档模板
- SEO 标题/描述规范
- 未来 20 篇文章规划

### 推荐下一步任务

1. 建立内容分类树
2. 建立标签规范
3. 建立文章模板：
   - 目标
   - 原理
   - 电路/代码
   - 调试
   - 常见问题
   - 扩展阅读
4. 建立开源项目模板：
   - 项目状态
   - BOM
   - 原理图
   - PCB
   - 固件
   - 外壳
   - 调试记录
5. 补充首批 12 篇文章选题

### 验证接口

- 文章是否能被 Markdown 渲染
- 是否包含封面、摘要、分类、标签
- 是否适合首页卡片展示
- 是否适合 RSS 和 sitemap

## 12. Agent 之间的接口约定

### 内容对象：Post

当前字段：

```ts
type Post = {
  id: string;
  slug: string;
  type: "post";
  title: string;
  category: string;
  categoryKey: string;
  excerpt: string;
  cover: string;
  markdown: string;
  readTime: string;
  date: string;
  publishStatus: "draft" | "published";
  featured: boolean | number;
  featuredOrder: number;
  deletedAt?: string;
  tags?: string;
};
```

### 内容对象：Project

当前字段：

```ts
type Project = {
  id: string;
  slug: string;
  type: "project";
  title: string;
  status: string;
  statusKey: "planned" | "development" | "online";
  summary: string;
  cover: string;
  markdown: string;
  license: string;
  stars: number;
  date: string;
  visibilityStatus: "draft" | "published";
  featured: boolean | number;
  featuredOrder: number;
  deletedAt?: string;
  repoUrl?: string;
  bomUrl?: string;
  docsUrl?: string;
  version?: string;
  progress?: number;
  tags?: string;
};
```

### API 契约

公开：

```text
GET /api/content
GET /api/content.js
GET /healthz
GET /sitemap.xml
GET /robots.txt
GET /rss.xml
```

管理员：

```text
GET  /api/session
POST /api/login
POST /api/logout
GET  /api/admin/content
GET  /api/admin/export
GET  /api/admin/health
GET  /api/uploads
POST /api/uploads
POST /api/posts
POST /api/projects
POST /api/posts/:id/restore
POST /api/projects/:id/restore
DELETE /api/posts/:id
DELETE /api/projects/:id
DELETE /api/posts/:id/hard
DELETE /api/projects/:id/hard
```

### 版本约定

当前使用：

```text
V主版本.次版本.补丁版本+YYYYMMDD-HHmm
```

示例：

```text
V1.5.0+20260504-1655
```

规则：

- 重大体验、架构、运维更新：次版本 +0.1.0
- 小修复：补丁版本 +0.0.1
- 每次更新 build 使用分钟级时间
- 同步修改：
  - `data/site-meta.js`
  - `server.js` 中 `siteVersion` 和 `siteBuild`
  - HTML 静态资源版本参数

### 报告约定

每次任务输出报告到：

```text
D:\Project\26-WEB\项目报告
```

命名：

```text
YYYY-MM-DD_HH-mm_进度情况_汇报.md
```

## 13. 推荐并行执行方式

### 第一阶段：稳定底座

优先 agent：

1. Agent 1：运维与发布稳定性
2. Agent 2：后端与数据模型
3. Agent 3：管理端 CMS

原因：

- 当前最值得优先处理的是 CSRF、审计、备份、模块化。

### 第二阶段：体验升级

优先 agent：

1. Agent 4：访客端体验
2. Agent 5：内容与 SEO

原因：

- 等底座稳定后，再做阅读体验、图片优化、内容体系，收益更稳。

## 14. 给新 Agent 的启动命令

```powershell
cd D:\Project\26-WEB\GokottaMaker
git status -sb
git log -5 --oneline
node --experimental-sqlite --check server.js
node --check main.js
node --check admin\admin.js
node --check data\markdown-renderer.js
```

启动本地服务：

```powershell
node --experimental-sqlite server.js
```

验证：

```powershell
curl http://127.0.0.1:4173/healthz
```

## 15. 顶层规划结论

GokottaMaker 当前已经越过“能不能运行”的阶段，进入“能不能长期稳定迭代”的阶段。

后续最好的组织方式是：

- Agent 1 保证部署和数据不丢
- Agent 2 保证后端和数据库可扩展
- Agent 3 保证内容管理效率
- Agent 4 保证访客体验和视觉品质
- Agent 5 保证内容体系和 SEO 长期增长

所有 agent 的协作边界应围绕 API 契约和内容对象字段，不要互相直接改对方模块的内部实现。若确实需要跨边界修改，必须在输出中明确说明影响范围和迁移方式。
