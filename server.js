const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
const dbDir = path.resolve(process.env.DB_DIR || path.join(dataDir, "database"));
const dbPath = path.resolve(process.env.DB_PATH || path.join(dbDir, "gokottamaker.sqlite"));
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(dataDir, "uploads"));
const port = Number(process.env.PORT || 4173);
const adminUsername = process.env.ADMIN_USERNAME || "Gokotta";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-before-public-deploy";
const resetAdminPassword = process.env.ADMIN_RESET_PASSWORD_ON_START === "true";

if (!process.env.ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Use a strong password in production.");
}

fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    category_key TEXT NOT NULL,
    excerpt TEXT,
    cover TEXT,
    markdown TEXT NOT NULL,
    read_time TEXT,
    date TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    status_key TEXT NOT NULL,
    summary TEXT,
    cover TEXT,
    markdown TEXT NOT NULL,
    license TEXT,
    stars INTEGER NOT NULL DEFAULT 0,
    date TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
  if (!columns.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn("posts", "publish_status", "TEXT NOT NULL DEFAULT 'published'");
ensureColumn("posts", "featured", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "featured_order", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "deleted_at", "TEXT");
ensureColumn("posts", "tags", "TEXT");
ensureColumn("projects", "visibility_status", "TEXT NOT NULL DEFAULT 'published'");
ensureColumn("projects", "featured", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("projects", "featured_order", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("projects", "deleted_at", "TEXT");
ensureColumn("projects", "tags", "TEXT");
ensureColumn("projects", "repo_url", "TEXT");
ensureColumn("projects", "bom_url", "TEXT");
ensureColumn("projects", "docs_url", "TEXT");
ensureColumn("projects", "version", "TEXT");
ensureColumn("projects", "progress", "INTEGER NOT NULL DEFAULT 0");

const siteVersion = "V1.2.0";
const siteBuild = "20260504-1043";
const siteVersionLabel = `${siteVersion}+${siteBuild}`;
const siteUrl = (process.env.SITE_URL || "http://81.71.156.122:4173").replace(/\/$/, "");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function seedAdmin() {
  const existing = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(adminUsername);
  const { hash, salt } = hashPassword(adminPassword);
  if (!existing) {
    db.prepare("INSERT INTO admin_users (username, password_hash, password_salt) VALUES (?, ?, ?)").run(adminUsername, hash, salt);
    return;
  }
  if (resetAdminPassword) {
    db.prepare("UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, existing.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  }
}

function loadSeedData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "posts.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "seed.js"), "utf8"), sandbox);
  return {
    posts: sandbox.window.GOKOTTA_POSTS || [],
    projects: sandbox.window.GOKOTTA_PROJECTS || sandbox.window.GOKOTTA_SEED?.projects || []
  };
}

function seedContent() {
  const postCount = db.prepare("SELECT COUNT(*) AS count FROM posts").get().count;
  const projectCount = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
  const seed = loadSeedData();

  if (!postCount) {
    const insertPost = db.prepare(`
      INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date, publish_status, featured, featured_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
    `);
    seed.posts.forEach((post, index) => {
      insertPost.run(
        post.id,
        post.slug || post.id,
        post.title,
        post.category,
        post.categoryKey,
        post.excerpt || "",
        post.cover || "",
        post.markdown || "",
        post.readTime || "",
        post.date || "",
        index < 4 ? 1 : 0,
        index + 1
      );
    });
  }

  if (!projectCount) {
    const insertProject = db.prepare(`
      INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date, visibility_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const project of seed.projects) {
      insertProject.run(
        project.id,
        project.slug || project.id,
        project.title,
        project.status,
        project.statusKey,
        project.summary || "",
        project.cover || "",
        project.markdown || "",
        project.license || "",
        Number(project.stars || 0),
        project.date || "",
        project.statusKey === "online" ? "published" : "draft"
      );
    }
  }
}

function reconcileSeedContent() {
  const seed = loadSeedData();
  const updateSeedPost = db.prepare(`
    UPDATE posts
    SET publish_status = 'published',
        featured = CASE WHEN featured = 0 THEN ? ELSE featured END,
        featured_order = CASE WHEN featured_order = 0 THEN ? ELSE featured_order END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
      AND publish_status != 'published'
  `);
  seed.posts.forEach((post, index) => {
    updateSeedPost.run(index < 4 ? 1 : 0, index + 1, post.id);
  });

  const updateSeedProject = db.prepare(`
    UPDATE projects
    SET visibility_status = ?,
        status = ?,
        status_key = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
  `);
  seed.projects.forEach((project) => {
    updateSeedProject.run(project.statusKey === "online" ? "published" : "draft", project.status, project.statusKey, project.id);
  });
}

seedAdmin();
seedContent();
reconcileSeedContent();
db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, status, body, type = "text/plain; charset=utf-8", cache = "public, max-age=300") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        const error = new Error("请求数据格式不正确");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function currentUser(req) {
  const token = cookies(req).gokottamaker_session;
  if (!token) return null;
  return db
    .prepare(
      `SELECT admin_users.id, admin_users.username
       FROM sessions
       JOIN admin_users ON admin_users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
    )
    .get(token);
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    json(res, 401, { error: "unauthorized" });
    return null;
  }
  return user;
}

function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https";
}

function cookieHeader(token, req) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `gokottamaker_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

function normalizeFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1" ? 1 : 0;
}

function visibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND publish_status = 'published'";
}

function projectVisibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND visibility_status = 'published'";
}

function allPosts(admin = false) {
  return db
    .prepare(
      `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
              excerpt, cover, markdown, read_time AS readTime, date,
              publish_status AS publishStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt, tags
       FROM posts
       ${visibilityFilter(admin)}
       ORDER BY deleted_at IS NOT NULL ASC, date DESC, updated_at DESC`
    )
    .all();
}

function allProjects(admin = false) {
  return db
    .prepare(
      `SELECT id, slug, 'project' AS type, title, status, status_key AS statusKey,
              summary, cover, markdown, license, stars, date,
              visibility_status AS visibilityStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt,
              repo_url AS repoUrl, bom_url AS bomUrl, docs_url AS docsUrl, version, progress, tags
       FROM projects
       ${projectVisibilityFilter(admin)}
       ORDER BY deleted_at IS NOT NULL ASC, updated_at DESC`
    )
    .all();
}

function contentScript(res) {
  const body = `window.GOKOTTA_SERVER_CONTENT = ${JSON.stringify({ posts: allPosts(false), projects: allProjects(false) })};`;
  res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}

function savePost(payload) {
  db.prepare(
    `INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date,
                        publish_status, featured, featured_order, deleted_at, tags, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       category = excluded.category,
       category_key = excluded.category_key,
       excerpt = excluded.excerpt,
       cover = excluded.cover,
       markdown = excluded.markdown,
       read_time = excluded.read_time,
       date = excluded.date,
       publish_status = excluded.publish_status,
       featured = excluded.featured,
       featured_order = excluded.featured_order,
       deleted_at = NULL,
       tags = excluded.tags,
       updated_at = CURRENT_TIMESTAMP`
  ).run(
    payload.id,
    payload.slug || payload.id,
    payload.title,
    payload.category,
    payload.categoryKey,
    payload.excerpt || "",
    payload.cover || "",
    payload.markdown || "",
    payload.readTime || "10 分钟阅读",
    payload.date || new Date().toISOString().slice(0, 10),
    payload.publishStatus || "draft",
    normalizeFlag(payload.featured),
    Number(payload.featuredOrder || 0),
    payload.tags || ""
  );
}

function saveProject(payload) {
  db.prepare(
    `INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date,
                           visibility_status, featured, featured_order, deleted_at,
                           repo_url, bom_url, docs_url, version, progress, tags, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       status = excluded.status,
       status_key = excluded.status_key,
       summary = excluded.summary,
       cover = excluded.cover,
       markdown = excluded.markdown,
       license = excluded.license,
       stars = excluded.stars,
       date = excluded.date,
       visibility_status = excluded.visibility_status,
       featured = excluded.featured,
       featured_order = excluded.featured_order,
       deleted_at = NULL,
       repo_url = excluded.repo_url,
       bom_url = excluded.bom_url,
       docs_url = excluded.docs_url,
       version = excluded.version,
       progress = excluded.progress,
       tags = excluded.tags,
       updated_at = CURRENT_TIMESTAMP`
  ).run(
    payload.id,
    payload.slug || payload.id,
    payload.title,
    payload.status,
    payload.statusKey,
    payload.summary || "",
    payload.cover || "",
    payload.markdown || "",
    payload.license || "MIT License",
    Number(payload.stars || 0),
    payload.date || new Date().toISOString().slice(0, 10),
    payload.visibilityStatus || "draft",
    normalizeFlag(payload.featured),
    Number(payload.featuredOrder || 0),
    payload.repoUrl || "",
    payload.bomUrl || "",
    payload.docsUrl || "",
    payload.version || "",
    Number(payload.progress || 0),
    payload.tags || ""
  );
}

function extensionFromUpload(filename, dataUrl) {
  const lower = String(filename || "").toLowerCase();
  const ext = path.extname(lower);
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext;
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/);
  if (!match) return "";
  return match[1] === "jpeg" ? ".jpg" : `.${match[1]}`;
}

function saveUpload(payload) {
  const dataUrl = String(payload.dataUrl || "");
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!match) {
    const error = new Error("仅支持 PNG、JPG、WebP、GIF 图片");
    error.status = 400;
    throw error;
  }

  const ext = extensionFromUpload(payload.filename, dataUrl);
  if (!ext) {
    const error = new Error("无法识别图片格式");
    error.status = 400;
    throw error;
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 8 * 1024 * 1024) {
    const error = new Error("图片不能超过 8MB");
    error.status = 400;
    throw error;
  }

  const filename = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), bytes);
  return `./uploads/${filename}`;
}

function uploads() {
  if (!fs.existsSync(uploadDir)) return [];
  return fs
    .readdirSync(uploadDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
    .map((entry) => {
      const stats = fs.statSync(path.join(uploadDir, entry.name));
      return {
        name: entry.name,
        url: `./uploads/${entry.name}`,
        size: stats.size,
        updatedAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function absoluteUrl(pathname) {
  return `${siteUrl}${pathname}`;
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function publicPages() {
  return [
    { loc: absoluteUrl("/"), priority: "1.0" },
    { loc: absoluteUrl("/category.html?category=analog"), priority: "0.8" },
    { loc: absoluteUrl("/category.html?category=stm32"), priority: "0.8" },
    { loc: absoluteUrl("/category.html?category=esp32"), priority: "0.8" },
    { loc: absoluteUrl("/projects.html"), priority: "0.8" },
    ...allPosts(false).map((post) => ({ loc: absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`), priority: "0.7", lastmod: post.date })),
    ...allProjects(false).map((project) => ({ loc: absoluteUrl(`/project.html?id=${encodeURIComponent(project.id)}`), priority: "0.7", lastmod: project.date }))
  ];
}

function sitemap(res) {
  const urls = publicPages()
    .map(
      (page) => `  <url>
    <loc>${xmlEscape(page.loc)}</loc>
    ${page.lastmod ? `<lastmod>${xmlEscape(page.lastmod)}</lastmod>` : ""}
    <priority>${page.priority}</priority>
  </url>`
    )
    .join("\n");
  return text(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "application/xml; charset=utf-8");
}

function robots(res) {
  return text(
    res,
    200,
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${absoluteUrl("/sitemap.xml")}
`,
    "text/plain; charset=utf-8"
  );
}

function rss(res) {
  const items = allPosts(false)
    .slice(0, 20)
    .map(
      (post) => `<item>
  <title>${xmlEscape(post.title)}</title>
  <link>${xmlEscape(absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`))}</link>
  <guid>${xmlEscape(absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`))}</guid>
  <description>${xmlEscape(post.excerpt || "")}</description>
  <pubDate>${new Date(post.date || Date.now()).toUTCString()}</pubDate>
</item>`
    )
    .join("\n");
  return text(
    res,
    200,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>GokottaMaker</title>
<link>${xmlEscape(siteUrl)}</link>
<description>Embedded electronics notes, STM32, ESP32, and open hardware projects.</description>
${items}
</channel>
</rss>
`,
    "application/rss+xml; charset=utf-8"
  );
}

function exportContent() {
  return {
    site: {
      name: "GokottaMaker",
      url: siteUrl,
      version: siteVersion,
      build: siteBuild,
      versionLabel: siteVersionLabel
    },
    exportedAt: new Date().toISOString(),
    posts: allPosts(true),
    projects: allProjects(true),
    uploads: uploads()
  };
}

const loginFailures = new Map();

function loginKey(req, username) {
  return `${req.socket.remoteAddress || "unknown"}:${username || ""}`;
}

function isLoginBlocked(key) {
  const record = loginFailures.get(key);
  if (!record) return false;
  if (record.until && record.until > Date.now()) return true;
  if (record.until && record.until <= Date.now()) loginFailures.delete(key);
  return false;
}

function recordLoginFailure(key) {
  const record = loginFailures.get(key) || { count: 0, until: 0 };
  record.count += 1;
  if (record.count >= 5) record.until = Date.now() + 15 * 60 * 1000;
  loginFailures.set(key, record);
}

async function api(req, res, pathname) {
  if (pathname === "/api/content.js" && req.method === "GET") return contentScript(res);
  if (pathname === "/api/content" && req.method === "GET") return json(res, 200, { posts: allPosts(false), projects: allProjects(false) });
  if (pathname === "/api/session" && req.method === "GET") return json(res, 200, { user: currentUser(req) });

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const key = loginKey(req, body.username);
    if (isLoginBlocked(key)) return json(res, 429, { error: "登录失败次数过多，请 15 分钟后再试" });

    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(body.username || "");
    if (!user || !verifyPassword(body.password || "", user.password_salt, user.password_hash)) {
      recordLoginFailure(key);
      return json(res, 401, { error: "账号或密码不正确" });
    }

    loginFailures.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(token, user.id);
    res.setHeader("Set-Cookie", cookieHeader(token, req));
    return json(res, 200, { user: { id: user.id, username: user.username } });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const token = cookies(req).gokottamaker_session;
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    res.setHeader("Set-Cookie", "gokottamaker_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return json(res, 200, { ok: true });
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (pathname === "/api/admin/content" && req.method === "GET") return json(res, 200, { posts: allPosts(true), projects: allProjects(true) });
  if (pathname === "/api/admin/export" && req.method === "GET") return json(res, 200, exportContent());
  if (pathname === "/api/uploads" && req.method === "GET") return json(res, 200, { uploads: uploads() });

  if (pathname === "/api/posts" && req.method === "POST") {
    savePost(await readBody(req));
    return json(res, 200, { posts: allPosts(true) });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    saveProject(await readBody(req));
    return json(res, 200, { projects: allProjects(true) });
  }

  if (pathname === "/api/uploads" && req.method === "POST") {
    const url = saveUpload(await readBody(req));
    return json(res, 200, { url, uploads: uploads() });
  }

  const postRestore = pathname.match(/^\/api\/posts\/([^/]+)\/restore$/);
  if (postRestore && req.method === "POST") {
    db.prepare("UPDATE posts SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(decodeURIComponent(postRestore[1]));
    return json(res, 200, { posts: allPosts(true) });
  }

  const projectRestore = pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if (projectRestore && req.method === "POST") {
    db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(decodeURIComponent(projectRestore[1]));
    return json(res, 200, { projects: allProjects(true) });
  }

  const hardDeletePost = pathname.match(/^\/api\/posts\/([^/]+)\/hard$/);
  if (hardDeletePost && req.method === "DELETE") {
    db.prepare("DELETE FROM posts WHERE id = ?").run(decodeURIComponent(hardDeletePost[1]));
    return json(res, 200, { posts: allPosts(true) });
  }

  const hardDeleteProject = pathname.match(/^\/api\/projects\/([^/]+)\/hard$/);
  if (hardDeleteProject && req.method === "DELETE") {
    db.prepare("DELETE FROM projects WHERE id = ?").run(decodeURIComponent(hardDeleteProject[1]));
    return json(res, 200, { projects: allProjects(true) });
  }

  const deletePost = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (deletePost && req.method === "DELETE") {
    db.prepare("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(decodeURIComponent(deletePost[1]));
    return json(res, 200, { posts: allPosts(true) });
  }

  const deleteProject = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (deleteProject && req.method === "DELETE") {
    db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(decodeURIComponent(deleteProject[1]));
    return json(res, 200, { projects: allProjects(true) });
  }

  return json(res, 404, { error: "not found" });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function serveStatic(res, pathname) {
  let requested = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  if (requested.endsWith("/")) requested += "index.html";
  let target = path.normalize(path.join(root, requested));
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    const notFound = path.join(root, "404.html");
    if (fs.existsSync(notFound)) {
      res.writeHead(404, {
        "Content-Type": mime[".html"],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
      });
      fs.createReadStream(notFound).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const isAsset = /\.(css|js|png|jpe?g|webp|gif)$/i.test(target);
  const cacheControl = ext === ".html" ? "no-cache" : isAsset ? "public, max-age=604800" : "public, max-age=300";
  res.writeHead(200, {
    "Content-Type": mime[ext] || "application/octet-stream",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    if (url.pathname === "/sitemap.xml") return sitemap(res);
    if (url.pathname === "/robots.txt") return robots(res);
    if (url.pathname === "/rss.xml") return rss(res);
    serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { error: error.status ? error.message : "server error" });
  }
});

server.listen(port, () => {
  console.log(`GokottaMaker running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
  console.log(`Uploads directory: ${uploadDir}`);
});
