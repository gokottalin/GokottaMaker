const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { logAudit } = require("./lib/audit");
const { createAuth } = require("./lib/auth");
const { createContentStore } = require("./lib/content");
const { createDatabase } = require("./lib/db");
const { validatePostPayload, validateProjectPayload, validateUploadPayload } = require("./lib/validators");

const root = __dirname;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
const dbDir = path.resolve(process.env.DB_DIR || path.join(dataDir, "database"));
const dbPath = path.resolve(process.env.DB_PATH || path.join(dbDir, "gokottamaker.sqlite"));
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(dataDir, "uploads"));
const backupRoot = path.resolve(process.env.BACKUP_ROOT || "/srv/gokottamaker-backups");
const port = Number(process.env.PORT || 4173);
const adminUsername = process.env.ADMIN_USERNAME || "Gokotta";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-before-public-deploy";
const resetAdminPassword = process.env.ADMIN_RESET_PASSWORD_ON_START === "true";
const startedAt = new Date();

if (!process.env.ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Use a strong password in production.");
}

const db = createDatabase({ root, dataDir, dbDir, dbPath, uploadDir });
const contentStore = createContentStore(db);
const auth = createAuth(db, { adminUsername, adminPassword, resetAdminPassword });

const siteVersion = "V1.9.0";
const siteBuild = "20260506-0046";
const siteVersionLabel = `${siteVersion}+${siteBuild}`;
const siteUrl = (process.env.SITE_URL || "http://81.71.156.122:4173").replace(/\/$/, "");

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
      INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date, publish_status, featured, featured_order, tags, created_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, CURRENT_TIMESTAMP, ?)
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
        index + 1,
        post.tags || "",
        post.date || new Date().toISOString()
      );
    });
  }

  if (!projectCount) {
    const insertProject = db.prepare(`
      INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date, visibility_status, version, progress, tags, created_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
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
        project.statusKey === "online" ? "published" : "draft",
        project.version || "",
        Number(project.progress || 0),
        project.tags || "",
        project.statusKey === "online" ? project.date || new Date().toISOString() : null
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
        tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
        created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
        published_at = CASE WHEN publish_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP) ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
      AND (
        publish_status != 'published'
        OR featured = 0
        OR featured_order = 0
        OR tags IS NULL
        OR tags = ''
      )
  `);
  seed.posts.forEach((post, index) => {
    updateSeedPost.run(index < 4 ? 1 : 0, index + 1, post.tags || "", post.id);
  });

  const updateSeedProject = db.prepare(`
    UPDATE projects
    SET visibility_status = ?,
        status = ?,
        status_key = ?,
        date = CASE WHEN date IS NULL OR date = '' THEN ? ELSE date END,
        version = CASE WHEN version IS NULL OR version = '' THEN ? ELSE version END,
        progress = CASE WHEN progress IS NULL OR progress = 0 THEN ? ELSE progress END,
        tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
        created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
        published_at = CASE WHEN ? = 'online' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP) ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
  `);
  seed.projects.forEach((project) => {
    updateSeedProject.run(
      project.statusKey === "online" ? "published" : "draft",
      project.status,
      project.statusKey,
      project.date || "",
      project.version || "",
      Number(project.progress || 0),
      project.tags || "",
      project.statusKey,
      project.id
    );
  });
}

auth.seedAdmin();
seedContent();
reconcileSeedContent();
contentStore.syncTaxonomyForExistingContent();
auth.cleanupExpiredSessions();

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
  return auth.currentUser(cookies(req).gokottamaker_session);
}

function publicUser(user) {
  return auth.publicUser(user);
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    json(res, 401, { error: "unauthorized" });
    return null;
  }
  return user;
}

function requireCsrf(req, res, user) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const token = String(req.headers["x-csrf-token"] || "");
  if (!user.csrfToken || token !== user.csrfToken) {
    json(res, 403, { error: "csrf token mismatch" });
    return false;
  }
  return true;
}

function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https";
}

function cookieHeader(token, req) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `gokottamaker_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

const {
  allPosts,
  allProjects,
  savePost,
  saveProject,
  restorePost,
  restoreProject,
  hardDeletePost,
  hardDeleteProject,
  softDeletePost,
  softDeleteProject
} = contentStore;

function contentScript(res) {
  const body = `window.GOKOTTA_SERVER_CONTENT = ${JSON.stringify({ posts: allPosts(false), projects: allProjects(false) })};`;
  res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
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

function gitCommit() {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return childProcess.execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function writable(target) {
  try {
    fs.accessSync(target, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function fileSize(target) {
  try {
    return fs.statSync(target).size;
  } catch {
    return 0;
  }
}

function directorySummary(target) {
  const summary = { path: target, exists: false, files: 0, bytes: 0 };

  function walk(current) {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        summary.files += 1;
        summary.bytes += fileSize(entryPath);
      }
    }
  }

  try {
    summary.exists = fs.statSync(target).isDirectory();
  } catch {
    return summary;
  }

  if (summary.exists) walk(target);
  return summary;
}

function databaseFilesSummary() {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  return {
    path: dbPath,
    exists: fs.existsSync(dbPath),
    bytes: fileSize(dbPath),
    walBytes: fileSize(walPath),
    shmBytes: fileSize(shmPath),
    totalBytes: fileSize(dbPath) + fileSize(walPath) + fileSize(shmPath)
  };
}

function latestBackupSummary() {
  try {
    const backups = fs
      .readdirSync(backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const backupPath = path.join(backupRoot, entry.name);
        const stats = fs.statSync(backupPath);
        return {
          name: entry.name,
          path: backupPath,
          updatedAt: stats.mtime.toISOString(),
          hasManifest: fs.existsSync(path.join(backupPath, "manifest.txt")),
          hasChecksums: fs.existsSync(path.join(backupPath, "manifest.sha256"))
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const latest = backups[0] || null;
    if (latest) latest.bytes = directorySummary(latest.path).bytes;

    return {
      root: backupRoot,
      exists: true,
      count: backups.length,
      latest
    };
  } catch {
    return {
      root: backupRoot,
      exists: false,
      count: 0,
      latest: null
    };
  }
}

function healthPayload({ detailed = false } = {}) {
  const database = databaseFilesSummary();
  const uploadsSummary = directorySummary(uploadDir);
  const payload = {
    ok: true,
    name: "GokottaMaker",
    version: siteVersion,
    build: siteBuild,
    versionLabel: siteVersionLabel,
    gitCommit: gitCommit(),
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    serverTime: new Date().toISOString(),
    data: {
      databaseBytes: database.totalBytes,
      uploadsBytes: uploadsSummary.bytes,
      uploadsFiles: uploadsSummary.files
    }
  };

  if (!detailed) return payload;

  const dbReady = Boolean(db.prepare("SELECT 1 AS ok").get()?.ok);
  return {
    ...payload,
    root,
    dataDir,
    dbPath,
    uploadDir,
    backupRoot,
    databaseReady: dbReady,
    databaseWritable: writable(dbDir),
    uploadsWritable: writable(uploadDir),
    database,
    uploadsStorage: uploadsSummary,
    backups: latestBackupSummary(),
    publicPosts: allPosts(false).length,
    publicProjects: allProjects(false).length,
    adminPosts: allPosts(true).length,
    adminProjects: allProjects(true).length,
    uploads: uploads().length
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
  if (pathname === "/api/session" && req.method === "GET") {
    const user = currentUser(req);
    return json(res, 200, { user: publicUser(user), csrfToken: user?.csrfToken || "" });
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const key = loginKey(req, body.username);
    if (isLoginBlocked(key)) {
      logAudit(db, req, null, "login_blocked", "admin_user", body.username || "", { username: body.username || "" });
      return json(res, 429, { error: "登录失败次数过多，请 15 分钟后再试" });
    }

    const user = auth.findUser(body.username || "");
    if (!user || !auth.verifyPassword(body.password || "", user.password_salt, user.password_hash)) {
      recordLoginFailure(key);
      logAudit(db, req, user ? { id: user.id, username: user.username } : null, "login_failed", "admin_user", body.username || "", { username: body.username || "" });
      return json(res, 401, { error: "账号或密码不正确" });
    }

    loginFailures.delete(key);
    const { token, csrfToken } = auth.createSession(user.id);
    res.setHeader("Set-Cookie", cookieHeader(token, req));
    logAudit(db, req, user, "login_success", "admin_user", String(user.id));
    return json(res, 200, { user: { id: user.id, username: user.username }, csrfToken });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireCsrf(req, res, user)) return;
    const token = cookies(req).gokottamaker_session;
    auth.deleteSession(token);
    res.setHeader("Set-Cookie", "gokottamaker_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    logAudit(db, req, user, "logout", "session", token ? token.slice(0, 8) : "");
    return json(res, 200, { ok: true });
  }

  const user = requireUser(req, res);
  if (!user) return;
  if (!requireCsrf(req, res, user)) return;

  if (pathname === "/api/admin/content" && req.method === "GET") return json(res, 200, { posts: allPosts(true), projects: allProjects(true) });
  if (pathname === "/api/admin/health" && req.method === "GET") return json(res, 200, healthPayload({ detailed: true }));
  if (pathname === "/api/admin/export" && req.method === "GET") {
    logAudit(db, req, user, "content_export", "content", "all");
    return json(res, 200, exportContent());
  }
  if (pathname === "/api/uploads" && req.method === "GET") return json(res, 200, { uploads: uploads() });

  if (pathname === "/api/posts" && req.method === "POST") {
    const body = validatePostPayload(await readBody(req));
    savePost(body);
    logAudit(db, req, user, "post_save", "post", body.id, { publishStatus: body.publishStatus, featured: body.featured });
    return json(res, 200, { posts: allPosts(true) });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    const body = validateProjectPayload(await readBody(req));
    saveProject(body);
    logAudit(db, req, user, "project_save", "project", body.id, { visibilityStatus: body.visibilityStatus, statusKey: body.statusKey });
    return json(res, 200, { projects: allProjects(true) });
  }

  if (pathname === "/api/uploads" && req.method === "POST") {
    const body = validateUploadPayload(await readBody(req));
    const url = saveUpload(body);
    logAudit(db, req, user, "upload_create", "upload", url, { filename: body.filename || "" });
    return json(res, 200, { url, uploads: uploads() });
  }

  const postRestore = pathname.match(/^\/api\/posts\/([^/]+)\/restore$/);
  if (postRestore && req.method === "POST") {
    const id = decodeURIComponent(postRestore[1]);
    restorePost(id);
    logAudit(db, req, user, "post_restore", "post", id);
    return json(res, 200, { posts: allPosts(true) });
  }

  const projectRestore = pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if (projectRestore && req.method === "POST") {
    const id = decodeURIComponent(projectRestore[1]);
    restoreProject(id);
    logAudit(db, req, user, "project_restore", "project", id);
    return json(res, 200, { projects: allProjects(true) });
  }

  const hardDeletePostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/hard$/);
  if (hardDeletePostMatch && req.method === "DELETE") {
    const id = decodeURIComponent(hardDeletePostMatch[1]);
    hardDeletePost(id);
    logAudit(db, req, user, "post_hard_delete", "post", id);
    return json(res, 200, { posts: allPosts(true) });
  }

  const hardDeleteProjectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/hard$/);
  if (hardDeleteProjectMatch && req.method === "DELETE") {
    const id = decodeURIComponent(hardDeleteProjectMatch[1]);
    hardDeleteProject(id);
    logAudit(db, req, user, "project_hard_delete", "project", id);
    return json(res, 200, { projects: allProjects(true) });
  }

  const deletePost = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (deletePost && req.method === "DELETE") {
    const id = decodeURIComponent(deletePost[1]);
    softDeletePost(id);
    logAudit(db, req, user, "post_soft_delete", "post", id);
    return json(res, 200, { posts: allPosts(true) });
  }

  const deleteProject = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (deleteProject && req.method === "DELETE") {
    const id = decodeURIComponent(deleteProject[1]);
    softDeleteProject(id);
    logAudit(db, req, user, "project_soft_delete", "project", id);
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
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(target);
  const isCodeAsset = /\.(css|js|webmanifest)$/i.test(target);
  const cacheControl = ext === ".html" || isCodeAsset ? "no-cache" : isImage ? "public, max-age=604800" : "public, max-age=300";
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
    if (url.pathname === "/healthz") return json(res, 200, healthPayload());
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

