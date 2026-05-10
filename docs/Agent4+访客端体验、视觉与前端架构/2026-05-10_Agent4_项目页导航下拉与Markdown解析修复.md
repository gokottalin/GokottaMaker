# 2026-05-10 Agent4 项目页导航下拉与 Markdown 解析修复

## 问题

用户反馈：

- 浏览项目时，导航栏无法下拉。
- Markdown 文件部分内容无法解析。
- 用户提供参考文件：`C:\Users\10731\Desktop\deepseek_text_20260507_19af93.svg`。

核对结果：

- Desktop 上只找到该 SVG 文件，没有额外 `.md` 文件。
- 该 SVG 是电路原理图渲染结果，可作为 Markdown 图片引用测试素材。
- 当前 Markdown 渲染器原本只支持标题、无序列表、引用、代码块、基础图片/链接、加粗和行内代码，不支持表格、有序列表、任务列表、分割线、删除线等常见文档语法。

## 已完成

### 1. 导航下拉

- 在 `data/footer.js` 中为所有访客端 `.site-header .main-nav` 自动注入 `data-nav-toggle` 按钮。
- 移动端点击按钮后切换 `.site-header.is-nav-open`。
- 同步 `aria-expanded` 和 `aria-label`，支持键盘 Escape 关闭。
- 桌面仍保持横向导航，小屏变成真正的下拉菜单，不再依赖横向滚动。

涉及文件：

- `data/footer.js`
- `styles/00-base.css`
- `styles/40-responsive.css`

### 2. Markdown 解析增强

已新增或修复：

- 表格：`| header |` + `| --- |`。
- 有序列表：`1.` / `1)`。
- 任务列表：`- [x]` / `- [ ]`。
- 分割线：`---` / `***` / `___`。
- 四级标题：`####`。
- 删除线：`~~text~~`。
- 斜体：`*text*` / `_text_`。
- 带查询参数的站内链接。
- 普通相对 SVG 图片路径。
- Windows 本地绝对图片路径提示：本地路径不会当成站内资源硬渲染，改为显示清晰提示，避免出现破图。
- 修复行内代码占位符被斜体规则误伤的问题。

涉及文件：

- `data/markdown-renderer.js`
- `styles/20-content.css`

### 3. 版本

- 当前版本：`V2.4.1+20260510-1440`
- 本地服务：`http://127.0.0.1:4178/`
- 健康检查：`ok: true`

## 验收

静态检查已通过：

```powershell
node --check data\footer.js
node --check data\markdown-renderer.js
node --check post.js
node --experimental-sqlite --check server.js
node scripts\check-version.js
git diff --check
```

in-app browser 验收：

- `http://127.0.0.1:4178/project.html?id=logic-analyzer`
- 页面正常打开。
- 标题为 `GokottaLogic 逻辑分析仪 | GokottaMaker`。
- 控制台无 error / warning。

Playwright 回归：

- 1279px 项目页：桌面导航横向显示，移动菜单按钮隐藏。
- 390px 项目页：导航初始收起，点击后展开，显示 5 个导航链接。
- 390px 展开后无水平溢出。
- Markdown 样例：表格、有序列表、任务列表、本地 SVG 路径提示、站内 SVG 图片、分割线、删除线、行内代码、引用块、带参数链接均解析成功。
- 控制台无 error / warning。
- `failures: []`

结果文件：

- `docs/Agent4+访客端体验、视觉与前端架构/nav-md-regression-20260510/nav-md-regression-results.json`
- `docs/Agent4+访客端体验、视觉与前端架构/nav-md-regression-20260510/project-1279-desktop-nav.png`
- `docs/Agent4+访客端体验、视觉与前端架构/nav-md-regression-20260510/project-390-mobile-nav-open.png`
- `docs/Agent4+访客端体验、视觉与前端架构/nav-md-regression-20260510/markdown-renderer-sample.png`

## 说明

`C:\Users\10731\Desktop\deepseek_text_20260507_19af93.svg` 是本地绝对路径。浏览器中的站点页面不能把这类本地文件当作线上资源可靠加载；如果要在正式文章中显示它，需要放入站点资源目录或上传目录，并在 Markdown 中使用相对路径。

## 结论

项目详情页移动端导航下拉已可用，Markdown 渲染器已覆盖常见内容格式，本次回归通过。
