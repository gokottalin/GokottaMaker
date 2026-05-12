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
const { createSeo } = require("./lib/seo");
const { createUploadStore } = require("./lib/uploads");
const { markdownToDocx } = require("./lib/md2doc");
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
const allowHardDelete = process.env.ALLOW_HARD_DELETE === "true";
const maxBackupAgeHours = Number(process.env.MAX_BACKUP_AGE_HOURS || 26);
const offsiteBackupTarget = process.env.OFFSITE_BACKUP_TARGET || "";
const startedAt = new Date();

if (!process.env.ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Use a strong password in production.");
}

const db = createDatabase({ root, dataDir, dbDir, dbPath, uploadDir });
const contentStore = createContentStore(db);
const auth = createAuth(db, { adminUsername, adminPassword, resetAdminPassword });
const uploadStore = createUploadStore(uploadDir);

const siteVersion = "V2.4.8";
const siteBuild = "20260512-2002";
const siteVersionLabel = `${siteVersion}+${siteBuild}`;
const siteUrl = (process.env.SITE_URL || "http://81.71.156.122:4173").replace(/\/$/, "");
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
        index,
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
    SET tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
        created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
        published_at = CASE WHEN publish_status = 'published' THEN COALESCE(published_at, date, updated_at, CURRENT_TIMESTAMP) ELSE published_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND deleted_at IS NULL
      AND (
        tags IS NULL
        OR tags = ''
        OR created_at IS NULL
        OR (publish_status = 'published' AND published_at IS NULL)
      )
  `);
  seed.posts.forEach((post) => {
    updateSeedPost.run(post.tags || "", post.id);
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

function readBody(req, limitBytes = 25_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > limitBytes) {
        const error = new Error("Payload too large");
        error.status = 413;
        reject(error);
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
  withTransaction,
  allPosts,
  allProjects,
  listRevisions,
  restoreRevision,
  savePost,
  saveProject,
  restorePost,
  restoreProject,
  hardDeletePost,
  hardDeleteProject,
  softDeletePost,
  softDeleteProject
} = contentStore;
const { saveUpload, uploads } = uploadStore;
const seo = createSeo({ siteUrl, allPosts, allProjects, text });

function contentScript(res) {
  const body = `window.GOKOTTA_SERVER_CONTENT = ${JSON.stringify(publicContentPayload())};`;
  res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
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

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "GokottaElec 核心目录不可用。")]
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
  const title = full ? "GokottaElec LLM 完整对接包" : "GokottaElec LLM 基础对接包";
  const lines = [
    `# ${title}`,
    "",
    `- 软件版本：${elecVersion}`,
    "- 目标：让其他 LLM 严格输出 GokottaElec 可解析、可 ERC 检查、可脚本渲染的受控自然语言电路描述。",
    "- 使用方式：把本文完整粘贴给目标 LLM，并要求它只按契约输出电路 CNL。",
    "",
    full ? "## 总要求" : "## 基础要求",
    "",
    full
      ? "请你作为电路设计与 CNL 输出助手，严格遵守下面所有文件定义的格式、器件端子、网络规则、边界条件和示例风格。输出时不要自由发挥格式，不要省略网络、器件、连接、约束；无法确定时必须显式给出未连接原因或诊断说明。"
      : "请你严格遵守系统提示词、CNL 输出契约和输出模板。优先保证格式可解析、端子名准确、网络连接明确。",
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
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "GokottaElec 核心目录不可用。")]
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
      diagnostics: [elecDiagnostic("ERROR", "LLM_HANDOFF_UNAVAILABLE", "LLM 对接文件不可用。", { detail: error.message })]
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
      diagnostics.push(elecDiagnostic("ERROR", "SVG_INVALID", "SVG 产物格式不正确。", { target: circuitId }));
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

function publicProjectDirectory() {
  const seedProjects = loadSeedData().projects || [];
  const projectMap = new Map(seedProjects.map((project) => [project.id, publicProjectPreview(project)]));
  for (const project of allProjects(true)) {
    if (project.deletedAt) continue;
    if (!projectMap.has(project.id)) continue;
    projectMap.set(project.id, publicProjectPreview(project));
  }
  return [...projectMap.values()];
}

function publicContentPayload() {
  return {
    posts: allPosts(false),
    projects: allProjects(false),
    projectDirectory: publicProjectDirectory()
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
      diagnostics: [elecDiagnostic("ERROR", "ELEC_CORE_UNAVAILABLE", "GokottaElec 核心目录不可用。")]
    });
  }

  const source = typeof body.source === "string" ? body.source : "";
  const sourceBytes = Buffer.byteLength(source, "utf8");
  if (!source.trim()) {
    return elecResponse(res, 400, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "SOURCE_REQUIRED", "source 不能为空。")]
    });
  }
  if (sourceBytes > elecInputLimitBytes) {
    return elecResponse(res, 413, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "SOURCE_TOO_LARGE", "单次输入文本不能超过 200 KB。")]
    });
  }
  const circuitCount = countCnlCircuits(source);
  if (circuitCount > elecMaxCircuits) {
    return elecResponse(res, 400, {
      ok: false,
      circuits: [],
      artifacts: {},
      diagnostics: [elecDiagnostic("ERROR", "TOO_MANY_CIRCUITS", "单次最多处理 10 个电路块。")]
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
      parsed.diagnostics.push(elecDiagnostic("ERROR", "ELEC_BUILD_TIMEOUT", "GokottaElec 构建超时。"));
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
    version: "V0.2",
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
  const docx = markdownToDocx({ markdown, title });
  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Length": docx.length
  });
  res.end(docx);
}

function carouselItems() {
  return [
    ...allPosts(true).map((item) => ({ ...item, contentType: "post" })),
    ...allProjects(true).map((item) => ({ ...item, contentType: "project" }))
  ].filter((item) => item.featured && !item.deletedAt);
}

function assertCarouselSlot(payload, contentType) {
  if (!payload.featured) return;
  const order = Number(payload.featuredOrder || 0);
  const existing = carouselItems().filter((item) => !(item.contentType === contentType && item.id === payload.id));
  if (existing.length >= 4) {
    throw apiError(400, "首页轮播最多只能设置 4 个内容，请先取消一个已有轮播项");
  }
  const conflict = existing.find((item) => Number(item.featuredOrder || 0) === order);
  if (conflict) {
    throw apiError(400, `轮播排序 ${order} 已被《${conflict.title || "未命名内容"}》使用，请选择 0-3 中的空槽位`);
  }
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

async function api(req, res, pathname) {
  if (pathname === "/api/content.js" && req.method === "GET") return contentScript(res);
  if (pathname === "/api/content" && req.method === "GET") return json(res, 200, publicContentPayload());
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
    assertCarouselSlot(body, "post");
    withTransaction(() => {
      savePost({ ...body, actor: user });
      logAudit(db, req, user, "post_save", "post", body.id, { publishStatus: body.publishStatus, featured: body.featured });
    });
    return json(res, 200, { posts: allPosts(true) });
  }

  if (pathname === "/api/projects" && req.method === "POST") {
    const body = validateProjectPayload(await readBody(req));
    assertCarouselSlot(body, "project");
    withTransaction(() => {
      saveProject({ ...body, actor: user });
      logAudit(db, req, user, "project_save", "project", body.id, { visibilityStatus: body.visibilityStatus, statusKey: body.statusKey });
    });
    return json(res, 200, { projects: allProjects(true) });
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
    const revisionId = Number(postRevisionRestore[2]);
    withTransaction(() => {
      restoreRevision("post", id, revisionId, { actor: user });
      logAudit(db, req, user, "post_revision_restore", "post", id, { revisionId });
    });
    return json(res, 200, { posts: allPosts(true), revisions: listRevisions("post", id) });
  }

  const projectRevisionRestore = pathname.match(/^\/api\/projects\/([^/]+)\/revisions\/(\d+)\/restore$/);
  if (projectRevisionRestore && req.method === "POST") {
    const id = decodeURIComponent(projectRevisionRestore[1]);
    const revisionId = Number(projectRevisionRestore[2]);
    withTransaction(() => {
      restoreRevision("project", id, revisionId, { actor: user });
      logAudit(db, req, user, "project_revision_restore", "project", id, { revisionId });
    });
    return json(res, 200, { projects: allProjects(true), revisions: listRevisions("project", id) });
  }

  const postRestore = pathname.match(/^\/api\/posts\/([^/]+)\/restore$/);
  if (postRestore && req.method === "POST") {
    const id = decodeURIComponent(postRestore[1]);
    withTransaction(() => {
      restorePost(id, { actor: user });
      logAudit(db, req, user, "post_restore", "post", id);
    });
    return json(res, 200, { posts: allPosts(true) });
  }

  const projectRestore = pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if (projectRestore && req.method === "POST") {
    const id = decodeURIComponent(projectRestore[1]);
    withTransaction(() => {
      restoreProject(id, { actor: user });
      logAudit(db, req, user, "project_restore", "project", id);
    });
    return json(res, 200, { projects: allProjects(true) });
  }

  const hardDeletePostMatch = pathname.match(/^\/api\/posts\/([^/]+)\/hard$/);
  if (hardDeletePostMatch && req.method === "DELETE") {
    const id = decodeURIComponent(hardDeletePostMatch[1]);
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
  "/index.html",
  "/miniapps.html",
  "/post.html",
  "/project.html",
  "/projects.html",
  "/site.webmanifest",
  "/styles.css",
  "/main.js",
  "/post.js"
]);

const publicStaticPrefixes = ["/admin/", "/assets/", "/data/", "/styles/", "/tools/"];
const blockedStaticSegments = new Set([".git", "database", "docs", "gokotta-elec-core", "lib", "node_modules", "scripts"]);

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

function serveStatic(res, pathname) {
  let requested = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  if (requested.endsWith("/")) requested += "index.html";
  if (!isPublicStaticRequest(requested)) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    res.end("Forbidden");
    return;
  }
  const staticRoot = requested.startsWith("/uploads/") ? uploadDir : root;
  const relativeRequest = requested.startsWith("/uploads/") ? requested.slice("/uploads/".length) : requested.replace(/^\/+/, "");
  let target = path.normalize(path.join(staticRoot, relativeRequest));
  const relativeTarget = path.relative(staticRoot, target);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
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
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    if (url.pathname === "/healthz") return json(res, 200, healthPayload());
    if (url.pathname === "/sitemap.xml") return seo.sitemap(res);
    if (url.pathname === "/robots.txt") return seo.robots(res);
    if (url.pathname === "/rss.xml") return seo.rss(res);
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
