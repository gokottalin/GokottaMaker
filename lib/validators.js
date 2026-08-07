const crypto = require("node:crypto");

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
const SOURCE_HASH_PATTERN = /^[a-f0-9]{64}$/;
const FORMULA_REFERENCE_PATTERN =
  /\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}/g;
const FORMULA_DEPENDENCY_PATTERN =
  /\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g;
const LEGACY_DERIVE_PATTERN =
  /\{\{derive:([^|{}\s]+)\|([^|{}]+?)(?:\|([^|{}]+?))?\}\}/g;
const MAX_READING_MINUTES = 9999;

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

function normalizedMetadataText(value, fallback = "") {
  return String(value ?? fallback)
    .normalize("NFKC")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function classificationSlug(value, field = "分类") {
  const slug = normalizedMetadataText(value)
    .toLowerCase()
    .replace(/[·•・:：/／\\_,，、;；]+/g, "-")
    .replace(/['"“”‘’()[\]{}<>《》]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw validationError(`${field}无法生成有效 slug`);
  if (/[\u4e00-\u9fff]/u.test(slug)) {
    return `zh-${crypto.createHash("sha256").update(slug).digest("hex").slice(0, 24)}`;
  }
  return slug.slice(0, 160);
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

function preservedText(value, field, maxLength, { required = false } = {}) {
  const text = String(value ?? "");
  if (required && !text.trim()) throw validationError(`${field}不能为空`);
  if (text.length > maxLength) throw validationError(`${field}不能超过 ${maxLength} 个字符`);
  return text;
}

function sourceTextHash(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function validateSourceHash(value, field = "sourceHash", options = {}) {
  const hash = String(value ?? "").trim().toLowerCase();
  if (!hash && options.optional === true) return "";
  if (!SOURCE_HASH_PATTERN.test(hash)) {
    throw validationError(`${field} 必须是 64 位 SHA256`);
  }
  return hash;
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

function readingMinutesValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean" || typeof value === "object") {
    throw validationError(`建议阅读时间必须是 1-${MAX_READING_MINUTES} 的正整数分钟或留空`);
  }
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    throw validationError(`建议阅读时间必须是 1-${MAX_READING_MINUTES} 的正整数分钟或留空`);
  }
  const minutes = Number(text);
  if (!Number.isSafeInteger(minutes) || minutes > MAX_READING_MINUTES) {
    throw validationError(`建议阅读时间必须是 1-${MAX_READING_MINUTES} 的正整数分钟或留空`);
  }
  return minutes;
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

function validateCoverCrop(value) {
  if (value === undefined || value === null || value === "") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError("封面裁剪坐标必须是完整对象或 null");
  }

  const keys = ["x", "y", "width", "height", "sourceWidth", "sourceHeight"];
  if (keys.some((key) => value[key] === undefined || value[key] === null || value[key] === "")) {
    throw validationError("封面裁剪坐标必须同时包含 x、y、width、height、sourceWidth、sourceHeight");
  }
  const crop = Object.fromEntries(keys.map((key) => [key, Number(value[key])]));
  if (keys.some((key) => !Number.isFinite(crop[key]))) {
    throw validationError("封面裁剪坐标必须是有限数值");
  }
  if (
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x > 1 ||
    crop.y > 1 ||
    crop.width > 1 ||
    crop.height > 1 ||
    crop.x + crop.width > 1.000000001 ||
    crop.y + crop.height > 1.000000001
  ) {
    throw validationError("封面裁剪矩形必须位于归一化原图边界内");
  }
  if (
    !Number.isInteger(crop.sourceWidth) ||
    !Number.isInteger(crop.sourceHeight) ||
    crop.sourceWidth < 1 ||
    crop.sourceHeight < 1 ||
    crop.sourceWidth > 100000 ||
    crop.sourceHeight > 100000
  ) {
    throw validationError("封面原图尺寸必须是 1-100000 的整数");
  }

  const pixelWidth = crop.width * crop.sourceWidth;
  const pixelHeight = crop.height * crop.sourceHeight;
  const expectedWidth = pixelHeight * 16 / 9;
  const tolerance = Math.max(1, expectedWidth * 0.001);
  if (Math.abs(pixelWidth - expectedWidth) > tolerance) {
    throw validationError("封面裁剪源像素区域必须保持 16:9");
  }
  return crop;
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

function formulaSelectionIdentity({ displayName, latex }) {
  const name = requiredText(normalizedMetadataText(displayName), "公式名称", 160);
  const formulaLatex = preservedText(latex, "公式 LaTeX", 20000, { required: true });
  const normalizedName = name.toLowerCase();
  const identityLatex = formulaLatex.replace(/\r\n?/g, "\n").trim();
  const digest = sourceTextHash(JSON.stringify([normalizedName, identityLatex])).slice(0, 12);
  const readable = normalizedName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = (readable || "formula").slice(0, 66).replace(/-$/g, "") || "formula";
  const slug = `${base}-${digest}`;
  return {
    formulaId: `formula.user.${slug}`,
    slug
  };
}

function normalizedFormulaModule(value) {
  const moduleKey = normalizedMetadataText(value).toLowerCase();
  if (!FORMULA_MODULE_PATTERN.test(moduleKey)) {
    throw validationError("公式所属模块只能包含小写字母、数字和连字符，长度 2-64");
  }
  return moduleKey;
}

function normalizedFormulaCategoryPath(value) {
  const categoryPath = normalizedMetadataText(value)
    .replace(/[／\\]/g, "/")
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => normalizedMetadataText(segment))
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
    : normalizedMetadataText(value)
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
  if (rawTags.length > 24) throw validationError("公式标签不能超过 24 个");
  const tags = [];
  for (const rawTag of rawTags) {
    const tag = normalizedMetadataText(rawTag).replace("：", ":");
    const separator = tag.indexOf(":");
    if (separator <= 0 || separator !== tag.lastIndexOf(":")) {
      throw validationError(`公式标签“${tag}”必须使用 namespace:value 格式`);
    }
    const namespace = tag.slice(0, separator).trim().toLowerCase();
    const tagValue = normalizedMetadataText(tag.slice(separator + 1));
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

function extractFormulaDependencyReferences(markdown) {
  const source = String(markdown || "")
    .replace(/```[\s\S]*?```/g, (match) => " ".repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => " ".repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => " ".repeat(match.length))
    .replace(/\$[^$\n]*\$/g, (match) => " ".repeat(match.length));
  const references = [];
  const seen = new Set();
  let match;
  FORMULA_DEPENDENCY_PATTERN.lastIndex = 0;
  while ((match = FORMULA_DEPENDENCY_PATTERN.exec(source))) {
    const formulaId = match[1];
    if (seen.has(formulaId)) {
      throw validationError(`Markdown 推导存在重复公式依赖：${formulaId}`);
    }
    seen.add(formulaId);
    references.push(formulaId);
  }
  FORMULA_DEPENDENCY_PATTERN.lastIndex = 0;
  if (source.replace(FORMULA_DEPENDENCY_PATTERN, "").includes("{{formula-ref:")) {
    throw validationError("公式依赖格式不完整，应为 {{formula-ref:formulaId}}");
  }
  return references;
}

function analyzeFormulaDependencyGraph({ formulaIds = [], edges = [] } = {}) {
  const knownFormulaIds = new Set([...formulaIds].map((value) => String(value || "")));
  const normalizedEdges = (Array.isArray(edges) ? edges : []).map((edge, index) => ({
    ...edge,
    sourceFormulaId: String(edge?.sourceFormulaId || ""),
    targetFormulaId: String(edge?.targetFormulaId || ""),
    ordinal: Number.isInteger(Number(edge?.ordinal)) ? Number(edge.ordinal) : index
  }));
  const issues = [];
  const seenEdges = new Set();
  const adjacency = new Map([...knownFormulaIds].map((formulaId) => [formulaId, []]));

  for (const edge of normalizedEdges) {
    const edgeKey = `${edge.sourceFormulaId}\u0000${edge.targetFormulaId}`;
    if (!knownFormulaIds.has(edge.sourceFormulaId)) {
      issues.push({
        code: "FORMULA_DEPENDENCY_SOURCE_MISSING",
        message: `公式依赖来源不存在：${edge.sourceFormulaId}`,
        edge
      });
    }
    if (!knownFormulaIds.has(edge.targetFormulaId)) {
      issues.push({
        code: "FORMULA_DEPENDENCY_TARGET_MISSING",
        message: `公式依赖目标不存在：${edge.targetFormulaId}`,
        edge
      });
    }
    if (edge.sourceFormulaId === edge.targetFormulaId) {
      issues.push({
        code: "FORMULA_DEPENDENCY_SELF_REFERENCE",
        message: `公式卡不能依赖自身：${edge.sourceFormulaId}`,
        edge
      });
    }
    if (seenEdges.has(edgeKey)) {
      issues.push({
        code: "FORMULA_DEPENDENCY_DUPLICATE",
        message: `同一来源不能重复引用同一依赖公式：${edge.targetFormulaId}`,
        edge
      });
    }
    seenEdges.add(edgeKey);
    if (
      knownFormulaIds.has(edge.sourceFormulaId) &&
      knownFormulaIds.has(edge.targetFormulaId) &&
      edge.sourceFormulaId !== edge.targetFormulaId
    ) {
      adjacency.get(edge.sourceFormulaId).push(edge.targetFormulaId);
    }
  }

  for (const targets of adjacency.values()) targets.sort((left, right) => left.localeCompare(right));
  const state = new Map();
  const stack = [];
  let cyclePath = [];
  function visit(formulaId) {
    if (state.get(formulaId) === 2 || cyclePath.length) return;
    if (state.get(formulaId) === 1) {
      const start = stack.indexOf(formulaId);
      cyclePath = [...stack.slice(start), formulaId];
      return;
    }
    state.set(formulaId, 1);
    stack.push(formulaId);
    for (const targetFormulaId of adjacency.get(formulaId) || []) visit(targetFormulaId);
    stack.pop();
    state.set(formulaId, 2);
  }
  [...knownFormulaIds].sort((left, right) => left.localeCompare(right)).forEach(visit);
  if (cyclePath.length) {
    issues.push({
      code: "FORMULA_DEPENDENCY_CYCLE",
      message: `公式依赖会形成循环：${cyclePath.join(" -> ")}`,
      cyclePath
    });
  }

  const incomingCount = new Map([...knownFormulaIds].map((formulaId) => [formulaId, 0]));
  if (!cyclePath.length) {
    for (const [sourceFormulaId, targets] of adjacency) {
      for (const targetFormulaId of new Set(targets)) {
        incomingCount.set(targetFormulaId, Number(incomingCount.get(targetFormulaId) || 0) + 1);
      }
    }
  }
  const pending = [...knownFormulaIds]
    .filter((formulaId) => incomingCount.get(formulaId) === 0)
    .sort((left, right) => left.localeCompare(right));
  const topologicalOrder = [];
  while (pending.length) {
    const sourceFormulaId = pending.shift();
    topologicalOrder.push(sourceFormulaId);
    for (const targetFormulaId of new Set(adjacency.get(sourceFormulaId) || [])) {
      incomingCount.set(targetFormulaId, incomingCount.get(targetFormulaId) - 1);
      if (incomingCount.get(targetFormulaId) === 0) {
        pending.push(targetFormulaId);
        pending.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    edges: normalizedEdges,
    topologicalOrder,
    dependencyFirstOrder: [...topologicalOrder].reverse()
  };
}

function validateFormulaDependencyGraph(graph) {
  const analysis = analyzeFormulaDependencyGraph(graph);
  if (analysis.valid) return analysis;
  const issue = analysis.issues[0];
  const error = validationError(issue.message);
  error.reasonCode = issue.code;
  error.details = issue;
  if (issue.code === "FORMULA_DEPENDENCY_CYCLE") error.status = 409;
  throw error;
}

function validateFormulaCardPayload(payload) {
  const markdownDerivation = preservedText(
    payload.markdownDerivation ?? payload.markdown,
    "Markdown 推导正文",
    200000
  );
  return {
    ...payload,
    formulaId: normalizedFormulaId(payload.formulaId || payload.formula_id),
    slug: normalizedKnowledgeSlug(payload.slug, payload.formulaId),
    displayName: requiredText(normalizedMetadataText(payload.displayName || payload.name), "公式名称", 160),
    moduleKey: normalizedFormulaModule(payload.moduleKey || payload.module),
    categoryPath: normalizedFormulaCategoryPath(payload.categoryPath || payload.category),
    purpose: optionalText(normalizedMetadataText(payload.purpose), "公式用途说明", 500),
    tags: normalizedFormulaTags(payload.tags),
    latex: preservedText(payload.latex, "公式 LaTeX", 20000, { required: true }),
    markdownDerivation,
    dependencyFormulaIds: extractFormulaDependencyReferences(markdownDerivation),
    revisionReason: optionalText(payload.revisionReason || "save", "修订原因", 64) || "save",
    sourceBookId: optionalText(payload.sourceBookId, "来源计算书 ID", 128),
    sourceBookRevision: optionalText(payload.sourceBookRevision, "来源计算书修订", 128),
    sourceFormulaId: optionalText(payload.sourceFormulaId, "来源公式 ID", 128)
  };
}

function validateFormulaClassificationPayload(payload) {
  const kind = enumValue(payload?.kind, ["module", "category", "tag"], "", "公式分类类型");
  let displayName = requiredText(normalizedMetadataText(payload.displayName || payload.name), "分类名称", 160);
  if (kind === "tag") displayName = normalizedFormulaTags([displayName])[0];
  const parentSlug =
    kind === "category" ? normalizedFormulaModule(payload.parentSlug || payload.moduleKey) : "";
  const slug = classificationSlug(payload.slug || displayName, "分类名称");
  return { kind, slug, displayName, parentSlug, confirmCreate: booleanValue(payload.confirmCreate) };
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

function validateFormulaRelationRepairEventPayload(payload) {
  const eventType = enumValue(
    payload?.eventType || payload?.action,
    ["resolved", "reopened"],
    "",
    "待修复事项操作"
  );
  return {
    eventType,
    targetFormulaId:
      eventType === "resolved"
        ? normalizedFormulaId(payload.targetFormulaId || payload.target_formula_id)
        : "",
    note: requiredText(payload.note, "复核证据", 500)
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
      const markdownDerivation = preservedText(
        rawRevision.markdownDerivation,
        "Markdown 推导正文",
        200000
      );
      return {
        revisionId,
        sequence,
        latex: preservedText(rawRevision.latex, "公式 LaTeX", 20000, { required: true }),
        markdownDerivation,
        dependencyFormulaIds: extractFormulaDependencyReferences(markdownDerivation),
        displayName: requiredText(
          rawRevision.displayName || rawCard.displayName,
          "公式修订名称",
          160
        ),
        moduleKey: normalizedFormulaModule(rawRevision.moduleKey || rawCard.moduleKey),
        categoryPath: normalizedFormulaCategoryPath(
          rawRevision.categoryPath || rawCard.categoryPath
        ),
        purpose: optionalText(
          rawRevision.purpose ?? rawCard.purpose,
          "公式修订用途说明",
          500
        ),
        tags: normalizedFormulaTags(rawRevision.tags ?? rawCard.tags),
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
    const publishStatus = enumValue(
      rawCard.publishStatus || (rawCard.archiveState === "archived" ? "archived" : "published"),
      ["draft", "published", "archived"],
      "published",
      "公式发布状态"
    );
    const publishedRevisionId = rawCard.publishedRevisionId
      ? normalizedFormulaRevisionId(rawCard.publishedRevisionId)
      : publishStatus === "draft"
        ? null
        : currentRevisionId;
    if (publishedRevisionId && !revisionIds.has(publishedRevisionId)) {
      throw validationError(`公式 ${formulaId} 的 publishedRevisionId 不属于该公式`);
    }
    if (publishStatus === "published" && !publishedRevisionId) {
      throw validationError(`已发布公式 ${formulaId} 必须包含 publishedRevisionId`);
    }
    if (publishStatus === "draft" && publishedRevisionId) {
      throw validationError(`草稿公式 ${formulaId} 不能包含 publishedRevisionId`);
    }
    const publishedRevisionIds = Array.isArray(rawCard.publishedRevisionIds)
      ? rawCard.publishedRevisionIds.map(normalizedFormulaRevisionId)
      : publishedRevisionId
        ? [publishedRevisionId]
        : [];
    if (publishedRevisionIds.some((revisionId) => !revisionIds.has(revisionId))) {
      throw validationError(`公式 ${formulaId} 的已发布修订历史包含其他公式的修订`);
    }
    if (publishedRevisionId && !publishedRevisionIds.includes(publishedRevisionId)) {
      publishedRevisionIds.push(publishedRevisionId);
    }
    return {
      formulaId,
      slug,
      displayName: requiredText(rawCard.displayName, "公式名称", 160),
      moduleKey: normalizedFormulaModule(rawCard.moduleKey),
      categoryPath: normalizedFormulaCategoryPath(rawCard.categoryPath),
      purpose: optionalText(rawCard.purpose, "公式用途说明", 500),
      tags: normalizedFormulaTags(rawCard.tags),
      publishStatus,
      currentRevisionId,
      publishedRevisionId,
      publishedRevisionIds: [...new Set(publishedRevisionIds)],
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

function tokenIsEscaped(source, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function hasUnescapedToken(source, token) {
  let index = source.indexOf(token);
  while (index >= 0) {
    if (!tokenIsEscaped(source, index)) return true;
    index = source.indexOf(token, index + token.length);
  }
  return false;
}

function parseLatexSelectionText(value) {
  const selectedText = String(value ?? "");
  const trimmed = selectedText.trim();
  const candidates = [
    { open: "$$", close: "$$", displayMode: "display", multiline: true, forbidden: "$" },
    { open: "\\[", close: "\\]", displayMode: "display", multiline: true, forbidden: ["\\[", "\\]"] },
    { open: "\\(", close: "\\)", displayMode: "inline", multiline: false, forbidden: ["\\(", "\\)"] },
    { open: "$", close: "$", displayMode: "inline", multiline: false, forbidden: "$" }
  ];
  for (const candidate of candidates) {
    if (!trimmed.startsWith(candidate.open) || !trimmed.endsWith(candidate.close)) continue;
    if (candidate.open === "$" && (trimmed.startsWith("$$") || trimmed.endsWith("$$"))) continue;
    const latexSource = trimmed.slice(candidate.open.length, -candidate.close.length);
    if (!latexSource.trim() || (!candidate.multiline && /[\r\n]/u.test(latexSource))) continue;
    const forbiddenTokens = Array.isArray(candidate.forbidden) ? candidate.forbidden : [candidate.forbidden];
    if (forbiddenTokens.some((token) => hasUnescapedToken(latexSource, token))) continue;
    const leadingWhitespace = selectedText.indexOf(trimmed);
    return {
      selectedText,
      latex: latexSource.trim(),
      displayMode: candidate.displayMode,
      openDelimiter: candidate.open,
      closeDelimiter: candidate.close,
      leadingWhitespace,
      trailingWhitespace: selectedText.length - leadingWhitespace - trimmed.length
    };
  }
  return null;
}

function validateLatexSelection(markdown, selectionStart, selectionEnd) {
  const source = String(markdown || "");
  const start = Number(selectionStart);
  const end = Number(selectionEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > source.length) {
    throw validationError("请先框选一个完整的 LaTeX 公式");
  }
  const selectedText = source.slice(start, end);
  const parsed = parseLatexSelectionText(selectedText);
  if (!parsed) {
    throw validationError("选区必须只包含一个完整的行内或块级 LaTeX 公式，不能混入正文、残缺定界符或多个公式");
  }
  const formulaStart = start + parsed.leadingWhitespace;
  const formulaEnd = end - parsed.trailingWhitespace;
  if (
    parsed.openDelimiter.startsWith("$") &&
    (source[formulaStart - 1] === "$" || source[formulaEnd] === "$")
  ) {
    throw validationError("选区必须覆盖完整的 LaTeX 定界符");
  }
  if (tokenIsEscaped(source, formulaStart)) {
    throw validationError("选区起始定界符已被转义，不是可绑定公式");
  }
  if (parsed.latex.length > 20000) throw validationError("公式 LaTeX 不能超过 20000 个字符");
  return {
    selectionStart: start,
    selectionEnd: end,
    formulaStart,
    formulaEnd,
    selectedText,
    displayMode: parsed.displayMode,
    openDelimiter: parsed.openDelimiter,
    closeDelimiter: parsed.closeDelimiter,
    latex: parsed.latex
  };
}

function maskMarkdownIgnoredRegions(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ");
}

function extractLegacyDeriveReferences(markdown) {
  const source = String(markdown || "");
  const masked = source
    .replace(/```[\s\S]*?```/g, (match) => " ".repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => " ".repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => " ".repeat(match.length))
    .replace(/\$[^$\n]*\$/g, (match) => " ".repeat(match.length));
  const references = [];
  let match;
  LEGACY_DERIVE_PATTERN.lastIndex = 0;
  while ((match = LEGACY_DERIVE_PATTERN.exec(masked))) {
    const targetSlug = stringValue(match[1]).toLowerCase();
    const label = stringValue(match[2]);
    const colorToken = stringValue(match[3] || "purple").toLowerCase();
    if (!KNOWLEDGE_SLUG_PATTERN.test(targetSlug)) {
      throw validationError("推导短码 target slug 不合法");
    }
    if (!label || label.length > 80) {
      throw validationError("推导短码 label 不能为空且不能超过 80 个字符");
    }
    if (!KNOWLEDGE_COLOR_TOKENS.includes(colorToken)) {
      throw validationError("推导短码颜色 token 不合法");
    }
    references.push({
      targetSlug,
      label,
      colorToken,
      start: match.index,
      end: match.index + match[0].length,
      shortcode: source.slice(match.index, match.index + match[0].length)
    });
  }
  return references;
}

function validateDeriveShortcodes(markdown) {
  extractLegacyDeriveReferences(markdown);
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
    coverCrop: validateCoverCrop(payload.coverCrop),
    markdown,
    readingMinutes: readingMinutesValue(payload.readingMinutes),
    date: optionalText(payload.date || new Date().toISOString().slice(0, 10), "日期", 32),
    publishStatus: enumValue(payload.publishStatus, ["draft", "published"], "draft", "发布状态"),
    featured: booleanValue(payload.featured),
    featuredOrder: numberValue(payload.featuredOrder, "轮播槽位", { min: 0, max: 3 }),
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
    featuredOrder: numberValue(payload.featuredOrder, "轮播槽位", { min: 0, max: 3 }),
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
  analyzeFormulaDependencyGraph,
  extractLegacyDeriveReferences,
  extractFormulaDependencyReferences,
  validateFormulaDependencyGraph,
  validatePostPayload,
  validateProjectPayload,
  validateKnowledgeNodePayload,
  validateFormulaCardPayload,
  validateFormulaClassificationPayload,
  validateFormulaDecisionPayload,
  validateFormulaDerivationPayload,
  validateFormulaRelationRepairEventPayload,
  validateFocusModePayload,
  validateCarouselBufferRestorePayload,
  validateFormulaCatalogPackage,
  validateFormulaReferenceShortcodes,
  validateCoverCrop,
  formulaSelectionIdentity,
  parseLatexSelectionText,
  sourceTextHash,
  validateSourceHash,
  validateLatexSelection,
  validateUploadPayload
};
