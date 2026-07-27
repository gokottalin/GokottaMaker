const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,96}$/;
const KNOWLEDGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
const PATH_PATTERN = /^(?:\.\/|\/)?(?:assets|uploads)\//;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const KNOWLEDGE_COLOR_TOKENS = ["purple", "blue", "green", "amber", "red", "neutral"];
const KNOWLEDGE_NODE_TYPES = ["derivation"];
const FORMULA_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const FORMULA_MODULE_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const FORMULA_REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{1,95}$/;
const FORMULA_BINDING_PATTERN = /^[a-z0-9][a-z0-9._-]{1,95}$/;
const FORMULA_REFERENCE_PATTERN =
  /\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}/g;

const POST_CATEGORIES = {
  "电子基础": "electronics-basics",
  "电力电子": "power-electronics",
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

function normalizedFormulaId(value) {
  const formulaId = stringValue(value).toLowerCase();
  if (!FORMULA_ID_PATTERN.test(formulaId)) {
    throw validationError("公式 formulaId 只能包含小写字母、数字、点、下划线和连字符，长度 2-128");
  }
  return formulaId;
}

function normalizedFormulaModule(value) {
  const moduleKey = stringValue(value).toLowerCase();
  if (!FORMULA_MODULE_PATTERN.test(moduleKey)) {
    throw validationError("公式所属模块只能包含小写字母、数字和连字符，长度 2-64");
  }
  return moduleKey;
}

function normalizedFormulaCategoryPath(value) {
  const categoryPath = stringValue(value)
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .join("/");
  if (!categoryPath || categoryPath.length > 240) {
    throw validationError("公式自定义分类路径不能为空且不能超过 240 个字符");
  }
  const segments = categoryPath.split("/");
  if (
    segments.length > 8 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.length > 80 ||
        /[\u0000-\u001f\u007f<>:"|?*]/u.test(segment)
    )
  ) {
    throw validationError("公式自定义分类路径格式不正确，请使用 1-8 级有效名称并以 / 分隔");
  }
  return categoryPath;
}

function normalizedFormulaTags(value) {
  const rawTags = Array.isArray(value)
    ? value
    : stringValue(value)
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
  if (rawTags.length > 24) throw validationError("公式标签不能超过 24 个");
  const tags = [];
  for (const rawTag of rawTags) {
    const tag = stringValue(rawTag);
    const separator = tag.indexOf(":");
    if (separator <= 0 || separator !== tag.lastIndexOf(":")) {
      throw validationError(`公式标签“${tag}”必须使用 namespace:value 格式`);
    }
    const namespace = tag.slice(0, separator).trim().toLowerCase();
    const tagValue = tag.slice(separator + 1).trim();
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(namespace)) {
      throw validationError(`公式标签“${tag}”的 namespace 只能使用小写字母、数字和连字符`);
    }
    if (!tagValue || tagValue.length > 64 || /[\u0000-\u001f\u007f,，、]/u.test(tagValue)) {
      throw validationError(`公式标签“${tag}”的 value 不能为空、含分隔符或超过 64 个字符`);
    }
    tags.push(`${namespace}:${tagValue}`);
  }
  return [...new Set(tags)].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function normalizedFormulaRevisionId(value) {
  const revisionId = stringValue(value).toLowerCase();
  if (!FORMULA_REVISION_PATTERN.test(revisionId)) {
    throw validationError("公式 revisionId 只能包含小写字母、数字、点、下划线和连字符，长度 2-96");
  }
  return revisionId;
}

function validateFormulaCardPayload(payload) {
  return {
    ...payload,
    formulaId: normalizedFormulaId(payload.formulaId || payload.formula_id),
    slug: normalizedKnowledgeSlug(payload.slug, payload.formulaId),
    displayName: requiredText(payload.displayName || payload.name, "公式名称", 160),
    moduleKey: normalizedFormulaModule(payload.moduleKey || payload.module),
    categoryPath: normalizedFormulaCategoryPath(payload.categoryPath || payload.category),
    purpose: optionalText(payload.purpose, "公式用途说明", 500),
    tags: normalizedFormulaTags(payload.tags),
    latex: requiredText(payload.latex, "公式 LaTeX", 20000),
    revisionReason: optionalText(payload.revisionReason || "save", "修订原因", 64) || "save",
    sourceBookId: optionalText(payload.sourceBookId, "来源计算书 ID", 128),
    sourceBookRevision: optionalText(payload.sourceBookRevision, "来源计算书修订", 128),
    sourceFormulaId: optionalText(payload.sourceFormulaId, "来源公式 ID", 128)
  };
}

function validateFormulaDecisionPayload(payload) {
  const action = enumValue(payload?.action, ["keep", "adopt", "clone"], "", "公式版本处理方式");
  if (action === "clone" && (!payload.formula || typeof payload.formula !== "object" || Array.isArray(payload.formula))) {
    throw validationError("另建公式卡时必须填写新公式卡信息");
  }
  return {
    action,
    formula: action === "clone" ? payload.formula : null
  };
}

function validateFormulaDerivationPayload(payload) {
  const action = enumValue(payload?.action, ["set", "remove"], "", "公式推导关系操作");
  const targetFormulaId =
    action === "set" ? normalizedFormulaId(payload.targetFormulaId || payload.target_formula_id) : "";
  return {
    action,
    targetFormulaId,
    replace: action === "set" && booleanValue(payload.replace)
  };
}

function validateFocusModePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.enabled !== "boolean") {
    throw validationError("聚焦模式 enabled 必须是布尔值");
  }
  return { enabled: payload.enabled };
}

function validateCarouselBufferRestorePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("轮播恢复请求格式不正确");
  }
  const slot = Number(payload.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
    throw validationError("恢复轮播项时必须明确选择 0-3 槽位");
  }
  return { slot };
}

function validateFormulaCatalogPackage(payload) {
  if (!payload || payload.schemaVersion !== "larkix.formula-catalog.v1" || !Array.isArray(payload.cards)) {
    throw validationError("公式目录导入包格式不正确");
  }
  const formulaIds = new Set();
  const slugs = new Set();
  const globalRevisionIds = new Set();
  const cards = payload.cards.map((rawCard) => {
    const formulaId = normalizedFormulaId(rawCard.formulaId);
    const slug = normalizedKnowledgeSlug(rawCard.slug, formulaId);
    if (formulaIds.has(formulaId)) throw validationError(`公式导入包存在重复 formulaId：${formulaId}`);
    if (slugs.has(slug)) throw validationError(`公式导入包存在重复 slug：${slug}`);
    formulaIds.add(formulaId);
    slugs.add(slug);
    if (!Array.isArray(rawCard.revisions) || !rawCard.revisions.length) {
      throw validationError(`公式 ${formulaId} 至少需要一个不可变 LaTeX 修订`);
    }
    const sequences = new Set();
    const revisionIds = new Set();
    const revisions = rawCard.revisions.map((rawRevision) => {
      const revisionId = normalizedFormulaRevisionId(rawRevision.revisionId);
      const sequence = Number(rawRevision.sequence);
      if (!Number.isInteger(sequence) || sequence < 1) {
        throw validationError(`公式 ${formulaId} 的修订序号必须是正整数`);
      }
      if (sequences.has(sequence) || revisionIds.has(revisionId) || globalRevisionIds.has(revisionId)) {
        throw validationError(`公式 ${formulaId} 存在重复修订标识或序号`);
      }
      sequences.add(sequence);
      revisionIds.add(revisionId);
      globalRevisionIds.add(revisionId);
      return {
        revisionId,
        sequence,
        latex: requiredText(rawRevision.latex, "公式 LaTeX", 20000),
        revisionReason: optionalText(rawRevision.revisionReason || "import", "修订原因", 64) || "import",
        sourceBookId: optionalText(rawRevision.sourceBookId, "来源计算书 ID", 128),
        sourceBookRevision: optionalText(rawRevision.sourceBookRevision, "来源计算书修订", 128),
        sourceFormulaId: optionalText(rawRevision.sourceFormulaId, "来源公式 ID", 128)
      };
    });
    const currentRevisionId = normalizedFormulaRevisionId(rawCard.currentRevisionId);
    if (!revisionIds.has(currentRevisionId)) {
      throw validationError(`公式 ${formulaId} 的 currentRevisionId 不属于该公式`);
    }
    return {
      formulaId,
      slug,
      displayName: requiredText(rawCard.displayName, "公式名称", 160),
      moduleKey: normalizedFormulaModule(rawCard.moduleKey),
      categoryPath: normalizedFormulaCategoryPath(rawCard.categoryPath),
      purpose: optionalText(rawCard.purpose, "公式用途说明", 500),
      tags: normalizedFormulaTags(rawCard.tags),
      archiveState: enumValue(rawCard.archiveState, ["active", "archived"], "active", "公式归档状态"),
      currentRevisionId,
      revisions: revisions.sort((left, right) => left.sequence - right.sequence)
    };
  });
  return {
    schemaVersion: "larkix.formula-catalog.v1",
    cards: cards.sort((left, right) => left.formulaId.localeCompare(right.formulaId))
  };
}

function maskMarkdownProtectedRegions(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, (match) => " ".repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => " ".repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
}

function validateFormulaReferenceShortcodes(markdown) {
  const source = maskMarkdownProtectedRegions(markdown);
  const seen = new Set();
  let match;
  FORMULA_REFERENCE_PATTERN.lastIndex = 0;
  while ((match = FORMULA_REFERENCE_PATTERN.exec(source))) {
    const bindingId = match[1];
    const formulaId = match[2];
    const revisionId = match[3];
    if (!FORMULA_BINDING_PATTERN.test(bindingId)) throw validationError("文章公式 bindingId 格式不正确");
    if (!FORMULA_ID_PATTERN.test(formulaId)) throw validationError("文章公式 formulaId 格式不正确");
    if (!FORMULA_REVISION_PATTERN.test(revisionId)) throw validationError("文章公式 revisionId 格式不正确");
    if (seen.has(bindingId)) throw validationError(`文章公式 bindingId 重复：${bindingId}`);
    seen.add(bindingId);
  }
  const unmatched = source.replace(FORMULA_REFERENCE_PATTERN, "").match(/\{\{formula:/);
  if (unmatched) {
    throw validationError("文章公式引用格式不完整，应为 {{formula:bindingId|formulaId|revisionId|inline/display}}");
  }
}

function validateLatexSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown || "");
  const start = Number(selectionStart);
  const end = Number(selectionEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > source.length) {
    throw validationError("请先框选一个完整的 LaTeX 公式");
  }
  const selectedText = source.slice(start, end);
  const trimmed = selectedText.trim();
  let displayMode = "";
  let latex = "";
  if (/^\$\$[\s\S]+\$\$$/.test(trimmed) && !trimmed.slice(2, -2).includes("$$")) {
    displayMode = "display";
    latex = trimmed.slice(2, -2).trim();
  } else if (/^\\\[[\s\S]+\\\]$/.test(trimmed) && !trimmed.slice(2, -2).includes("\\]")) {
    displayMode = "display";
    latex = trimmed.slice(2, -2).trim();
  } else if (/^\$(?:\\.|[^$\n\\])+\$$/.test(trimmed)) {
    displayMode = "inline";
    latex = trimmed.slice(1, -1).trim();
  } else if (/^\\\((?:\\.|[^\\\n]|\\(?!\)))+\\\)$/.test(trimmed)) {
    displayMode = "inline";
    latex = trimmed.slice(2, -2).trim();
  }
  if (!displayMode || !latex) {
    throw validationError("选区必须只包含一个完整的行内或块级 LaTeX 公式，不能混入正文、残缺定界符或多个公式");
  }
  if (latex.length > 20000) throw validationError("公式 LaTeX 不能超过 20000 个字符");
  return { selectionStart: start, selectionEnd: end, selectedText, displayMode, latex };
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
  const markdown = requiredText(payload.markdown, "正文", 200000);
  validateFormulaReferenceShortcodes(markdown);

  return {
    ...payload,
    id,
    slug: normalizedId(payload.slug || id, id),
    title: requiredText(payload.title, "标题", 120),
    category,
    categoryKey: POST_CATEGORIES[category],
    excerpt: optionalText(payload.excerpt, "摘要", 300),
    cover: coverPath(payload.cover, "./assets/covers/analog-cover.png"),
    markdown,
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
  validateFormulaCardPayload,
  validateFormulaDecisionPayload,
  validateFormulaDerivationPayload,
  validateFocusModePayload,
  validateCarouselBufferRestorePayload,
  validateFormulaCatalogPackage,
  validateFormulaReferenceShortcodes,
  validateLatexSelection,
  validateUploadPayload
};
