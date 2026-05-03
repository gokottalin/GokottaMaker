# GokottaMaker 架构说明

## 当前阶段

当前已经从 P0 静态原型升级为本地服务 + SQLite 原型。目标是先确认网站信息架构、访客端页面骨架、管理端内容工作流和可托管形态。

当前推荐通过本地服务访问：

```text
http://localhost:4173
http://localhost:4173/admin/
```

管理端原型能力：

- 管理员登录演示。
- Markdown 粘贴与 `.md` 文件导入。
- 封面类型选择。
- 本地文章新增、编辑、删除。
- Markdown 预览。

当前管理员登录已经改为服务端验证，密码使用 `scrypt` 哈希和随机盐保存到 SQLite，不再在数据库中保存明文密码。

## 当前服务端

服务端入口：

```text
server.js
```

数据库位置：

```text
database/gokottamaker.sqlite
```

当前 API：

- `GET /api/content`：读取文章和项目 JSON。
- `GET /api/content.js`：给访客端注入数据库内容。
- `GET /api/session`：检查登录状态。
- `POST /api/login`：管理员登录。
- `POST /api/logout`：退出登录。
- `POST /api/posts`：保存文章。
- `DELETE /api/posts/:id`：删除文章。
- `POST /api/projects`：保存项目。
- `DELETE /api/projects/:id`：删除项目。
- `POST /api/uploads`：上传封面图片，返回 `uploads/` 下的稳定访问路径。

## 封面图片

通过管理端选择封面图片时，服务端会：

1. 验证图片类型。
2. 限制图片大小不超过 8MB。
3. 保存到 `uploads/`。
4. 返回类似 `./uploads/2026-05-03-xxxx.png` 的路径。
5. 文章或项目保存时，将该路径写入 SQLite。

需要备份的上传目录：

```text
uploads/
```

## 正式版本建议

后续建议迁移为 Next.js + SQLite：

```text
app/
  page.tsx
  blog/[slug]/page.tsx
  categories/[slug]/page.tsx
  projects/[slug]/page.tsx
  admin/
components/
  layout/
  blog/
  admin/
  markdown/
lib/
  auth/
  db/
  markdown/
public/
  covers/
  uploads/
prisma/
```

## SQLite 数据模型草案

```sql
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  markdown TEXT NOT NULL,
  cover_image TEXT,
  category_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  markdown TEXT NOT NULL,
  cover_image TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  repo_url TEXT,
  bom_url TEXT,
  schematic_url TEXT,
  firmware_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 管理员初始信息

- 账号：`Gokotta`
- 密码：已在原型中配置。正式版本必须改为哈希存储。

## 托管建议

静态原型可托管到：

- GitHub Pages
- Cloudflare Pages
- Netlify

正式 CMS 版本建议托管到：

- VPS：最适合 SQLite 文件数据库和图片上传。
- Vercel + 外部数据库：适合更现代的云部署，但 SQLite 文件写入不如 VPS 直接。
