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
const adminPassword = process.env.ADMIN_PASSWORD || "linguihong123...";
const resetAdminPassword = process.env.ADMIN_RESET_PASSWORD_ON_START === "true";

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
      INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const post of seed.posts) {
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
        post.date || ""
      );
    }
  }

  if (!projectCount) {
    const insertProject = db.prepare(`
      INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        project.date || ""
      );
    }
  }
}

seedAdmin();
seedContent();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
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
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
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

function allPosts() {
  return db
    .prepare(
      `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
              excerpt, cover, markdown, read_time AS readTime, date
       FROM posts
       ORDER BY date DESC, updated_at DESC`
    )
    .all();
}

function allProjects() {
  return db
    .prepare(
      `SELECT id, slug, 'project' AS type, title, status, status_key AS statusKey,
              summary, cover, markdown, license, stars, date
       FROM projects
       ORDER BY updated_at DESC`
    )
    .all();
}

function contentScript(res) {
  const body = `window.GOKOTTA_SERVER_CONTENT = ${JSON.stringify({ posts: allPosts(), projects: allProjects() })};`;
  res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
  res.end(body);
}

function savePost(payload) {
  db.prepare(
    `INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
    payload.date || new Date().toISOString().slice(0, 10)
  );
}

function saveProject(payload) {
  db.prepare(
    `INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
    payload.date || new Date().toISOString().slice(0, 10)
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

async function api(req, res, pathname) {
  if (pathname === "/api/content.js" && req.method === "GET") return contentScript(res);
  if (pathname === "/api/content" && req.method === "GET") return json(res, 200, { posts: allPosts(), projects: allProjects() });
  if (pathname === "/api/session" && req.method === "GET") return json(res, 200, { user: currentUser(req) });

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(body.username || "");
    if (!user || !verifyPassword(body.password || "", user.password_salt, user.password_hash)) {
      return json(res, 401, { error: "账号或密码不正确" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(token, user.id);
    res.setHeader("Set-Cookie", `gokottamaker_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
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

  if (pathname === "/api/posts" && req.method === "POST") {
    savePost(await readBody(req));
    return json(res, 200, { posts: allPosts() });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    saveProject(await readBody(req));
    return json(res, 200, { projects: allProjects() });
  }

  if (pathname === "/api/uploads" && req.method === "POST") {
    const url = saveUpload(await readBody(req));
    return json(res, 200, { url });
  }

  const deletePost = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (deletePost && req.method === "DELETE") {
    db.prepare("DELETE FROM posts WHERE id = ?").run(decodeURIComponent(deletePost[1]));
    return json(res, 200, { posts: allPosts() });
  }

  const deleteProject = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (deleteProject && req.method === "DELETE") {
    db.prepare("DELETE FROM projects WHERE id = ?").run(decodeURIComponent(deleteProject[1]));
    return json(res, 200, { projects: allProjects() });
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
  ".md": "text/markdown; charset=utf-8"
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
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "server error" });
  }
});

server.listen(port, () => {
  console.log(`GokottaMaker running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
  console.log(`Uploads directory: ${uploadDir}`);
});
