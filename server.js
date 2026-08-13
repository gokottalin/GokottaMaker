const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { logAudit } = require("./lib/audit");
const { createAuth } = require("./lib/auth");
const { createContentStore, focusScopeForContent, isContentInFocusScope } = require("./lib/content");
const { createDatabase } = require("./lib/db");
const { createSeo } = require("./lib/seo");
const { createUploadStore } = require("./lib/uploads");
const { inspectMarkdown, markdownToDocx } = require("./lib/md2doc");
const {
  validatePostPayload,
  validateProjectPayload,
  validateKnowledgeNodePayload,
  validateFormulaBusinessPayload,
  validateFormulaCardPayload,
  validateFormulaClassificationPayload,
  validateFormulaDecisionPayload,
  validateFormulaDerivationPayload,
  validateFocusModePayload,
  validateCarouselBufferRestorePayload,
  validateFormulaCatalogPackage,
  validateFormulaRelationRepairEventPayload,
  validateLatexSelection,
  validateSourceHash,
  validateUploadPayload
} = require("./lib/validators");
const { writeSnapshotFile } = require("./tools/calculation-book/formula-catalog");

const root = __dirname;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
const dbDir = path.resolve(process.env.DB_DIR || path.join(dataDir, "database"));
const dbPath = path.resolve(process.env.DB_PATH || path.join(dbDir, "gokottamaker.sqlite"));
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(dataDir, "uploads"));
const backupRoot = path.resolve(process.env.BACKUP_ROOT || "/srv/gokottamaker-backups");
const formulaBackupDir = path.resolve(process.env.FORMULA_BACKUP_DIR || path.join(os.homedir(), "LarkixFormulaBackups"));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "";
const adminUsername = process.env.ADMIN_USERNAME || "Larkix";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-before-public-deploy";
const resetAdminPassword = process.env.ADMIN_RESET_PASSWORD_ON_START === "true";
const privateCmsPath = String(process.env.PRIVATE_CMS_PATH || "").trim().replace(/^\/+|\/+$/g, "");
const allowInsecurePrivateCmsLoopback = process.env.ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK === "true";
const allowHardDelete = process.env.ALLOW_HARD_DELETE === "true";
const maxBackupAgeHours = Number(process.env.MAX_BACKUP_AGE_HOURS || 26);
const offsiteBackupTarget = process.env.OFFSITE_BACKUP_TARGET || "";
const startedAt = new Date();

if (!process.env.ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Use a strong password in production.");
}

function validPrivateCmsPath(value) {
  if (!/^[A-Za-z0-9_-]{48,128}$/.test(value)) return false;
  const characterClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[_-]/].filter((pattern) => pattern.test(value)).length;
  return characterClasses >= 2 && new Set(value).size >= 12;
}

if (privateCmsPath && !validPrivateCmsPath(privateCmsPath)) {
  throw new Error("PRIVATE_CMS_PATH must be a 48-128 character high-entropy URL-safe segment.");
}
if (process.env.NODE_ENV === "production" && !privateCmsPath) {
  throw new Error("PRIVATE_CMS_PATH is required in production.");
}

const db = createDatabase({ root, dataDir, dbDir, dbPath, uploadDir });
const contentStore = createContentStore(db);
const auth = createAuth(db, { adminUsername, adminPassword, resetAdminPassword });
const uploadStore = createUploadStore(uploadDir);

const siteVersion = "V2.5.4";
const siteBuild = "20260814-0001";
const siteVersionLabel = `${siteVersion}+${siteBuild}`;
const siteUrl = (process.env.SITE_URL || "https://www.larkix.com").replace(/\/$/, "");
const elecVersion = "V1.3";
const elecInputLimitBytes = 200 * 1024;
const elecMaxCircuits = 10;
const elecTmpRoot = path.resolve(process.env.ELEC_TMP_DIR || path.join(dataDir, ".tmp", "gokotta-elec"));
const elecCoreDir = path.resolve(process.env.ELEC_CORE_DIR || path.join(root, "gokotta-elec-core"));
const md2docInputLimitBytes = 512 * 1024;

function loadSeedData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "posts.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "data", "seed.js"), "utf8"), sandbox);
  return {
    posts: sandbox.window.LARKIX_POSTS || [],
    projects: sandbox.window.LARKIX_PROJECTS || sandbox.window.LARKIX_SEED?.projects || []
  };
}

function seedContent() {
  const postCount = db.prepare("SELECT COUNT(*) AS count FROM posts").get().count;
  const projectCount = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
  const seed = loadSeedData();

  if (!postCount) {
    const insertPost = db.prepare(`
      INSERT INTO posts (id, slug, title, category, category_key, recommendation_priority, excerpt, cover, markdown, read_time, date, publish_status, featured, featured_order, tags, created_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    const insertHeroSlot = db.prepare(`
      INSERT INTO hero_carousel_slots
        (slot, content_type, content_id, content_title, assignment_source)
      VALUES (?, 'post', ?, ?, 'seed')
    `);
    seed.posts.forEach((post, index) => {
      insertPost.run(
        post.id,
        post.slug || post.id,
        post.title,
        post.category,
        post.categoryKey,
        Number(post.recommendationPriority || 100),
        post.excerpt || "",
        post.cover || "",
        post.markdown || "",
        post.readTime || "",
        post.date || "",
        index < 4 ? 1 : 0,
        index,
        post.tags || "",
        post.date || new Date().toISOString()
      );
      if (index < 4) insertHeroSlot.run(index, post.id, post.title || "");
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
    SET tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
        recommendation_priority = CASE WHEN recommendation_priority IS NULL OR recommendation_priority = 100 THEN ? ELSE recommendation_priority END,
        created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
        published_at = CASE WHEN publish_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP) ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
      AND (
        tags IS NULL
        OR tags = ''
        OR recommendation_priority IS NULL
        OR recommendation_priority = 100
        OR created_at IS NULL
        OR (publish_status = 'published' AND published_at IS NULL)
      )
  `);
  seed.posts.forEach((post) => {
    updateSeedPost.run(post.tags || "", Number(post.recommendationPriority || 100), post.id);
  });

  const updateSeedProject = db.prepare(`
    UPDATE projects
    SET date = CASE WHEN date IS NULL OR date = '' THEN ? ELSE date END,
        version = CASE WHEN version IS NULL OR version = '' THEN ? ELSE version END,
        progress = CASE WHEN progress IS NULL OR progress = 0 THEN ? ELSE progress END,
        tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
        created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
        published_at = CASE WHEN visibility_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP) ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
  `);
  seed.projects.forEach((project) => {
    updateSeedProject.run(
      project.date || "",
      project.version || "",
      Number(project.progress || 0),
      project.tags || "",
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
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
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

function readBody(req, limitBytes = 25_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let overflowError = null;
    req.on("data", (chunk) => {
      if (overflowError) return;
      const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += piece.length;
      if (totalBytes > limitBytes) {
        overflowError = new Error("Payload too large");
        overflowError.status = 413;
        return;
      }
      chunks.push(piece);
    });
    req.on("end", () => {
      if (overflowError) {
        reject(overflowError);
        return;
      }
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        const error = new Error("请求数据格式不正确");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", (error) => reject(overflowError || error));
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
  return auth.currentUser(cookies(req)[sessionCookieName]);
}

function publicUser(user) {
  return auth.publicUser(user);
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    if (req.privateCmsRequest) serveNotFound(res);
    else json(res, 401, { error: "unauthorized" });
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
  const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return req.socket.encrypted === true || (isLoopbackAddress(req.socket.remoteAddress) && forwardedProtocol === "https");
}

function isLoopbackAddress(value) {
  const address = String(value || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
}

function privateCmsTransportAllowed(req) {
  return isHttps(req) || (
    allowInsecurePrivateCmsLoopback &&
    isLoopbackAddress(req.socket.remoteAddress) &&
    isLoopbackAddress(req.socket.localAddress)
  );
}

function privateCmsBasePath() {
  return privateCmsPath ? `/${privateCmsPath}` : "";
}

const sessionCookieName = privateCmsPath
  ? `gokottamaker_session_${crypto.createHash("sha256").update(privateCmsPath).digest("hex").slice(0, 12)}`
  : "gokottamaker_session";

function privateCmsRoute(pathname) {
  const base = privateCmsBasePath();
  if (!base || (pathname !== base && !pathname.startsWith(`${base}/`))) return null;
  const requested = pathname.slice(base.length) || "/";
  if (requested === "/") return { type: "not_found" };
  if (requested.startsWith("/api/")) return { type: "api", pathname: requested };
  return { type: "static", pathname: requested };
}

function cookieHeader(token, req) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=${privateCmsBasePath() || "/"}; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

const {
  withTransaction,
  allPosts: allStoredPosts,
  allProjects: allStoredProjects,
  listHeroCarouselSlots,
  listHeroCarouselSlotConflicts,
  listCarouselFocusBuffer,
  carouselFocusBufferById,
  reconcileCarouselFocusBuffer,
  restoreCarouselFocusBuffer,
  removeCarouselFocusBuffer,
  allKnowledgeNodes,
  listFormulaCards,
  listFormulaClassifications,
  publicFormulaCardBySlug,
  resolveLegacyFormulaRedirect,
  adminFormulaCard,
  listFormulaReferenceDecisions: listStoredFormulaReferenceDecisions,
  listFormulaRelationRepairs,
  appendFormulaRelationRepairEvent,
  saveFormulaDerivation,
  saveFormulaClassification,
  saveFormulaCard,
  createFormulaCard,
  updateFormulaCard,
  publishFormulaCard,
  archiveFormulaCard,
  restoreFormulaCard,
  exportFormulaCatalog,
  importFormulaCatalog,
  createFormulaFromSelection,
  resolveFormulaReferenceDecision,
  postById,
  projectById,
  publicKnowledgeNodeBySlug,
  adminKnowledgeNode,
  listRevisions,
  listKnowledgeNodeRevisions,
  restoreRevision,
  restoreKnowledgeNodeRevision,
  savePost,
  saveProject,
  saveKnowledgeNode,
  restorePost,
  restoreProject,
  restoreKnowledgeNode,
  hardDeletePost,
  hardDeleteProject,
  softDeletePost,
  softDeleteProject,
  softDeleteKnowledgeNode
} = contentStore;
const { saveUpload, uploads } = uploadStore;

function focusModeEnabled() {
  return publicFocusMode().enabled === true;
}

function focusAccessDecision(item, contentType = item?.type || "") {
  if (!focusModeEnabled()) {
    return { allowed: true, reasonCode: "FOCUS_MODE_DISABLED", scope: focusScopeForContent(item, contentType) };
  }
  const scope = focusScopeForContent(item, contentType);
  return {
    allowed: isContentInFocusScope(item, contentType),
    reasonCode: isContentInFocusScope(item, contentType) ? "FOCUS_SCOPE_ALLOWED" : "FOCUS_SCOPE_OUTSIDE",
    scope
  };
}

function allPosts(admin = false) {
  const items = allStoredPosts(admin);
  if (admin) return items;
  const visible = focusModeEnabled() ? items.filter((item) => focusAccessDecision(item, "post").allowed) : items;
  return visible.map(publicPostPayload);
}

function allProjects(admin = false) {
  const items = allStoredProjects(admin);
  if (admin) return items;
  const visible = focusModeEnabled() ? items.filter((item) => focusAccessDecision(item, "project").allowed) : items;
  return visible.map(publicProjectPayload);
}

function listFormulaReferenceDecisions(filters = {}) {
  const decisions = listStoredFormulaReferenceDecisions(filters);
  if (!focusModeEnabled()) return decisions;
  const visiblePostIds = new Set(allPosts(false).map((post) => post.id));
  return decisions.filter((decision) => visiblePostIds.has(decision.postId));
}

function assertFocusWriteAllowed(contentType, payload, options = {}) {
  if (!focusModeEnabled()) return;
  const existing =
    contentType === "post"
      ? postById(payload.id)
      : contentType === "project"
        ? projectById(payload.id)
        : null;
  if (existing && !focusAccessDecision(existing, contentType).allowed) {
    throw apiError(404, "content not found");
  }
  const decision = focusAccessDecision(payload, contentType);
  if (!decision.allowed) {
    const error = apiError(409, "聚焦模式已开启，只能写入电子基础、公式推导或开源项目范围");
    error.reasonCode = decision.reasonCode;
    throw error;
  }
  if (options.requireExisting && !existing) throw apiError(404, "content not found");
}

function focusScopeCounts() {
  const rawPosts = allStoredPosts(true);
  const rawProjects = allStoredProjects(true);
  return {
    posts: { visible: allPosts(false).length, stored: rawPosts.length },
    projects: { visible: allProjects(false).length, stored: rawProjects.length },
    knowledgeNodes: { visible: allKnowledgeNodes(true).length, stored: allKnowledgeNodes(true).length }
  };
}

function carouselBufferPayload() {
  const focusEnabled = focusModeEnabled();
  return listCarouselFocusBuffer().map((buffer) => {
    const linked = buffer.linkedContent;
    const eligible =
      buffer.referenceStatus === "available" &&
      isContentInFocusScope(linked, buffer.contentType);
    let restoreReasonCode = "CAROUSEL_RESTORE_ALLOWED";
    let restoreMessage = "请选择一个空槽位后手动恢复。";
    if (buffer.referenceStatus === "missing") {
      restoreReasonCode = "CAROUSEL_REFERENCE_MISSING";
      restoreMessage = "关联内容已缺失，只能从缓冲区移除记录。";
    } else if (buffer.referenceStatus === "archived") {
      restoreReasonCode = "CAROUSEL_REFERENCE_ARCHIVED";
      restoreMessage = "关联内容已归档或在回收站，不能恢复到轮播。";
    } else if (focusEnabled && !eligible) {
      restoreReasonCode = "CAROUSEL_RESTORE_BLOCKED_FOCUS_SCOPE_OUTSIDE";
      restoreMessage = "聚焦模式已开启，当前内容不属于电子基础、公式推导或开源项目，不能恢复。";
    }
    return {
      bufferId: buffer.bufferId,
      contentType: buffer.contentType,
      contentId: buffer.contentId,
      contentSlug: buffer.contentSlug,
      contentTitle: buffer.contentTitle,
      imageReference: buffer.imageReference,
      originalSlot: buffer.originalSlot,
      bufferedReason: buffer.bufferedReason,
      status: buffer.status,
      bufferedAt: buffer.bufferedAt,
      updatedAt: buffer.updatedAt,
      restoredAt: buffer.restoredAt,
      removedAt: buffer.removedAt,
      referenceStatus: buffer.referenceStatus,
      displayTitle: buffer.displayTitle,
      displayImage: buffer.displayImage,
      currentPublishStatus: linked
        ? buffer.contentType === "project"
          ? linked.visibilityStatus
          : linked.publishStatus
        : "",
      focusEligible: eligible,
      restoreAllowed: buffer.referenceStatus === "available" && (!focusEnabled || eligible),
      restoreReasonCode,
      restoreMessage
    };
  });
}

function carouselAdminPayload() {
  const activeItems = carouselItems();
  const buffered = carouselBufferPayload();
  const conflicts = listHeroCarouselSlotConflicts();
  return {
    activeItems,
    buffered,
    conflicts,
    summary: {
      activeCount: activeItems.length,
      bufferedCount: buffered.length,
      conflictCount: conflicts.length,
      focusEnabled: focusModeEnabled()
    }
  };
}

function publicPostByIdentity(identity) {
  return allPosts(false).find((post) => post.id === identity || post.slug === identity) || null;
}

function publicProjectByIdentity(identity) {
  return allProjects(false).find((project) => project.id === identity || project.slug === identity) || null;
}

const seo = createSeo({ siteUrl, allPosts, allProjects, text });

function focusXmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function focusedSitemap(res) {
  const pages = [
    { loc: `${siteUrl}/`, priority: "1.0" },
    { loc: `${siteUrl}/maker.html`, priority: "0.95" },
    { loc: `${siteUrl}/category.html?category=electronics-basics`, priority: "0.9" },
    { loc: `${siteUrl}/derive.html`, priority: "0.85" },
    { loc: `${siteUrl}/projects.html`, priority: "0.8" },
    { loc: `${siteUrl}/miniapps.html`, priority: "0.75" },
    { loc: `${siteUrl}/tools/md2doc.html`, priority: "0.7" },
    ...allPosts(false).map((post) => ({
      loc: `${siteUrl}/post.html?id=${encodeURIComponent(post.id)}`,
      priority: "0.7",
      lastmod: post.publishedAt || post.date
    })),
    ...allProjects(false).map((project) => ({
      loc: `${siteUrl}/project.html?id=${encodeURIComponent(project.id)}`,
      priority: "0.7",
      lastmod: project.publishedAt || project.date
    }))
  ];
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${focusXmlEscape(page.loc)}</loc>
    ${page.lastmod ? `<lastmod>${focusXmlEscape(String(page.lastmod).slice(0, 10))}</lastmod>` : ""}
    <priority>${page.priority}</priority>
  </url>`
    )
    .join("\n");
  return text(
    res,
    200,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "application/xml; charset=utf-8"
  );
}

function contentScript(res) {
  const body = `window.LARKIX_SERVER_CONTENT = ${JSON.stringify(publicContentPayload())};`;
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(body);
}

function exportContent() {
  return {
    site: {
      name: "LarkixMaker",
      url: siteUrl,
      version: siteVersion,
      build: siteBuild,
      versionLabel: siteVersionLabel
    },
    exportedAt: new Date().toISOString(),
    posts: allStoredPosts(true),
    projects: allStoredProjects(true),
    knowledgeNodes: allKnowledgeNodes(true),
    siteLayout: siteLayout(),
    publicFocusMode: publicFocusMode(),
    uploads: uploads()
  };
}

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function rejectFormulaIdentityOverride(payload) {
  const input = payload && typeof payload === "object" ? payload : {};
  const forbidden = ["formulaId", "formula_id", "slug"].find((key) =>
    Object.prototype.hasOwnProperty.call(input, key)
  );
  if (!forbidden) return;
  const error = apiError(400, `公式技术标识由服务端生成，普通创建或编辑请求不能提交 ${forbidden}`);
  error.reasonCode = "FORMULA_IDENTITY_SERVER_OWNED";
  throw error;
}

function formulaSnapshotPath(filename) {
  const value = String(filename || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,94}\.json$/i.test(value)) {
    throw apiError(400, "公式库快照文件名必须是安全的 .json 文件名");
  }
  const target = path.resolve(formulaBackupDir, value);
  if (path.dirname(target) !== formulaBackupDir) throw apiError(400, "公式库快照路径不合法");
  return target;
}

function generatedFormulaIdentity() {
  const token = crypto.randomUUID();
  return {
    formulaId: `formula.user.${token}`,
    slug: `user-formula-${token}`
  };
}

function elecDiagnostic(level, code, message, extra = {}) {
  return { level, code, message, ...extra };
}

function elecResponse(res, status, payload) {
  return json(res, status, {
    version: elecVersion,
    diagnostics: [],
    ...payload
  });
}

function elecCoreReady() {
  const scriptPath = path.join(elecCoreDir, "scripts", "build-paste.mjs");
  const samplesDir = path.join(elecCoreDir, "samples");
  return fs.existsSync(scriptPath) && fs.existsSync(samplesDir);
}

function slugifySampleId(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sampleTitle(filename) {
  return path.basename(filename, path.extname(filename)).replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function elecSamples() {
  if (!elecCoreReady()) {
    return {
      ok: false,
      samples: [],
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "LarkixElec 核心目录不可用。")]
    };
  }

  try {
    const samplesDir = path.join(elecCoreDir, "samples");
    const samples = fs.readdirSync(samplesDir)
      .filter((filename) => /\.txt$/i.test(filename))
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => ({
        id: slugifySampleId(filename),
        title: sampleTitle(filename),
        source: fs.readFileSync(path.join(samplesDir, filename), "utf8")
      }));

    return { ok: true, samples, diagnostics: [] };
  } catch (error) {
    return {
      ok: false,
      samples: [],
      diagnostics: [elecDiagnostic("ERROR", "SAMPLES_UNAVAILABLE", "Sample 文件不可用。", { detail: error.message })]
    };
  }
}

const elecBasicHandoffFiles = [
  { relativePath: "llm-handoff/README_先读_给其他LLM的文件说明.md", title: "文件说明", fence: "markdown" },
  { relativePath: "llm-handoff/01_必需_系统提示词_直接复制给LLM.txt", title: "必需：系统提示词", fence: "text" },
  { relativePath: "llm-handoff/02_必需_CNL输出契约_必须遵守.md", title: "必需：CNL 输出契约", fence: "markdown" },
  { relativePath: "llm-handoff/03_可选增强_输出模板_让LLM套用.txt", title: "推荐：输出模板", fence: "text" }
];

const elecFullHandoffFiles = [
  ...elecBasicHandoffFiles,
  { relativePath: "llm-handoff/11_可选增强_完整器件库_端子和边界条件.json", title: "完整器件库：端子和边界条件", fence: "json" },
  { relativePath: "llm-handoff/12_可选增强_型号封装引脚库_PinMap.json", title: "型号封装引脚库 PinMap", fence: "json" },
  { relativePath: "schema/circuit-ir.schema.json", title: "IR Schema", fence: "json" },
  { relativePath: "docs/circuit-cnl-v0.1.md", title: "CNL 语法说明", fence: "markdown" },
  { relativePath: "docs/llm-cnl-contract-v0.1.md", title: "LLM CNL 契约", fence: "markdown" },
  { relativePath: "docs/erc-rules-v0.1.md", title: "ERC 规则", fence: "markdown" },
  { relativePath: "docs/component-library-notes-v0.1.md", title: "器件库说明", fence: "markdown" },
  { relativePath: "samples/Sample-01-voltage-divider.txt", title: "Sample 01：电阻分压", fence: "text" },
  { relativePath: "samples/Sample-02-npn-low-side-switch.txt", title: "Sample 02：NPN 低边 LED 开关", fence: "text" },
  { relativePath: "samples/Sample-03-pnp-high-side-switch.txt", title: "Sample 03：PNP 高边 LED 开关", fence: "text" },
  { relativePath: "samples/Sample-04-cmos-inverter-nmos-pmos.txt", title: "Sample 04：NMOS + PMOS CMOS 反相器", fence: "text" },
  { relativePath: "samples/Sample-05-opamp-noninverting-amplifier.txt", title: "Sample 05：运放同相放大器", fence: "text" }
];

function appendElecHandoffFile(lines, file) {
  const filePath = path.join(elecCoreDir, file.relativePath);
  lines.push(`## ${file.title}`, "", `来源：\`${file.relativePath}\``, "");

  if (!fs.existsSync(filePath)) {
    lines.push(`> 文件不存在：${file.relativePath}`, "");
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  lines.push(`\`\`\`\`${file.fence}`);
  lines.push(content.endsWith("\n") ? content.trimEnd() : content);
  lines.push("````", "");
}

function buildElecHandoffMarkdown(mode) {
  const full = mode === "full";
  const title = full ? "LarkixElec LLM 完整交接" : "LarkixElec LLM 基础交接";
  const lines = [
    `# ${title}`,
    "",
    `- 当前版本：${elecVersion}`,
    "- 用途：把 LLM 输出的 CNL 电路描述交给 LarkixElec，生成 SVG 原理图、IR JSON 与 ERC 诊断。",
    "- 建议：先阅读格式约束，再输出可被工具直接解析的 CNL。",
    "",
    full ? "## 完整上下文" : "## 快速上下文",
    "",
    full
      ? "下面包含 CNL 输入规范、样例、工具契约和常见诊断说明，适合需要完整生成或排查电路文本时使用。"
      : "下面包含最小必要的 CNL 格式说明和示例，适合快速生成可预览的电路文本。",
    ""
  ];

  const files = full ? elecFullHandoffFiles : elecBasicHandoffFiles;
  files.forEach((file) => appendElecHandoffFile(lines, file));
  return `${lines.join("\n")}\n`;
}

function elecHandoff(req, res) {
  if (!elecCoreReady()) {
    return elecResponse(res, 503, {
      ok: false,
      markdown: "",
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "LarkixElec 核心不可用。")]
    });
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = url.searchParams.get("mode") === "full" ? "full" : "basic";
  try {
    return elecResponse(res, 200, {
      ok: true,
      mode,
      markdown: buildElecHandoffMarkdown(mode)
    });
  } catch (error) {
    return elecResponse(res, 500, {
      ok: false,
      mode,
      markdown: "",
      diagnostics: [elecDiagnostic("ERROR", "LLM_HANDOFF_UNAVAILABLE", "LLM 交接内容生成失败。", { detail: error.message })]
    });
  }
}

function countCnlCircuits(source) {
  const matches = String(source || "").match(/(^|\n)\s*电路\s+[A-Za-z][A-Za-z0-9_-]*\s+版本\s+[0-9]+\.[0-9]+\.[0-9]+/gu);
  return matches ? matches.length : 0;
}

function readFirstFile(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = readFirstFile(entryPath, predicate);
      if (nested) return nested;
    } else if (entry.isFile() && predicate(entryPath)) {
      return entryPath;
    }
  }
  return "";
}

function readCircuitArtifacts(dir) {
  const irPath = readFirstFile(dir, (target) => target.endsWith(".ir.json"));
  const svgPath = readFirstFile(dir, (target) => target.endsWith(".svg"));
  const ercPath = readFirstFile(dir, (target) => target.endsWith(".erc.txt"));
  const buildErrorPath = readFirstFile(dir, (target) => /(?:build|render)-error\.txt$/i.test(target));
  const ir = irPath ? JSON.parse(fs.readFileSync(irPath, "utf8")) : null;
  const svg = svgPath ? fs.readFileSync(svgPath, "utf8") : "";
  const erc = ercPath ? fs.readFileSync(ercPath, "utf8") : "";
  const buildError = buildErrorPath ? fs.readFileSync(buildErrorPath, "utf8") : "";
  return { ir, svg, erc, buildError };
}

function parseErcDiagnostics(ercText) {
  if (!ercText || ercText.trim() === "OK") return [];
  return ercText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(INFO|WARNING|ERROR):\s*([^:]+):\s*(.*)$/);
    if (!match) return elecDiagnostic("INFO", "ERC", line);
    return elecDiagnostic(match[1], match[2].trim(), match[3].trim());
  });
}

function parseBuildOutput(outputDir) {
  const summaryPath = path.join(outputDir, "summary.txt");
  const summary = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, "utf8") : "";
  const circuitDirs = fs.readdirSync(outputDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const circuits = [];
  const diagnostics = [];

  for (const entry of circuitDirs) {
    const dir = path.join(outputDir, entry.name);
    const circuitId = entry.name.replace(/^\d+-/, "").toUpperCase();
    const artifacts = readCircuitArtifacts(dir);
    const ercDiagnostics = parseErcDiagnostics(artifacts.erc);
    const svgLooksValid = artifacts.svg.trimStart().startsWith("<svg");
    const ok = Boolean(artifacts.ir && svgLooksValid && !ercDiagnostics.some((item) => item.level === "ERROR") && !artifacts.buildError);

    if (artifacts.buildError) {
      diagnostics.push(elecDiagnostic("ERROR", "ELEC_BUILD", artifacts.buildError.trim().slice(0, 2000), { target: circuitId }));
    }
    if (artifacts.svg && !svgLooksValid) {
      diagnostics.push(elecDiagnostic("ERROR", "SVG_INVALID", "SVG 输出无效。", { target: circuitId }));
    }
    diagnostics.push(...ercDiagnostics.map((item) => ({ ...item, target: item.target || circuitId })));

    circuits.push({
      id: circuitId,
      ok,
      svg: svgLooksValid ? artifacts.svg : "",
      ir: artifacts.ir || {},
      erc: artifacts.erc || "",
      warnings: ercDiagnostics.filter((item) => item.level === "WARNING")
    });
  }

  if (summary && circuits.length === 0) {
    diagnostics.push(elecDiagnostic("ERROR", "ELEC_BUILD_EMPTY", summary.trim()));
  }

  const firstOk = circuits.find((item) => item.ok) || circuits[0] || null;
  return {
    ok: circuits.length > 0 && circuits.every((item) => item.ok) && !diagnostics.some((item) => item.level === "ERROR"),
    circuits,
    artifacts: firstOk ? { svg: firstOk.svg, ir: firstOk.ir, ercText: firstOk.erc } : {},
    diagnostics
  };
}

function publicProjectPreview(project) {
  return {
    id: project.id,
    slug: project.slug || project.id,
    type: "project",
    title: project.title,
    status: project.status,
    statusKey: project.statusKey,
    summary: project.summary || "",
    cover: project.cover || "",
    license: project.license || "",
    stars: Number(project.stars || 0),
    date: project.date || "",
    version: project.version || "",
    progress: Number(project.progress || 0),
    tags: project.tags || ""
  };
}

function publicFormulaBindingPayload(binding) {
  return {
    bindingId: binding.bindingId,
    formulaId: binding.formulaId,
    revisionId: binding.revisionId,
    displayMode: binding.displayMode,
    ordinal: Number(binding.ordinal || 0),
    slug: binding.slug || "",
    displayName: binding.displayName || "",
    latex: binding.latex || ""
  };
}

function publicPostPayload(post) {
  return {
    id: post.id,
    slug: post.slug || post.id,
    type: "post",
    title: post.title,
    category: post.category || "",
    categoryKey: post.categoryKey || "",
    recommendationPriority: Number(post.recommendationPriority || 0),
    excerpt: post.excerpt || "",
    cover: post.cover || "",
    coverCrop: post.coverCrop || null,
    markdown: post.markdown || "",
    readingMinutes: post.readingMinutes == null ? null : Number(post.readingMinutes),
    date: post.date || "",
    featured: Boolean(post.featured),
    featuredOrder: Number(post.featuredOrder || 0),
    formulaBindings: (post.formulaBindings || []).map(publicFormulaBindingPayload)
  };
}

function publicProjectPayload(project) {
  return {
    ...publicProjectPreview(project),
    markdown: project.markdown || "",
    repoUrl: project.repoUrl || "",
    bomUrl: project.bomUrl || "",
    docsUrl: project.docsUrl || "",
    featured: Boolean(project.featured),
    featuredOrder: Number(project.featuredOrder || 0)
  };
}

function publicProjectDirectory() {
  if (focusModeEnabled()) return allProjects(false).map(publicProjectPreview);
  const seedProjects = loadSeedData().projects || [];
  const projectMap = new Map(seedProjects.map((project) => [project.id, publicProjectPreview(project)]));
  for (const project of allProjects(false)) {
    if (project.deletedAt) continue;
    if (!projectMap.has(project.id)) continue;
    projectMap.set(project.id, publicProjectPreview(project));
  }
  return [...projectMap.values()];
}

function publicUploadPaths() {
  return new Set(
    [
      ...allPosts(false).map((item) => item.cover),
      ...allProjects(false).map((item) => item.cover),
      ...allKnowledgeNodes(false).map((item) => item.cover),
      ...publicCarouselItems().map((item) => item.cover)
    ]
      .map((value) => String(value || "").split(/[?#]/)[0])
      .filter((value) => value.startsWith("/uploads/") || value.startsWith("./uploads/"))
      .map((value) => value.replace(/^\./, ""))
  );
}

const defaultSiteLayout = {
  home: [
    { key: "hero", label: "首页首屏", order: 1, visible: true, size: "hero" },
    { key: "recommended", label: "推荐内容", order: 2, visible: true, size: "wide" },
    { key: "projects", label: "开源项目", order: 3, visible: true, size: "wide" },
    { key: "miniapps", label: "网页小程序", order: 4, visible: true, size: "wide" }
  ],
  category: [
    { key: "categoryHeader", label: "分类页标题与搜索", order: 1, visible: true, size: "compact" },
    { key: "courseContent", label: "课程内容与推荐", order: 2, visible: true, size: "hero" }
  ],
  projectsPage: [
    { key: "projectsHeader", label: "开源项目页标题", order: 1, visible: true, size: "compact" },
    { key: "projectList", label: "项目列表", order: 2, visible: true, size: "hero" }
  ],
  miniappsPage: [
    { key: "miniappsHeader", label: "小程序中心标题", order: 1, visible: true, size: "compact" },
    { key: "miniappRegistry", label: "小程序列表", order: 2, visible: true, size: "hero" }
  ],
  postPage: [
    { key: "postHero", label: "文章详情头图", order: 1, visible: true, size: "wide" },
    { key: "postBody", label: "文章正文与目录", order: 2, visible: true, size: "hero" }
  ],
  projectDetailPage: [
    { key: "projectHero", label: "项目详情头图", order: 1, visible: true, size: "wide" },
    { key: "projectBody", label: "项目正文与目录", order: 2, visible: true, size: "hero" }
  ]
};

const requiredPublicLayoutSections = {
  home: new Set(["miniapps"]),
  miniappsPage: new Set(["miniappsHeader", "miniappRegistry"])
};

const defaultPublicFocusMode = {
  enabled: true,
  ownerConfigured: false,
  primaryScope: "electronics-basics",
  visibleScopes: ["electronics-basics", "derivations", "projects"],
  scopeAliases: { "power-electronics": "electronics-basics" },
  homepageOrder: ["electronics-basics", "derivations", "projects"],
  hideMiniappsFromPrimaryNav: false,
  hideAdminFromPublicNav: true,
  noindexHiddenLandingPages: true,
  noindexHiddenDetailPages: true,
  homepageMode: "focused",
  bannerCopy: "",
  schemaVersion: 2
};

function siteSetting(key, fallback) {
  const row = db.prepare("SELECT value_json AS valueJson FROM site_settings WHERE key = ?").get(key);
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.valueJson) };
  } catch {
    return fallback;
  }
}

function normalizeSiteLayout(payload = {}) {
  function layoutSize(value) {
    return ["compact", "standard", "wide", "hero"].includes(value) ? value : "standard";
  }

  return Object.fromEntries(
    Object.entries(defaultSiteLayout).map(([pageKey, sections]) => {
      const rows = Array.isArray(payload[pageKey]) ? payload[pageKey] : [];
      const rowMap = new Map(rows.map((item) => [item.key, item]));
      return [
        pageKey,
        sections.map((base) => {
          const item = rowMap.get(base.key) || {};
          return {
            ...base,
            order: Math.max(1, Math.min(99, Number(item.order || base.order))),
            visible: requiredPublicLayoutSections[pageKey]?.has(base.key) ? true : item.visible !== false,
            size: layoutSize(item.size || base.size)
          };
        })
      ];
    })
  );
}

function siteLayout() {
  return normalizeSiteLayout(siteSetting("site_layout", defaultSiteLayout));
}

function publicSiteLayout() {
  return Object.fromEntries(
    Object.entries(siteLayout()).map(([pageKey, sections]) => [
      pageKey,
      sections.map((section) => ({
        key: section.key,
        order: section.order,
        visible: section.visible,
        size: section.size
      }))
    ])
  );
}

function publicFocusMode() {
  const stored = siteSetting("public_focus_mode", defaultPublicFocusMode);
  return {
    ...defaultPublicFocusMode,
    enabled: stored.enabled !== false,
    ownerConfigured: stored.ownerConfigured === true,
    hideMiniappsFromPrimaryNav: false
  };
}

function savePublicFocusMode(payload) {
  const previous = publicFocusMode();
  const next = {
    ...defaultPublicFocusMode,
    enabled: payload.enabled === true,
    ownerConfigured: true
  };
  db.prepare(
    `INSERT INTO site_settings (key, value_json, updated_at)
     VALUES ('public_focus_mode', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP`
  ).run(JSON.stringify(next));
  return { previous, current: publicFocusMode() };
}

function saveSiteLayout(payload) {
  const normalized = normalizeSiteLayout(payload);
  db.prepare(
    `INSERT INTO site_settings (key, value_json, updated_at)
     VALUES ('site_layout', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP`
  ).run(JSON.stringify(normalized));
  return normalized;
}

function publicContentPayload() {
  const focusMode = publicFocusMode();
  return {
    posts: allPosts(false),
    projects: allProjects(false),
    heroCarousel: publicCarouselItems(),
    projectDirectory: publicProjectDirectory(),
    siteLayout: publicSiteLayout(),
    publicFocusMode: { enabled: focusMode.enabled }
  };
}

function spawnElecBuild(inputPath, outputDir) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, [
      path.join(elecCoreDir, "scripts", "build-paste.mjs"),
      inputPath,
      outputDir
    ], {
      cwd: elecCoreDir,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, signal: "", stdout, stderr: error.message });
    });
  });
}

async function elecBuild(res, body) {
  if (!elecCoreReady()) {
    return elecResponse(res, 503, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "LarkixElec 核心不可用。")]
    });
  }

  const source = typeof body.source === "string" ? body.source : "";
  const sourceBytes = Buffer.byteLength(source, "utf8");
  if (!source.trim()) {
    return elecResponse(res, 400, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "SOURCE_REQUIRED", "source 内容不能为空。")]
    });
  }
  if (sourceBytes > elecInputLimitBytes) {
    return elecResponse(res, 413, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "SOURCE_TOO_LARGE", "单次输入内容不能超过 200 KB。")]
    });
  }
  const circuitCount = countCnlCircuits(source);
  if (circuitCount > elecMaxCircuits) {
    return elecResponse(res, 400, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "TOO_MANY_CIRCUITS", "单次最多生成 10 个电路。")]
    });
  }

  fs.mkdirSync(elecTmpRoot, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(elecTmpRoot, "run-"));
  const inputPath = path.join(runDir, "input.cnl.txt");
  const outputDir = path.join(runDir, "output");
  fs.writeFileSync(inputPath, source, "utf8");

  try {
    const build = await spawnElecBuild(inputPath, outputDir);
    const parsed = fs.existsSync(outputDir)
      ? parseBuildOutput(outputDir)
      : { ok: false, circuits: [], artifacts: {}, diagnostics: [] };
    if (build.signal) {
      parsed.ok = false;
      parsed.diagnostics.push(elecDiagnostic("ERROR", "ELEC_BUILD_TIMEOUT", "LarkixElec 构建超时。"));
    }
    if (build.stderr.trim()) {
      parsed.diagnostics.push(elecDiagnostic(build.code === 0 ? "INFO" : "ERROR", "ELEC_STDERR", build.stderr.trim().slice(0, 2000)));
    }
    const hasError = parsed.diagnostics.some((item) => item.level === "ERROR");
    parsed.ok = Boolean(parsed.ok && !hasError);
    return elecResponse(res, parsed.ok ? 200 : 422, parsed);
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
}

function safeDownloadName(value, fallback) {
  const name = String(value || fallback || "document")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return name || fallback || "document";
}

function md2docResponse(res, status, payload) {
  return json(res, status, {
    version: "V0.4",
    diagnostics: [],
    ...payload
  });
}

function md2docConvert(res, body) {
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  const markdownBytes = Buffer.byteLength(markdown, "utf8");
  const format = typeof body.format === "string" ? body.format.trim().toLowerCase() : "docx";
  if (format !== "docx") {
    return md2docResponse(res, 400, {
      ok: false,
      diagnostics: [{ level: "ERROR", code: "FORMAT_UNSUPPORTED", message: "当前仅支持导出 DOCX，PDF 等格式将在后续版本接入。" }]
    });
  }
  if (!markdown.trim()) {
    return md2docResponse(res, 400, {
      ok: false,
      diagnostics: [{ level: "ERROR", code: "MARKDOWN_REQUIRED", message: "Markdown 内容不能为空。" }]
    });
  }
  if (markdownBytes > md2docInputLimitBytes) {
    return md2docResponse(res, 413, {
      ok: false,
      diagnostics: [{ level: "ERROR", code: "MARKDOWN_TOO_LARGE", message: "单次 Markdown 内容不能超过 512 KB。" }]
    });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const fileBase = safeDownloadName(body.filename || title, "md2file").replace(/\.docx$/i, "") || "md2file";
  const filename = `${fileBase}.docx`;
  const options = body && typeof body.options === "object" && body.options ? body.options : {};
  const inspection = inspectMarkdown(markdown);
  if (!inspection.valid) {
    return md2docResponse(res, 422, {
      ok: false,
      diagnostics: inspection.diagnostics.map((item) => ({
        ...item,
        level: String(item.severity || "error").toUpperCase()
      }))
    });
  }
  let docx;
  try {
    docx = markdownToDocx({ markdown, title, options });
  } catch (error) {
    if (Array.isArray(error.diagnostics)) {
      return md2docResponse(res, 422, {
        ok: false,
        diagnostics: error.diagnostics.map((item) => ({
          ...item,
          level: String(item.severity || "error").toUpperCase()
        }))
      });
    }
    throw error;
  }
  const asciiFilename =
    filename
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]+/g, "_")
      .replace(/["\\]+/g, "-") || "md2file.docx";
  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Length": docx.length
  });
  res.end(docx);
}

function carouselItems() {
  return listHeroCarouselSlots();
}

function publicCarouselItems() {
  const visible = new Map([
    ...allPosts(false).map((item) => [`post:${item.id}`, { ...item, contentType: "post" }]),
    ...allProjects(false).map((item) => [`project:${item.id}`, { ...item, contentType: "project" }])
  ]);
  return carouselItems()
    .map((slot) => {
      const item = visible.get(`${slot.contentType}:${slot.id}`);
      return item ? { ...item, featured: true, featuredOrder: slot.slot, slot: slot.slot } : null;
    })
    .filter(Boolean);
}

function assertCarouselSlot(payload, contentType) {
  if (!payload.featured) return;
  const buffered = listCarouselFocusBuffer().find(
    (item) => item.contentType === contentType && item.contentId === payload.id
  );
  if (buffered) {
    const error = apiError(409, "该内容仍在轮播缓冲区，请从缓冲区明确选择槽位恢复");
    error.reasonCode = "CAROUSEL_BUFFER_RESTORE_REQUIRED";
    throw error;
  }
  const order = Number(payload.featuredOrder || 0);
  const existing = carouselItems().filter((item) => !(item.contentType === contentType && item.id === payload.id));
  if (existing.length >= 4) {
    const error = apiError(409, "首页轮播四个槽位均已占用，请先明确释放一个槽位");
    error.reasonCode = "CAROUSEL_SLOTS_FULL";
    throw error;
  }
  const conflict = existing.find((item) => Number(item.slot) === order);
  if (conflict) {
    const error = apiError(409, `轮播槽位 ${order + 1} 已被《${conflict.title || "未命名内容"}》使用，请选择空槽位`);
    error.reasonCode = "CAROUSEL_SLOT_CONFLICT";
    throw error;
  }
}

function gitCommitFromMetadata() {
  try {
    let gitDir = path.join(root, ".git");
    if (fs.statSync(gitDir).isFile()) {
      const pointer = fs.readFileSync(gitDir, "utf8").trim().match(/^gitdir:\s*(.+)$/i);
      if (!pointer) return "";
      gitDir = path.resolve(root, pointer[1]);
    }

    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7);

    const ref = head.match(/^ref:\s*(.+)$/i)?.[1];
    if (!ref) return "";

    try {
      const commit = fs.readFileSync(path.join(gitDir, ...ref.split("/")), "utf8").trim();
      if (/^[0-9a-f]{7,40}$/i.test(commit)) return commit.slice(0, 7);
    } catch {
      const packedRefs = fs.readFileSync(path.join(gitDir, "packed-refs"), "utf8");
      const packedCommit = packedRefs
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .find(([commit, name]) => name === ref && /^[0-9a-f]{40}$/i.test(commit))?.[0];
      if (packedCommit) return packedCommit.slice(0, 7);
    }
  } catch {
    // The runtime may be installed from an archive without Git metadata.
  }
  return "";
}

function gitCommit() {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  const metadataCommit = gitCommitFromMetadata();
  if (metadataCommit) return metadataCommit;
  const candidates = [...new Set([process.env.GIT_BIN, "/usr/bin/git", "git"].filter(Boolean))];
  for (const executable of candidates) {
    try {
      return childProcess.execFileSync(executable, ["rev-parse", "--short", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch {
      // Try the next known Git executable.
    }
  }
  return "unknown";
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
    if (latest) {
      latest.bytes = directorySummary(latest.path).bytes;
      latest.ageHours = Math.round(((Date.now() - Date.parse(latest.updatedAt)) / 36_000)) / 100;
      latest.fresh = Number.isFinite(latest.ageHours) && latest.ageHours <= maxBackupAgeHours;
    }
    const warnings = [];
    if (!latest) warnings.push("no-backup-found");
    if (latest && !latest.fresh) warnings.push("latest-backup-stale");
    if (latest && !latest.hasManifest) warnings.push("latest-backup-missing-manifest");
    if (latest && !latest.hasChecksums) warnings.push("latest-backup-missing-checksums");
    if (!offsiteBackupTarget) warnings.push("offsite-backup-not-configured");

    return {
      root: backupRoot,
      exists: true,
      count: backups.length,
      latest,
      maxAgeHours: maxBackupAgeHours,
      ok: warnings.length === 0,
      warnings,
      offsiteConfigured: Boolean(offsiteBackupTarget)
    };
  } catch {
    return {
      root: backupRoot,
      exists: false,
      count: 0,
      latest: null,
      maxAgeHours: maxBackupAgeHours,
      ok: false,
      warnings: ["backup-root-unreadable"],
      offsiteConfigured: Boolean(offsiteBackupTarget)
    };
  }
}

function healthPayload({ detailed = false } = {}) {
  const database = databaseFilesSummary();
  const uploadsSummary = directorySummary(uploadDir);
  const payload = {
    ok: true,
    name: "LarkixMaker",
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
    allowHardDelete,
    maxBackupAgeHours,
    offsiteBackupConfigured: Boolean(offsiteBackupTarget),
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

function knowledgeNodeAuditMetadata(result) {
  const node = result?.node || {};
  const linkSummary = result?.linkSummary || {};
  return {
    slug: node.slug || "",
    publishStatus: node.publishStatus || "",
    visibilityStatus: node.visibilityStatus || "",
    accentColor: node.accentColor || "",
    linksCount: Number(linkSummary.linksCount || 0),
    danglingCount: Number(linkSummary.danglingCount || 0)
  };
}

function publicFormulaCardPayload(card) {
  if (!card) return null;
  const publicReference = (reference) => {
    if (!reference?.slug) return null;
    return {
      referenceKey: reference.slug,
      slug: reference.slug,
      displayName: reference.displayName || "",
      latex: reference.latex || "",
      available: true
    };
  };
  const derivation = card.derivation || {};
  const dependencies = (derivation.dependencies || []).map(publicReference).filter(Boolean);
  const incoming = (derivation.incoming || []).map(publicReference).filter(Boolean);
  const articleReferrers = (derivation.articleReferrers || [])
    .map((reference) => {
      const post = publicPostByIdentity(reference.postId || reference.slug);
      if (!post) return null;
      return {
        slug: post.slug || post.id,
        title: post.title || "",
        route: `./post.html?id=${encodeURIComponent(post.id)}`,
        referenceCount: Number(reference.referenceCount || 0)
      };
    })
    .filter(Boolean);
  const graph = (() => {
    if (!card.graph || !Array.isArray(card.graph.nodes) || !Array.isArray(card.graph.edges)) {
      return null;
    }
    const idMap = new Map();
    const nodes = card.graph.nodes
      .map((node) => {
        if (node.nodeType !== "article") {
          idMap.set(node.id, node.id);
          return {
            id: node.id,
            nodeType: "formula",
            slug: node.slug || node.id,
            displayName: node.displayName || "",
            latex: node.latex || "",
            rank: Number(node.rank || 0),
            direction: node.direction || "dependency",
            current: Boolean(node.current),
            initiallyVisible: Boolean(node.initiallyVisible)
          };
        }
        const post = publicPostByIdentity(node.slug || String(node.id || "").replace(/^article:/, ""));
        if (!post) return null;
        const publicId = `article:${post.slug || post.id}`;
        idMap.set(node.id, publicId);
        return {
          id: publicId,
          nodeType: "article",
          slug: post.slug || post.id,
          displayName: post.title || "",
          route: `./post.html?id=${encodeURIComponent(post.id)}`,
          referenceCount: Number(node.referenceCount || 0),
          rank: Number(node.rank || 0),
          direction: "article",
          current: false,
          initiallyVisible: Boolean(node.initiallyVisible)
        };
      })
      .filter(Boolean);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = card.graph.edges
      .map((edge) => ({
        id: edge.id,
        edgeType: edge.edgeType === "article_reference" ? "article_reference" : "formula_dependency",
        source: idMap.get(edge.source),
        target: idMap.get(edge.target),
        referenceCount:
          edge.edgeType === "article_reference" ? Number(edge.referenceCount || 0) : undefined,
        initiallyVisible: Boolean(edge.initiallyVisible)
      }))
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    return {
      mode: "published",
      currentNodeId: idMap.get(card.graph.currentNodeId) || card.graph.currentNodeId || "",
      nodes,
      edges,
      initialNodeIds: (card.graph.initialNodeIds || []).map((id) => idMap.get(id)).filter((id) => nodeIds.has(id)),
      expandableNodeIds: (card.graph.expandableNodeIds || []).map((id) => idMap.get(id) || id).filter((id) => nodeIds.has(id)),
      hiddenNodeCount: Math.max(0, Number(card.graph.hiddenNodeCount || 0)),
      truncated: Boolean(card.graph.truncated),
      limits: card.graph.limits || null
    };
  })();
  const dependencySlugByFormulaId = new Map(
    (derivation.dependencies || [])
      .filter((reference) => reference?.formulaId && reference?.slug)
      .map((reference) => [reference.formulaId, reference.slug])
  );
  const markdownDerivation = String(card.markdownDerivation || "").replace(
    /\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g,
    (shortcode, formulaId) => {
      const slug = dependencySlugByFormulaId.get(formulaId);
      return slug ? `{{formula-ref:${slug}}}` : "{{formula-ref-unavailable}}";
    }
  );
  return {
    slug: card.slug,
    displayName: card.displayName || "",
    moduleKey: card.moduleKey || "",
    categoryPath: card.categoryPath || "",
    purpose: card.purpose || "",
    tags: Array.isArray(card.tags) ? card.tags : [],
    latex: card.latex || "",
    markdownDerivation,
    sourceBookId: card.sourceBookId || "",
    sourceBookRevision: card.sourceBookRevision || "",
    sourceFormulaId: card.sourceFormulaId || "",
    publishedAt: card.publishedAt || "",
    derivation: {
      incoming,
      dependencies,
      articleReferrers,
      next: publicReference(derivation.next),
      dependencyCount: Number(derivation.dependencyCount || 0),
      unavailableDependencyCount: Number(derivation.unavailableDependencyCount || 0),
      brokenCount: Number(derivation.brokenCount || 0)
    },
    graph
  };
}

async function api(req, res, pathname) {
  if (pathname === "/api/content.js" && req.method === "GET") return contentScript(res);
  if (pathname === "/api/content" && req.method === "GET") return json(res, 200, publicContentPayload());
  const publicPost = pathname.match(/^\/api\/public\/posts\/([^/]+)$/);
  if (publicPost && req.method === "GET") {
    const post = publicPostByIdentity(decodeURIComponent(publicPost[1]));
    if (!post) return json(res, 404, { error: "not found" });
    return json(res, 200, { post });
  }
  const publicProject = pathname.match(/^\/api\/public\/projects\/([^/]+)$/);
  if (publicProject && req.method === "GET") {
    const project = publicProjectByIdentity(decodeURIComponent(publicProject[1]));
    if (!project) return json(res, 404, { error: "not found" });
    return json(res, 200, { project });
  }
  if (pathname === "/api/knowledge-nodes" && req.method === "GET") return json(res, 200, { nodes: allKnowledgeNodes(false) });
  const publicKnowledgeNode = pathname.match(/^\/api\/knowledge-nodes\/([^/]+)$/);
  if (publicKnowledgeNode && req.method === "GET") {
    const slug = decodeURIComponent(publicKnowledgeNode[1]);
    const node = publicKnowledgeNodeBySlug(slug);
    if (!node) return json(res, 404, { error: "not found" });
    return json(res, 200, { node });
  }
  const publicFormulaCard = pathname.match(/^\/api\/formulas\/([^/]+)$/);
  if (publicFormulaCard && req.method === "GET") {
    const slug = decodeURIComponent(publicFormulaCard[1]);
    const card = publicFormulaCardBySlug(slug);
    if (!card) return json(res, 404, { error: "not found" });
    return json(res, 200, { card: publicFormulaCardPayload(card) });
  }
  if (pathname === "/api/elec/samples" && req.method === "GET") return elecResponse(res, 200, elecSamples());
  if (pathname === "/api/elec/llm-handoff" && req.method === "GET") return elecHandoff(req, res);
  if (pathname === "/api/elec/build" && req.method === "POST") return elecBuild(res, await readBody(req, elecInputLimitBytes + 4096));
  if ((pathname === "/api/md2file/convert" || pathname === "/api/md2doc/convert") && req.method === "POST") return md2docConvert(res, await readBody(req, md2docInputLimitBytes + 4096));
  if (pathname === "/api/health" && req.method === "GET") return json(res, 200, healthPayload());
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
    const token = cookies(req)[sessionCookieName];
    auth.deleteSession(token);
    const secure = isHttps(req) ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=${privateCmsBasePath() || "/"}; Max-Age=0${secure}`);
    logAudit(db, req, user, "logout", "session", "current");
    return json(res, 200, { ok: true });
  }

  const user = requireUser(req, res);
  if (!user) return;
  if (!requireCsrf(req, res, user)) return;

  if (pathname === "/api/admin/content" && req.method === "GET") {
    return json(res, 200, {
      posts: allPosts(true),
      projects: allProjects(true),
      knowledgeNodes: allKnowledgeNodes(true),
      formulaReferenceDecisions: listFormulaReferenceDecisions(),
      formulaRelationRepairs: listFormulaRelationRepairs(),
      siteLayout: siteLayout(),
      publicFocusMode: publicFocusMode(),
      focusScopeCounts: focusScopeCounts(),
      carousel: carouselAdminPayload()
    });
  }
  if (pathname === "/api/admin/health" && req.method === "GET") return json(res, 200, healthPayload({ detailed: true }));
  if (pathname === "/api/admin/export" && req.method === "GET") {
    logAudit(db, req, user, "content_export", "content", "all");
    return json(res, 200, exportContent());
  }
  if (pathname === "/api/admin/site-layout" && req.method === "GET") return json(res, 200, { siteLayout: siteLayout() });
  if (pathname === "/api/admin/site-layout" && req.method === "POST") {
    const body = await readBody(req);
    const nextLayout = saveSiteLayout(body.siteLayout || body);
    logAudit(db, req, user, "site_layout_save", "site_layout", "home");
    return json(res, 200, { siteLayout: nextLayout });
  }
  if (pathname === "/api/admin/focus-mode" && req.method === "GET") {
    return json(res, 200, {
      publicFocusMode: publicFocusMode(),
      focusScopeCounts: focusScopeCounts(),
      carousel: carouselAdminPayload()
    });
  }
  if (pathname === "/api/admin/focus-mode" && req.method === "POST") {
    const input = validateFocusModePayload(await readBody(req));
    let changed;
    let reconciliation = { bufferedNow: 0, reasonCode: "CAROUSEL_BUFFER_UNCHANGED" };
    withTransaction(() => {
      changed = savePublicFocusMode(input);
      if (changed.current.enabled) {
        reconciliation = reconcileCarouselFocusBuffer((item, contentType) =>
          isContentInFocusScope(item, contentType)
        );
      }
      logAudit(
        db,
        req,
        user,
        changed.current.enabled ? "focus_mode_enable" : "focus_mode_disable",
        "site_setting",
        "public_focus_mode",
        {
          previousEnabled: changed.previous.enabled,
          enabled: changed.current.enabled,
          bufferedNow: reconciliation.bufferedNow,
          reasonCode: changed.current.enabled ? "FOCUS_MODE_ENABLED_BY_OWNER" : "FOCUS_MODE_DISABLED_BY_OWNER"
        }
      );
    });
    return json(res, 200, {
      publicFocusMode: changed.current,
      focusScopeCounts: focusScopeCounts(),
      carousel: carouselAdminPayload(),
      carouselReconciliation: reconciliation,
      reasonCode: changed.current.enabled ? "FOCUS_MODE_ENABLED_BY_OWNER" : "FOCUS_MODE_DISABLED_BY_OWNER"
    });
  }
  if (pathname === "/api/admin/carousel-buffer" && req.method === "GET") {
    return json(res, 200, { carousel: carouselAdminPayload() });
  }

  const carouselBufferRestore = pathname.match(/^\/api\/admin\/carousel-buffer\/([^/]+)\/restore$/);
  if (carouselBufferRestore && req.method === "POST") {
    const bufferId = decodeURIComponent(carouselBufferRestore[1]);
    const input = validateCarouselBufferRestorePayload(await readBody(req));
    const buffer = carouselFocusBufferById(bufferId);
    if (!buffer || buffer.status !== "buffered") {
      const error = apiError(404, "轮播缓冲项不存在或已处理");
      error.reasonCode = "CAROUSEL_BUFFER_NOT_FOUND";
      throw error;
    }
    if (
      focusModeEnabled() &&
      buffer.referenceStatus === "available" &&
      !isContentInFocusScope(buffer.linkedContent, buffer.contentType)
    ) {
      const error = apiError(
        409,
        "聚焦模式已开启，当前内容不属于电子基础、公式推导或开源项目，不能恢复"
      );
      error.reasonCode = "CAROUSEL_RESTORE_BLOCKED_FOCUS_SCOPE_OUTSIDE";
      throw error;
    }
    let restored;
    withTransaction(() => {
      restored = restoreCarouselFocusBuffer(bufferId, input.slot);
      logAudit(db, req, user, "carousel_buffer_restore", buffer.contentType, buffer.contentId, {
        bufferId,
        slot: input.slot,
        reasonCode: "CAROUSEL_BUFFER_RESTORED"
      });
    });
    return json(res, 200, {
      restored: restored.item,
      carousel: carouselAdminPayload(),
      reasonCode: "CAROUSEL_BUFFER_RESTORED"
    });
  }

  const carouselBufferRemove = pathname.match(/^\/api\/admin\/carousel-buffer\/([^/]+)$/);
  if (carouselBufferRemove && req.method === "DELETE") {
    const bufferId = decodeURIComponent(carouselBufferRemove[1]);
    let removed;
    withTransaction(() => {
      removed = removeCarouselFocusBuffer(bufferId);
      logAudit(db, req, user, "carousel_buffer_remove", removed.contentType, removed.contentId, {
        bufferId,
        reasonCode: "CAROUSEL_BUFFER_REMOVED"
      });
    });
    return json(res, 200, {
      removed: {
        bufferId: removed.bufferId,
        contentType: removed.contentType,
        contentId: removed.contentId,
        status: removed.status
      },
      carousel: carouselAdminPayload(),
      reasonCode: "CAROUSEL_BUFFER_REMOVED"
    });
  }
  if (pathname === "/api/uploads" && req.method === "GET") return json(res, 200, { uploads: uploads() });

  if (pathname === "/api/admin/formulas" && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return json(
      res,
      200,
      listFormulaCards({
        moduleKey: url.searchParams.get("module") || "",
        categoryPath: url.searchParams.get("category") || "",
        query: url.searchParams.get("q") || "",
        tag: url.searchParams.get("tag") || "",
        archiveState: url.searchParams.get("archiveState") || "active",
        publishStatus: url.searchParams.get("publishStatus") || "all",
        page: url.searchParams.get("page") || 1,
        pageSize: url.searchParams.get("pageSize") || 12,
        allowGlobalSearch: url.searchParams.get("authoring") === "1"
      })
    );
  }

  if (pathname === "/api/admin/formula-classifications" && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return json(res, 200, {
      classifications: listFormulaClassifications({
        kind: url.searchParams.get("kind") || "",
        parentSlug: url.searchParams.get("parent") || "",
        query: url.searchParams.get("q") || ""
      })
    });
  }

  if (pathname === "/api/admin/formula-classifications" && req.method === "POST") {
    const input = validateFormulaClassificationPayload(await readBody(req));
    let result;
    withTransaction(() => {
      result = saveFormulaClassification(input);
      logAudit(
        db,
        req,
        user,
        result.reused ? "formula_classification_reuse" : "formula_classification_create",
        "formula_classification",
        result.classification.classificationId,
        {
          kind: result.classification.kind,
          slug: result.classification.slug,
          parentSlug: result.classification.parentSlug
        }
      );
    });
    return json(res, result.reused ? 200 : 201, {
      ...result,
      classifications: listFormulaClassifications()
    });
  }

  if (pathname === "/api/admin/formula-decisions" && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return json(
      res,
      200,
      {
        decisions: listFormulaReferenceDecisions({
          status: url.searchParams.get("status") || "pending",
          postId: url.searchParams.get("postId") || "",
          formulaId: url.searchParams.get("formulaId") || ""
        })
      }
    );
  }

  if (pathname === "/api/admin/formula-relation-repairs" && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    return json(res, 200, {
      repairs: listFormulaRelationRepairs({
        status: url.searchParams.get("status") || "pending",
        issueCode: url.searchParams.get("issue") || ""
      })
    });
  }

  const formulaRelationRepairEvent = pathname.match(
    /^\/api\/admin\/formula-relation-repairs\/([^/]+)\/events$/
  );
  if (formulaRelationRepairEvent && req.method === "POST") {
    const repairId = decodeURIComponent(formulaRelationRepairEvent[1]);
    const input = validateFormulaRelationRepairEventPayload(await readBody(req));
    let repair;
    withTransaction(() => {
      repair = appendFormulaRelationRepairEvent(repairId, input, user);
      logAudit(
        db,
        req,
        user,
        `formula_relation_repair_${input.eventType}`,
        "formula_relation_repair",
        repairId,
        {
          targetFormulaId: input.targetFormulaId || "",
          sourceFormulaId: repair.sourceFormulaId,
          sourceRevisionId: repair.sourceRevisionId
        }
      );
    });
    return json(res, 200, {
      repair,
      repairs: listFormulaRelationRepairs()
    });
  }

  const formulaDecisionResolve = pathname.match(/^\/api\/admin\/formula-decisions\/([^/]+)\/resolve$/);
  if (formulaDecisionResolve && req.method === "POST") {
    const decisionId = decodeURIComponent(formulaDecisionResolve[1]);
    if (focusModeEnabled() && !listFormulaReferenceDecisions({ status: "all" }).some((item) => item.decisionId === decisionId)) {
      return json(res, 404, { error: "not found", reasonCode: "FOCUS_SCOPE_OUTSIDE" });
    }
    const input = validateFormulaDecisionPayload(await readBody(req));
    let payload = input;
    if (input.action === "clone") {
      payload = {
        ...input,
        formula: validateFormulaCardPayload({
          ...input.formula,
          ...generatedFormulaIdentity(),
          revisionReason: "article-decision-clone"
        })
      };
    }
    let resolved;
    withTransaction(() => {
      resolved = resolveFormulaReferenceDecision(decisionId, payload, user);
      logAudit(db, req, user, "formula_reference_decision_resolve", "formula_reference_decision", decisionId, {
        action: input.action,
        postId: resolved.post.id,
        formulaId: resolved.decision.formulaId,
        resolvedFormulaId: resolved.decision.resolvedFormulaId,
        resolvedRevisionId: resolved.decision.resolvedRevisionId
      });
    });
    return json(res, 200, {
      ...resolved,
      decisions: listFormulaReferenceDecisions(),
      posts: allPosts(true)
    });
  }

  if (pathname === "/api/admin/formulas/export" && req.method === "GET") {
    logAudit(db, req, user, "formula_catalog_export", "formula_catalog", "all");
    res.setHeader("Content-Disposition", 'attachment; filename="larkix-formula-catalog.json"');
    return json(res, 200, exportFormulaCatalog());
  }

  if (pathname === "/api/admin/formulas/import" && req.method === "POST") {
    const body = await readBody(req, 8 * 1024 * 1024);
    if (!body.catalog || !body.snapshotName) {
      throw apiError(400, "公式库导入必须同时提供 catalog 与 snapshotName");
    }
    const catalog = validateFormulaCatalogPackage(body.catalog);
    const snapshotPath = formulaSnapshotPath(body.snapshotName);
    writeSnapshotFile(exportFormulaCatalog(), snapshotPath, { root });
    const result = importFormulaCatalog(catalog, { actor: user });
    logAudit(db, req, user, "formula_catalog_import", "formula_catalog", "all", {
      importedCards: result.importedCards,
      revisionsCreated: result.revisionsCreated,
      decisionsCreated: result.decisionsCreated || 0,
      snapshotName: path.basename(snapshotPath)
    });
    return json(res, 200, {
      ...result,
      snapshotName: path.basename(snapshotPath),
      catalog: listFormulaCards({})
    });
  }

  if (pathname === "/api/admin/formulas/from-selection" && req.method === "POST") {
    const body = await readBody(req);
    const post = validatePostPayload(body.post || {});
    assertFocusWriteAllowed("post", post);
    const selection = validateLatexSelection(post.markdown, body.selectionStart, body.selectionEnd);
    const sourceHash = validateSourceHash(body.sourceHash, "sourceHash");
    const baseSourceHash = validateSourceHash(body.baseSourceHash, "baseSourceHash", {
      optional: true
    });
    rejectFormulaIdentityOverride(body.formula);
    const formula = validateFormulaBusinessPayload({
      ...(body.formula || {}),
      latex: selection.latex,
      revisionReason: "article-selection-create"
    });
    assertCarouselSlot(post, "post");
    let created;
    withTransaction(() => {
      created = createFormulaFromSelection(
        { post, formula, selection, sourceHash, baseSourceHash },
        user
      );
      logAudit(db, req, user, "formula_card_create_from_article", "formula_card", created.card.formulaId, {
        postId: created.post.id,
        sourceHash,
        revisionId: created.binding.revisionId,
        bindingId: created.binding.bindingId
      });
      logAudit(db, req, user, "post_formula_binding_save", "post", created.post.id, {
        formulaId: created.card.formulaId,
        revisionId: created.binding.revisionId,
        bindingId: created.binding.bindingId
      });
    });
    return json(res, 200, { ...created, posts: allPosts(true), carousel: carouselAdminPayload() });
  }

  if (pathname === "/api/admin/formulas" && req.method === "POST") {
    const input = await readBody(req);
    rejectFormulaIdentityOverride(input);
    const body = validateFormulaBusinessPayload(input);
    let saved;
    withTransaction(() => {
      saved = createFormulaCard({ ...body, actor: user });
      logAudit(db, req, user, "formula_card_create", "formula_card", saved.card.formulaId, {
        slug: saved.card.slug,
        revisionCreated: saved.revisionCreated,
        decisionCount: saved.decisionCount || 0
      });
    });
    return json(res, 200, saved);
  }

  const formulaUpdate = pathname.match(/^\/api\/admin\/formulas\/([^/]+)$/);
  if (formulaUpdate && req.method === "PUT") {
    const id = decodeURIComponent(formulaUpdate[1]);
    const input = await readBody(req);
    rejectFormulaIdentityOverride(input);
    const body = validateFormulaBusinessPayload(input);
    let saved;
    withTransaction(() => {
      saved = updateFormulaCard(id, { ...body, actor: user });
      logAudit(db, req, user, "formula_card_update", "formula_card", saved.card.formulaId, {
        slug: saved.card.slug,
        revisionCreated: saved.revisionCreated,
        decisionCount: saved.decisionCount || 0
      });
    });
    return json(res, 200, saved);
  }

  const formulaDerivation = pathname.match(/^\/api\/admin\/formulas\/([^/]+)\/derivation$/);
  if (formulaDerivation && req.method === "POST") {
    const sourceId = decodeURIComponent(formulaDerivation[1]);
    const input = validateFormulaDerivationPayload(await readBody(req));
    let saved;
    withTransaction(() => {
      saved = saveFormulaDerivation(sourceId, input, user);
      const auditAction =
        input.action === "remove"
          ? "formula_derivation_remove"
          : saved.replaced
            ? "formula_derivation_replace"
            : "formula_derivation_set";
      logAudit(db, req, user, auditAction, "formula_derivation", saved.source.formulaId, {
        previousTargetId: saved.previousTargetId,
        targetFormulaId: saved.target?.formulaId || null,
        affectedSourceIds: saved.affectedSources.map((card) => card.formulaId)
      });
    });
    return json(res, 200, { relation: saved, card: saved.source });
  }

  const formulaCardRestore = pathname.match(/^\/api\/admin\/formulas\/([^/]+)\/restore$/);
  if (formulaCardRestore && req.method === "POST") {
    const id = decodeURIComponent(formulaCardRestore[1]);
    let card;
    withTransaction(() => {
      card = restoreFormulaCard(id);
      logAudit(db, req, user, "formula_card_restore", "formula_card", card.formulaId, { slug: card.slug });
    });
    return json(res, 200, { card });
  }

  const formulaCardPublish = pathname.match(/^\/api\/admin\/formulas\/([^/]+)\/publish$/);
  if (formulaCardPublish && req.method === "POST") {
    const id = decodeURIComponent(formulaCardPublish[1]);
    let result;
    withTransaction(() => {
      result = publishFormulaCard(id, user);
      logAudit(db, req, user, "formula_card_publish", "formula_card", result.card.formulaId, {
        slug: result.card.slug,
        revisionId: result.card.publishedRevisionId,
        publicationCreated: result.publicationCreated,
        publicationChanged: result.publicationChanged
      });
    });
    return json(res, 200, result);
  }

  const formulaCardArchive = pathname.match(/^\/api\/admin\/formulas\/([^/]+)\/archive$/);
  if (formulaCardArchive && req.method === "POST") {
    const id = decodeURIComponent(formulaCardArchive[1]);
    let card;
    withTransaction(() => {
      card = archiveFormulaCard(id, user);
      logAudit(db, req, user, "formula_card_archive", "formula_card", card.formulaId, {
        slug: card.slug,
        decisionCount: card.decisionCount || 0
      });
    });
    return json(res, 200, { card });
  }

  const formulaCardDetail = pathname.match(/^\/api\/admin\/formulas\/([^/]+)$/);
  if (formulaCardDetail && req.method === "GET") {
    const id = decodeURIComponent(formulaCardDetail[1]);
    const card = adminFormulaCard(id);
    if (!card) return json(res, 404, { error: "not found" });
    return json(res, 200, { card });
  }

  if (pathname === "/api/admin/knowledge-nodes" && req.method === "GET") {
    return json(res, 200, { nodes: allKnowledgeNodes(true) });
  }

  if (pathname === "/api/admin/knowledge-nodes" && req.method === "POST") {
    const body = validateKnowledgeNodePayload(await readBody(req));
    let saved;
    withTransaction(() => {
      saved = saveKnowledgeNode({ ...body, actor: user });
      logAudit(db, req, user, "knowledge_node_save", "knowledge_node", saved.node.id, knowledgeNodeAuditMetadata(saved));
    });
    return json(res, 200, { node: saved.node, nodes: allKnowledgeNodes(true), warnings: saved.warnings });
  }

  const knowledgeNodeRevisionRestore = pathname.match(/^\/api\/admin\/knowledge-nodes\/([^/]+)\/revisions\/(\d+)\/restore$/);
  if (knowledgeNodeRevisionRestore && req.method === "POST") {
    const id = decodeURIComponent(knowledgeNodeRevisionRestore[1]);
    const revisionId = Number(knowledgeNodeRevisionRestore[2]);
    let restored;
    withTransaction(() => {
      restored = restoreKnowledgeNodeRevision(id, revisionId, { actor: user });
      logAudit(db, req, user, "knowledge_node_revision_restore", "knowledge_node", restored.node.id, {
        revisionId,
        slug: restored.node.slug
      });
    });
    return json(res, 200, { node: restored.node, nodes: allKnowledgeNodes(true), revisions: listKnowledgeNodeRevisions(restored.node.id), warnings: restored.warnings });
  }

  const knowledgeNodeRevisions = pathname.match(/^\/api\/admin\/knowledge-nodes\/([^/]+)\/revisions$/);
  if (knowledgeNodeRevisions && req.method === "GET") {
    const id = decodeURIComponent(knowledgeNodeRevisions[1]);
    const node = adminKnowledgeNode(id);
    if (!node) return json(res, 404, { error: "not found" });
    return json(res, 200, { node, revisions: listKnowledgeNodeRevisions(node.id) });
  }

  const knowledgeNodeRestore = pathname.match(/^\/api\/admin\/knowledge-nodes\/([^/]+)\/restore$/);
  if (knowledgeNodeRestore && req.method === "POST") {
    const id = decodeURIComponent(knowledgeNodeRestore[1]);
    let node;
    withTransaction(() => {
      node = restoreKnowledgeNode(id, { actor: user });
      logAudit(db, req, user, "knowledge_node_restore", "knowledge_node", node.id, {
        slug: node.slug,
        symbol: node.symbol
      });
    });
    return json(res, 200, { node, nodes: allKnowledgeNodes(true), warnings: [] });
  }

  const knowledgeNodeDetail = pathname.match(/^\/api\/admin\/knowledge-nodes\/([^/]+)$/);
  if (knowledgeNodeDetail && req.method === "GET") {
    const id = decodeURIComponent(knowledgeNodeDetail[1]);
    const node = adminKnowledgeNode(id);
    if (!node) return json(res, 404, { error: "not found" });
    return json(res, 200, { node, revisions: listKnowledgeNodeRevisions(node.id) });
  }

  if (knowledgeNodeDetail && req.method === "DELETE") {
    const id = decodeURIComponent(knowledgeNodeDetail[1]);
    let node;
    withTransaction(() => {
      node = softDeleteKnowledgeNode(id, { actor: user });
      logAudit(db, req, user, "knowledge_node_soft_delete", "knowledge_node", node.id, {
        slug: node.slug,
        symbol: node.symbol
      });
    });
    return json(res, 200, { node, nodes: allKnowledgeNodes(true), warnings: [] });
  }

  if (pathname === "/api/posts" && req.method === "POST") {
    const body = validatePostPayload(await readBody(req));
    assertFocusWriteAllowed("post", body);
    assertCarouselSlot(body, "post");
    withTransaction(() => {
      savePost({ ...body, actor: user });
      logAudit(db, req, user, "post_save", "post", body.id, { publishStatus: body.publishStatus, featured: body.featured });
    });
    return json(res, 200, { posts: allPosts(true), carousel: carouselAdminPayload() });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    const body = validateProjectPayload(await readBody(req));
    assertFocusWriteAllowed("project", body);
    assertCarouselSlot(body, "project");
    withTransaction(() => {
      saveProject({ ...body, actor: user });
      logAudit(db, req, user, "project_save", "project", body.id, { visibilityStatus: body.visibilityStatus, statusKey: body.statusKey });
    });
    return json(res, 200, { projects: allProjects(true), carousel: carouselAdminPayload() });
  }

  if (pathname === "/api/uploads" && req.method === "POST") {
    const body = validateUploadPayload(await readBody(req));
    const url = saveUpload(body);
    logAudit(db, req, user, "upload_create", "upload", url, { filename: body.filename || "" });
    return json(res, 200, { url, uploads: uploads() });
  }

  const postRevisions = pathname.match(/^\/api\/posts\/([^/]+)\/revisions$/);
  if (postRevisions && req.method === "GET") {
    const id = decodeURIComponent(postRevisions[1]);
    return json(res, 200, { revisions: listRevisions("post", id) });
  }

  const projectRevisions = pathname.match(/^\/api\/projects\/([^/]+)\/revisions$/);
  if (projectRevisions && req.method === "GET") {
    const id = decodeURIComponent(projectRevisions[1]);
    return json(res, 200, { revisions: listRevisions("project", id) });
  }

  const postRevisionRestore = pathname.match(/^\/api\/posts\/([^/]+)\/revisions\/(\d+)\/restore$/);
  if (postRevisionRestore && req.method === "POST") {
    const id = decodeURIComponent(postRevisionRestore[1]);
    assertFocusWriteAllowed("post", { ...(postById(id) || {}), id }, { requireExisting: true });
    const revisionId = Number(postRevisionRestore[2]);
    let restored;
    withTransaction(() => {
      restored = restoreRevision("post", id, revisionId, { actor: user });
      assertFocusWriteAllowed("post", restored, { requireExisting: true });
      logAudit(db, req, user, "post_revision_restore", "post", id, { revisionId });
    });
    return json(res, 200, {
      restored,
      posts: allPosts(true),
      revisions: listRevisions("post", id),
      carousel: carouselAdminPayload()
    });
  }

  const projectRevisionRestore = pathname.match(/^\/api\/projects\/([^/]+)\/revisions\/(\d+)\/restore$/);
  if (projectRevisionRestore && req.method === "POST") {
    const id = decodeURIComponent(projectRevisionRestore[1]);
    assertFocusWriteAllowed("project", { ...(projectById(id) || {}), id }, { requireExisting: true });
    const revisionId = Number(projectRevisionRestore[2]);
    let restored;
    withTransaction(() => {
      restored = restoreRevision("project", id, revisionId, { actor: user });
      assertFocusWriteAllowed("project", restored, { requireExisting: true });
      logAudit(db, req, user, "project_revision_restore", "project", id, { revisionId });
    });
    return json(res, 200, {
      restored,
      projects: allProjects(true),
      revisions: listRevisions("project", id),
      carousel: carouselAdminPayload()
    });
  }

  const postRestore = pathname.match(/^\/api\/posts\/([^/]+)\/restore$/);
  if (postRestore && req.method === "POST") {
    const id = decodeURIComponent(postRestore[1]);
    assertFocusWriteAllowed("post", { ...(postById(id) || {}), id }, { requireExisting: true });
    withTransaction(() => {
      restorePost(id, { actor: user });
      logAudit(db, req, user, "post_restore", "post", id);
    });
    return json(res, 200, { posts: allPosts(true), carousel: carouselAdminPayload() });
  }

  const projectRestore = pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if (projectRestore && req.method === "POST") {
    const id = decodeURIComponent(projectRestore[1]);
    assertFocusWriteAllowed("project", { ...(projectById(id) || {}), id }, { requireExisting: true });
    withTransaction(() => {
      restoreProject(id, { actor: user });
      logAudit(db, req, user, "project_restore", "project", id);
    });
    return json(res, 200, { projects: allProjects(true), carousel: carouselAdminPayload() });
  }

  const hardDeletePostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/hard$/);
  if (hardDeletePostMatch && req.method === "DELETE") {
    const id = decodeURIComponent(hardDeletePostMatch[1]);
    assertFocusWriteAllowed("post", { ...(postById(id) || {}), id }, { requireExisting: true });
    if (!allowHardDelete) {
      logAudit(db, req, user, "post_hard_delete_blocked", "post", id);
      return json(res, 403, { error: "hard delete is disabled; use soft delete and revisions" });
    }
    withTransaction(() => {
      hardDeletePost(id, { actor: user });
      logAudit(db, req, user, "post_hard_delete", "post", id);
    });
    return json(res, 200, { posts: allPosts(true) });
  }

  const hardDeleteProjectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/hard$/);
  if (hardDeleteProjectMatch && req.method === "DELETE") {
    const id = decodeURIComponent(hardDeleteProjectMatch[1]);
    if (!allowHardDelete) {
      logAudit(db, req, user, "project_hard_delete_blocked", "project", id);
      return json(res, 403, { error: "hard delete is disabled; use soft delete and revisions" });
    }
    withTransaction(() => {
      hardDeleteProject(id, { actor: user });
      logAudit(db, req, user, "project_hard_delete", "project", id);
    });
    return json(res, 200, { projects: allProjects(true) });
  }

  const deletePost = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (deletePost && req.method === "DELETE") {
    const id = decodeURIComponent(deletePost[1]);
    assertFocusWriteAllowed("post", { ...(postById(id) || {}), id }, { requireExisting: true });
    withTransaction(() => {
      softDeletePost(id, { actor: user });
      logAudit(db, req, user, "post_soft_delete", "post", id);
    });
    return json(res, 200, { posts: allPosts(true) });
  }

  const deleteProject = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (deleteProject && req.method === "DELETE") {
    const id = decodeURIComponent(deleteProject[1]);
    withTransaction(() => {
      softDeleteProject(id, { actor: user });
      logAudit(db, req, user, "project_soft_delete", "project", id);
    });
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
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const publicStaticFiles = new Set([
  "/",
  "/404.html",
  "/category.html",
  "/category-page.js",
  "/derive.html",
  "/index.html",
  "/maker.html",
  "/miniapps.html",
  "/post.html",
  "/project.html",
  "/projects.html",
  "/site.webmanifest",
  "/styles.css",
  "/formula-graph.js",
  "/main.js",
  "/post.js"
]);

const publicStaticPrefixes = ["/assets/", "/data/", "/styles/", "/tools/"];
const blockedStaticSegments = new Set([".git", "database", "docs", "gokotta-elec-core", "lib", "node_modules", "scripts"]);
const focusModePublicRouteExceptions = new Set([
  "/miniapps.html",
  "/tools/md2doc.html",
  "/tools/md2doc.js",
  "/api/md2file/convert"
]);

function isFocusModePublicRouteException(pathname) {
  return focusModePublicRouteExceptions.has(pathname);
}

const focusModePublicDataFiles = new Set([
  "/data/content-store.js",
  "/data/footer.js",
  "/data/markdown-renderer.js",
  "/data/math-renderer.js",
  "/data/media.js",
  "/data/miniapps.js",
  "/data/site-meta.js"
]);
const focusModePublicAssetPrefixes = [
  "/assets/covers/",
  "/assets/hero/",
  "/assets/logo/larkix/rocket-bird-final/",
  "/assets/logo/md2file/",
  "/assets/vendor/katex/"
];
const focusModePublicStyleFiles = new Set([
  "/styles/00-base.css",
  "/styles/10-hero.css",
  "/styles/20-content.css",
  "/styles/25-cover-crop.css",
  "/styles/26-inline-math.css",
  "/styles/27-focused-content-media.css",
  "/styles/28-full-site-dark.css",
  "/styles/30-accessibility-print.css",
  "/styles/40-responsive.css",
  "/styles/larkix-brand-theme.css",
  "/styles/larkix-home.css",
  "/styles/md2doc.css"
]);
const publicApiExactPaths = new Set([
  "/api/content",
  "/api/content.js",
  "/api/health",
  "/api/knowledge-nodes",
  "/api/md2file/convert"
]);

function isFocusModePublicStaticPath(pathname) {
  if (pathname.startsWith("/uploads/")) return publicUploadPaths().has(pathname);
  if (focusModePublicDataFiles.has(pathname) || focusModePublicStyleFiles.has(pathname)) return true;
  if (focusModePublicAssetPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
  return !pathname.startsWith("/data/") && !pathname.startsWith("/assets/") && !pathname.startsWith("/styles/");
}

function isPublicApiPath(pathname) {
  if (publicApiExactPaths.has(pathname)) return true;
  return /^\/api\/(?:public\/(?:posts|projects)|knowledge-nodes|formulas)\/[^/]+$/.test(pathname);
}

function isLegacyAuthApiPath(pathname) {
  return ["/api/session", "/api/login", "/api/logout"].includes(pathname);
}

function legacyCmsLoopbackAllowed(req) {
  return process.env.ALLOW_LEGACY_CMS_LOOPBACK === "true" &&
    !privateCmsPath &&
    process.env.NODE_ENV !== "production" &&
    isLoopbackAddress(req.socket.remoteAddress) &&
    isLoopbackAddress(req.socket.localAddress);
}

const privateCmsStaticFiles = new Set([
  "/admin/index.html",
  "/admin/course-paths.html",
  "/admin/admin.css",
  "/admin/admin-dark.css",
  "/admin/admin.js",
  "/styles.css",
  "/formula-graph.js",
  "/maker.html",
  "/derive.html",
  "/index.html"
]);
const privateCmsStaticPrefixes = ["/assets/", "/data/", "/styles/", "/uploads/"];

function isPrivateCmsStaticPath(pathname) {
  return privateCmsStaticFiles.has(pathname) || privateCmsStaticPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPublicStaticRequest(requested) {
  const normalized = requested.replace(/\\/g, "/");
  if (!normalized.startsWith("/") || normalized.includes("\0")) return false;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === ".." || segment.startsWith(".") || blockedStaticSegments.has(segment))) {
    return false;
  }
  if (normalized.startsWith("/uploads/")) return true;
  if (publicStaticFiles.has(normalized)) return true;
  return publicStaticPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function serveNotFound(res) {
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
}

function serveFocusedStylesheet(req, res) {
  const body = fs
    .readFileSync(path.join(root, "styles.css"), "utf8")
    .replace(/^@import\s+["']\.\/styles\/larkix-elec\.css["'];\s*$/m, "");
  res.writeHead(200, {
    "Content-Type": mime[".css"],
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Length": Buffer.byteLength(body)
  });
  if (req.method === "HEAD") return res.end();
  res.end(body);
}

function servePermanentRedirect(req, res, location) {
  res.writeHead(308, {
    Location: location,
    "Cache-Control": "public, max-age=86400",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  if (req.method === "HEAD") return res.end();
  res.end(`Permanent Redirect: ${location}`);
}

function serveStatic(req, res, pathname) {
  let requested = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  if (requested.endsWith("/")) requested += "index.html";
  if (!isPublicStaticRequest(requested)) {
    return serveNotFound(res);
  }
  const staticRoot = requested.startsWith("/uploads/") ? uploadDir : root;
  const relativeRequest = requested.startsWith("/uploads/") ? requested.slice("/uploads/".length) : requested.replace(/^\/+/, "");
  let target = path.normalize(path.join(staticRoot, relativeRequest));
  const relativeTarget = path.relative(staticRoot, target);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    return serveNotFound(res);
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return serveNotFound(res);
  }
  const ext = path.extname(target).toLowerCase();
  const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(target);
  const isCodeAsset = /\.(css|js|webmanifest)$/i.test(target);
  const cacheControl = ext === ".html" || isCodeAsset ? "no-cache" : isImage ? "public, max-age=604800" : "public, max-age=300";
  res.writeHead(200, {
    "Content-Type": mime[ext] || "application/octet-stream",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(target).pipe(res);
}

function servePrivateCmsStatic(req, res, pathname) {
  let requested = decodeURIComponent(pathname);
  if (requested.endsWith("/")) requested += "index.html";
  if (!isPrivateCmsStaticPath(requested)) return serveNotFound(res);
  const staticRoot = requested.startsWith("/uploads/") ? uploadDir : root;
  const relativeRequest = requested.startsWith("/uploads/") ? requested.slice("/uploads/".length) : requested.replace(/^\/+/, "");
  const target = path.normalize(path.join(staticRoot, relativeRequest));
  const relativeTarget = path.relative(staticRoot, target);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) return serveNotFound(res);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return serveNotFound(res);
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mime[ext] || "application/octet-stream",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(target).pipe(res);
}

if (focusModeEnabled()) {
  reconcileCarouselFocusBuffer((item, contentType) => isContentInFocusScope(item, contentType));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cmsRoute = privateCmsRoute(url.pathname);
    if (cmsRoute) {
      if (!privateCmsTransportAllowed(req)) return serveNotFound(res);
      if (cmsRoute.type === "not_found") return serveNotFound(res);
      if (cmsRoute.type === "api") {
        req.privateCmsRequest = true;
        return await api(req, res, cmsRoute.pathname);
      }
      return servePrivateCmsStatic(req, res, cmsRoute.pathname);
    }
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      url.pathname === "/derive.html" &&
      url.searchParams.has("slug") &&
      !url.searchParams.has("formula")
    ) {
      const redirect = resolveLegacyFormulaRedirect(url.searchParams.get("slug"));
      if (redirect) return servePermanentRedirect(req, res, redirect.location);
    }
    if (url.pathname.startsWith("/api/")) {
      if (!isPublicApiPath(url.pathname) && !legacyCmsLoopbackAllowed(req)) return serveNotFound(res);
      if (
        focusModeEnabled() &&
        (url.pathname.startsWith("/api/elec/") || url.pathname.startsWith("/api/md2doc/"))
      ) return serveNotFound(res);
      return await api(req, res, url.pathname);
    }
    if (url.pathname === "/healthz") return json(res, 200, healthPayload());
    if (url.pathname === "/sitemap.xml") return focusModeEnabled() ? focusedSitemap(res) : seo.sitemap(res);
    if (url.pathname === "/robots.txt") return seo.robots(res);
    if (url.pathname === "/rss.xml") return seo.rss(res);
    if (focusModeEnabled() && url.pathname === "/styles.css") return serveFocusedStylesheet(req, res);
    if (focusModeEnabled()) {
      if (url.pathname === "/post.html" && url.searchParams.get("id") && !publicPostByIdentity(url.searchParams.get("id"))) {
        return serveNotFound(res);
      }
      if (url.pathname === "/project.html" && url.searchParams.get("id") && !publicProjectByIdentity(url.searchParams.get("id"))) {
        return serveNotFound(res);
      }
      if (url.pathname === "/category.html") {
        const category = String(url.searchParams.get("category") || "").toLowerCase();
        if (!["electronics-basics", "power-electronics", "projects"].includes(category)) return serveNotFound(res);
      }
      if (
        (url.pathname === "/miniapps.html" || url.pathname.startsWith("/tools/")) &&
        !isFocusModePublicRouteException(url.pathname)
      ) {
        return serveNotFound(res);
      }
      if (!isFocusModePublicStaticPath(url.pathname)) return serveNotFound(res);
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, {
      error: error.status ? error.message : "server error",
      ...(error.reasonCode ? { reasonCode: error.reasonCode } : {})
    });
  }
});

server.listen(port, host || undefined, () => {
  const displayHost = host || "0.0.0.0";
  console.log(`LarkixMaker running at http://${displayHost}:${port}`);
  console.log(`SQLite database: ${dbPath}`);
  console.log(`Uploads directory: ${uploadDir}`);
});
