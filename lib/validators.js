const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,96}$/;
const KNOWLEDGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
const PATH_PATTERN = /^(?:\.\/|\/)?(?:assets|uploads)\//;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const KNOWLEDGE_COLOR_TOKENS = ["purple", "blue", "green", "amber", "red", "neutral"];
const KNOWLEDGE_NODE_TYPES = ["derivation"];

const POST_CATEGORIES = {
  "模拟电子": "analog",
  STM32: "stm32",
  ESP32: "esp32",
  "开源项目": "projects"
};

const PROJECT_STATUSES = {
  planned: "规划中",
  development: "开发中",
  online: "已上线"
};

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function stringValue(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function booleanValue(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function requiredText(value, field, maxLength) {
  const text = stringValue(value);
  if (!text) throw validationError(`${field}不能为空`);
  if (text.length > maxLength) throw validationError(`${field}不能超过 ${maxLength} 个字符`);
  return text;
}

function optionalText(value, field, maxLength) {
  const text = stringValue(value);
  if (text.length > maxLength) throw validationError(`${field}不能超过 ${maxLength} 个字符`);
  return text;
}

function normalizedId(value, fallback) {
  const id = stringValue(value || fallback).toLowerCase();
  if (!ID_PATTERN.test(id)) {
    throw validationError("ID/slug 只能包含小写字母、数字和连字符，长度 2-97");
  }
  return id;
}

function normalizedKnowledgeSlug(value, fallback) {
  const slug = stringValue(value || fallback).toLowerCase();
  if (!KNOWLEDGE_SLUG_PATTERN.test(slug)) {
    throw validationError("推导节点 slug 只能包含小写字母、数字和连字符，长度 2-80");
  }
  return slug;
}

function enumValue(value, allowed, fallback, field) {
  const text = stringValue(value || fallback);
  if (!allowed.includes(text)) throw validationError(`${field}取值不合法`);
  return text;
}

function numberValue(value, field, { min = 0, max = 999999, fallback = 0 } = {}) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw validationError(`${field}必须在 ${min}-${max} 之间`);
  }
  return Math.round(number);
}

function coverPath(value, fallback) {
  const text = stringValue(value || fallback);
  if (!text) return "";
  if (text.startsWith("data:")) throw validationError("封面路径不能是内联 data URL");
  if (!PATH_PATTERN.test(text) && !URL_PATTERN.test(text)) {
    throw validationError("封面路径必须来自 assets/uploads 或 HTTP URL");
  }
  if (text.length > 512) throw validationError("封面路径过长");
  return text;
}

function optionalUrl(value, field) {
  const text = stringValue(value);
  if (!text) return "";
  if (!URL_PATTERN.test(text) && !PATH_PATTERN.test(text)) {
    throw validationError(`${field}必须是 HTTP URL 或站内资源路径`);
  }
  if (text.length > 512) throw validationError(`${field}过长`);
  return text;
}

function tagsValue(value) {
  const tags = stringValue(value)
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);

  for (const tag of tags) {
    if (tag.length > 32) throw validationError("单个标签不能超过 32 个字符");
  }
  return [...new Set(tags)].join(", ");
}

function maskMarkdownIgnoredRegions(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ");
}

function validateDeriveShortcodes(markdown) {
  const source = maskMarkdownIgnoredRegions(markdown);
  const shortcodePattern = /\{\{derive:([^|{}\s]+)\|([^|{}]+?)(?:\|([^|{}]+?))?\}\}/g;
  let match;

  while ((match = shortcodePattern.exec(source))) {
    const slug = stringValue(match[1]).toLowerCase();
    const label = stringValue(match[2]);
    const color = stringValue(match[3] || "purple").toLowerCase();

    if (!KNOWLEDGE_SLUG_PATTERN.test(slug)) {
      throw validationError("推导短码 target slug 不合法");
    }
    if (!label || label.length > 80) {
      throw validationError("推导短码 label 不能为空且不能超过 80 个字符");
    }
    if (!KNOWLEDGE_COLOR_TOKENS.includes(color)) {
      throw validationError("推导短码颜色 token 不合法");
    }
  }
}

function validatePostPayload(payload) {
  const id = normalizedId(payload.id, payload.slug);
  const category = enumValue(payload.category, Object.keys(POST_CATEGORIES), "模拟电子", "文章分类");

  return {
    ...payload,
    id,
    slug: normalizedId(payload.slug || id, id),
    title: requiredText(payload.title, "标题", 120),
    category,
    categoryKey: POST_CATEGORIES[category],
    excerpt: optionalText(payload.excerpt, "摘要", 300),
    cover: coverPath(payload.cover, "./assets/covers/analog-cover.png"),
    markdown: requiredText(payload.markdown, "正文", 200000),
    readTime: optionalText(payload.readTime || "10 分钟阅读", "阅读时间", 32),
    date: optionalText(payload.date || new Date().toISOString().slice(0, 10), "日期", 32),
    publishStatus: enumValue(payload.publishStatus, ["draft", "published"], "draft", "发布状态"),
    featured: booleanValue(payload.featured),
    featuredOrder: numberValue(payload.featuredOrder, "精选排序", { min: 0, max: 3 }),
    recommendationPriority: numberValue(payload.recommendationPriority, "推荐优先级", { min: 1, max: 999, fallback: 100 }),
    tags: tagsValue(payload.tags)
  };
}

function validateProjectPayload(payload) {
  const id = normalizedId(payload.id, payload.slug);
  const statusKey = enumValue(payload.statusKey, Object.keys(PROJECT_STATUSES), "planned", "项目状态");

  return {
    ...payload,
    id,
    slug: normalizedId(payload.slug || id, id),
    title: requiredText(payload.title, "标题", 120),
    status: PROJECT_STATUSES[statusKey],
    statusKey,
    summary: optionalText(payload.summary, "摘要", 300),
    cover: coverPath(payload.cover, "./assets/covers/project-cover.png"),
    markdown: requiredText(payload.markdown, "正文", 200000),
    license: optionalText(payload.license || "MIT License", "许可证", 80),
    stars: numberValue(payload.stars, "星标数", { min: 0, max: 999999, fallback: 0 }),
    date: optionalText(payload.date || new Date().toISOString().slice(0, 10), "日期", 32),
    visibilityStatus: enumValue(payload.visibilityStatus, ["draft", "published"], "draft", "可见状态"),
    featured: booleanValue(payload.featured),
    featuredOrder: numberValue(payload.featuredOrder, "精选排序", { min: 0, max: 3 }),
    repoUrl: optionalUrl(payload.repoUrl, "仓库链接"),
    bomUrl: optionalUrl(payload.bomUrl, "BOM 链接"),
    docsUrl: optionalUrl(payload.docsUrl, "文档链接"),
    version: optionalText(payload.version, "版本", 64),
    progress: numberValue(payload.progress, "进度", { min: 0, max: 100, fallback: 0 }),
    tags: tagsValue(payload.tags)
  };
}

function validateKnowledgeNodePayload(payload) {
  const slug = normalizedKnowledgeSlug(payload.slug || payload.id, payload.id);
  const id = normalizedId(payload.id || slug, slug);
  const publishStatus = enumValue(payload.publishStatus || payload.status, ["draft", "published", "archived"], "draft", "发布状态");
  const visibilityStatus = enumValue(payload.visibilityStatus || payload.visibility, ["public", "unlisted", "private"], "public", "可见状态");
  const markdown = optionalText(payload.markdown, "正文", 200000);
  const summary = optionalText(payload.summary, "摘要", 500);

  if (publishStatus === "published") {
    if (!summary) throw validationError("发布推导节点前摘要不能为空");
    if (!markdown) throw validationError("发布推导节点前正文不能为空");
  }
  validateDeriveShortcodes(markdown);

  return {
    ...payload,
    id,
    slug,
    nodeType: enumValue(payload.nodeType || payload.node_type, KNOWLEDGE_NODE_TYPES, "derivation", "节点类型"),
    symbol: requiredText(payload.symbol, "变量符号", 80),
    title: requiredText(payload.title, "标题", 160),
    summary,
    markdown,
    cover: coverPath(payload.cover, ""),
    accentColor: enumValue(payload.accentColor || payload.accent_color, KNOWLEDGE_COLOR_TOKENS, "purple", "颜色 token"),
    tags: tagsValue(payload.tags),
    publishStatus,
    visibilityStatus
  };
}

function validateUploadPayload(payload) {
  const filename = optionalText(payload.filename, "文件名", 180);
  const dataUrl = String(payload.dataUrl || "");
  if (!DATA_IMAGE_PATTERN.test(dataUrl)) {
    throw validationError("上传内容必须是 PNG、JPG、WebP 或 GIF 图片 data URL");
  }
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Buffer.byteLength(base64, "base64");
  if (bytes > 8 * 1024 * 1024) throw validationError("图片不能超过 8MB");
  return { filename, dataUrl };
}

module.exports = {
  KNOWLEDGE_COLOR_TOKENS,
  validatePostPayload,
  validateProjectPayload,
  validateKnowledgeNodePayload,
  validateUploadPayload
};
