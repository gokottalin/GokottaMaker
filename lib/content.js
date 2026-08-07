"use strict";

const crypto = require("node:crypto");
const {
  extractFormulaDependencyReferences,
  sourceTextHash,
  validateFormulaDependencyGraph
} = require("./validators");

function normalizeFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1" ? 1 : 0;
}

function visibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND publish_status = 'published'";
}

function projectVisibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND visibility_status = 'published' AND status_key = 'online'";
}

function tagSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function splitTags(tags) {
  return String(tags || "")
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const KNOWLEDGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
const KNOWLEDGE_COLOR_TOKENS = new Set(["purple", "blue", "green", "amber", "red", "neutral"]);
const FORMULA_REFERENCE_PATTERN =
  /\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}/g;
const FORMULA_GRAPH_INITIAL_NODE_LIMIT = 24;
const FORMULA_GRAPH_PAYLOAD_NODE_LIMIT = 240;
const FOCUS_SCOPES = Object.freeze(["electronics-basics", "derivations", "projects"]);
const FOCUS_SCOPE_ALIASES = Object.freeze({ "power-electronics": "electronics-basics" });

function normalizedFocusScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  return FOCUS_SCOPE_ALIASES[scope] || scope;
}

function moduleTags(value) {
  return String(value || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.startsWith("module:"))
    .map((tag) => normalizedFocusScope(tag.slice("module:".length)));
}

function focusScopeForContent(item = {}, contentType = item.type || "") {
  if (contentType === "project") return "projects";
  if (contentType === "knowledge_node" || item.nodeType === "derivation") return "derivations";
  const explicitScopes = [
    normalizedFocusScope(item.categoryKey),
    ...moduleTags(item.tags)
  ];
  if (explicitScopes.includes("electronics-basics")) return "electronics-basics";
  if (explicitScopes.includes("projects")) return "projects";
  if (explicitScopes.includes("derivations")) return "derivations";
  if (["电子基础", "电力电子"].includes(String(item.category || "").trim())) return "electronics-basics";
  if (String(item.tags || "").split(/[,，、]/).some((tag) => tag.trim().startsWith("公式"))) return "derivations";
  const markdown = String(item.markdown || "");
  if (/\{\{(?:formula|derive):/.test(markdown)) {
    return "derivations";
  }
  return "";
}

function isContentInFocusScope(item = {}, contentType = item.type || "") {
  return FOCUS_SCOPES.includes(focusScopeForContent(item, contentType));
}

function formulaRevisionId({
  formulaId,
  latex,
  markdownDerivation = "",
  sourceBookId = "",
  sourceBookRevision = "",
  sourceFormulaId = "",
  displayName = "",
  moduleKey = "",
  categoryPath = "",
  purpose = "",
  tags = [],
  dependencyFormulaIds = [],
  forceDependencyRevision = false
}) {
  const identity = [formulaId, latex, sourceBookId, sourceBookRevision, sourceFormulaId];
  if (markdownDerivation) identity.push("markdown-derivation", markdownDerivation);
  identity.push(
    "presentation-v1",
    displayName,
    moduleKey,
    categoryPath,
    purpose,
    [...tags]
  );
  if (forceDependencyRevision) {
    identity.push("dependency-membership-v1", [...dependencyFormulaIds]);
  }
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")
    .slice(0, 32);
  return `rev.${digest}`;
}

function normalizedClassificationName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .toLowerCase();
}

function generatedClassificationSlug(value) {
  const normalized = normalizedClassificationName(value);
  const ascii = normalized
    .replace(/[·•・:：/／\\_,，、;；]+/g, "-")
    .replace(/['"“”‘’()[\]{}<>《》]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii && ascii.length <= 136 && !/[\u4e00-\u9fff]/u.test(normalized)) return ascii;
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `${ascii.slice(0, 132).replace(/-$/g, "") || "item"}-${digest}`;
}

function formulaClassificationId(kind, parentSlug, normalizedName) {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify([kind, parentSlug, normalizedName]))
    .digest("hex")
    .slice(0, 24);
  return `cls.${kind}.${digest}`;
}

function contentError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function maskMarkdownIgnoredRegions(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ");
}

function extractDeriveLinks(markdown) {
  const source = maskMarkdownIgnoredRegions(markdown);
  const shortcodePattern = /\{\{derive:([^|{}\s]+)\|([^|{}]+?)(?:\|([^|{}]+?))?\}\}/g;
  const seen = new Set();
  const links = [];
  let match;

  while ((match = shortcodePattern.exec(source))) {
    const targetSlug = String(match[1] || "").trim().toLowerCase();
    const label = String(match[2] || "").trim();
    const colorToken = String(match[3] || "purple").trim().toLowerCase();

    if (!KNOWLEDGE_SLUG_PATTERN.test(targetSlug)) {
      throw contentError(400, "推导短码 target slug 不合法");
    }
    if (!label || label.length > 80) {
      throw contentError(400, "推导短码 label 不能为空且不能超过 80 个字符");
    }
    if (!KNOWLEDGE_COLOR_TOKENS.has(colorToken)) {
      throw contentError(400, "推导短码颜色 token 不合法");
    }
    if (seen.has(targetSlug)) continue;
    seen.add(targetSlug);
    links.push({
      targetSlug,
      label,
      colorToken,
      linkKind: "derive",
      ordinal: links.length
    });
  }

  return links;
}

function maskMarkdownCodeRegions(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, (match) => " ".repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => " ".repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
}

function extractFormulaReferences(markdown) {
  const source = maskMarkdownCodeRegions(markdown);
  const references = [];
  const seen = new Set();
  let match;
  FORMULA_REFERENCE_PATTERN.lastIndex = 0;
  while ((match = FORMULA_REFERENCE_PATTERN.exec(source))) {
    const reference = {
      bindingId: match[1],
      formulaId: match[2],
      revisionId: match[3],
      displayMode: match[4],
      ordinal: references.length,
      start: match.index,
      end: match.index + match[0].length
    };
    if (seen.has(reference.bindingId)) {
      throw contentError(400, `文章公式 bindingId 重复：${reference.bindingId}`);
    }
    if (reference.displayMode === "display") {
      const lineStart = source.lastIndexOf("\n", match.index - 1) + 1;
      const nextBreak = source.indexOf("\n", match.index + match[0].length);
      const lineEnd = nextBreak < 0 ? source.length : nextBreak;
      if (source.slice(lineStart, lineEnd).trim() !== match[0]) {
        throw contentError(400, "块级公式卡引用必须单独占一行");
      }
    }
    seen.add(reference.bindingId);
    references.push(reference);
  }
  return references;
}

function formulaBindingShortcode(binding) {
  return `{{formula:${binding.bindingId}|${binding.formulaId}|${binding.revisionId}|${binding.displayMode}}}`;
}

function formulaBindingMarkdown(markdown, selection, shortcode) {
  const source = String(markdown || "");
  const start = Number(selection?.selectionStart);
  const end = Number(selection?.selectionEnd);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > source.length ||
    source.slice(start, end) !== selection.selectedText
  ) {
    throw contentError(409, "文章公式选区已变化，请重新框选后再创建");
  }
  const before = source.slice(0, end);
  const after = source.slice(end);
  if (selection.displayMode === "display") {
    const leadingBreak = before.endsWith("\n") ? "" : "\n";
    const trailingBreak = after.startsWith("\n") || !after ? "" : "\n";
    const inserted = `${leadingBreak}${shortcode}${trailingBreak}`;
    return {
      markdown: `${before}${inserted}${after}`,
      bindingStart: end + leadingBreak.length,
      bindingEnd: end + leadingBreak.length + shortcode.length,
      cursor: end + inserted.length
    };
  }
  return {
    markdown: `${before}${shortcode}${after}`,
    bindingStart: end,
    bindingEnd: end + shortcode.length,
    cursor: end + shortcode.length
  };
}

function createContentStore(db) {
  let transactionDepth = 0;

  function withTransaction(work) {
    if (transactionDepth > 0) return work();
    db.exec("BEGIN IMMEDIATE");
    transactionDepth = 1;
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Keep the original application error.
      }
      throw error;
    } finally {
      transactionDepth = 0;
    }
  }

  function heroCarouselSlotForContent(contentType, contentId) {
    return (
      db
        .prepare(
          `SELECT slot, content_type AS contentType, content_id AS contentId,
                  content_title AS contentTitle, assignment_source AS assignmentSource,
                  assigned_by_user_id AS assignedByUserId,
                  assigned_by_username AS assignedByUsername,
                  assigned_at AS assignedAt, updated_at AS updatedAt
           FROM hero_carousel_slots
           WHERE content_type = ? AND content_id = ?`
        )
        .get(contentType, contentId) || null
    );
  }

  function heroCarouselSlotOccupant(slot) {
    return (
      db
        .prepare(
          `SELECT slot, content_type AS contentType, content_id AS contentId,
                  content_title AS contentTitle, assignment_source AS assignmentSource,
                  assigned_by_user_id AS assignedByUserId,
                  assigned_by_username AS assignedByUsername,
                  assigned_at AS assignedAt, updated_at AS updatedAt
           FROM hero_carousel_slots
           WHERE slot = ?`
        )
        .get(slot) || null
    );
  }

  function heroCarouselConflict(slot, occupant) {
    const linked =
      occupant?.contentType === "project"
        ? projectById(occupant.contentId)
        : postById(occupant?.contentId);
    const title = linked?.title || occupant?.contentTitle || "未命名内容";
    const error = contentError(409, `轮播槽位 ${slot + 1} 已被《${title}》使用，请选择空槽位`);
    error.reasonCode = "CAROUSEL_SLOT_CONFLICT";
    error.occupant = {
      slot,
      contentType: occupant?.contentType || "",
      contentId: occupant?.contentId || "",
      title
    };
    return error;
  }

  function syncLegacyCarouselFields(contentType, contentId, slot = null) {
    const table = contentType === "project" ? "projects" : "posts";
    db.prepare(`UPDATE ${table} SET featured = ?, featured_order = ? WHERE id = ?`).run(
      slot === null ? 0 : 1,
      slot === null ? 0 : slot,
      contentId
    );
  }

  function assignHeroCarouselSlot(contentType, contentId, slot, options = {}) {
    const normalizedSlot = Number(slot);
    if (!Number.isInteger(normalizedSlot) || normalizedSlot < 0 || normalizedSlot > 3) {
      const error = contentError(400, "轮播槽位必须是 1 至 4");
      error.reasonCode = "CAROUSEL_SLOT_INVALID";
      throw error;
    }
    const linked = contentType === "project" ? projectById(contentId) : postById(contentId);
    if (!linked) {
      const error = contentError(404, "轮播内容不存在");
      error.reasonCode = "CAROUSEL_REFERENCE_MISSING";
      throw error;
    }
    const occupant = heroCarouselSlotOccupant(normalizedSlot);
    if (occupant && !(occupant.contentType === contentType && occupant.contentId === contentId)) {
      throw heroCarouselConflict(normalizedSlot, occupant);
    }

    const actor = actorFields(options.actor);
    db.prepare("DELETE FROM hero_carousel_slots WHERE content_type = ? AND content_id = ?").run(
      contentType,
      contentId
    );
    try {
      db.prepare(
        `INSERT INTO hero_carousel_slots
          (slot, content_type, content_id, content_title, assignment_source,
           assigned_by_user_id, assigned_by_username, assigned_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run(
        normalizedSlot,
        contentType,
        contentId,
        linked.title || "",
        options.source || "content_save",
        actor.id,
        actor.username
      );
    } catch (error) {
      const currentOccupant = heroCarouselSlotOccupant(normalizedSlot);
      if (currentOccupant) throw heroCarouselConflict(normalizedSlot, currentOccupant);
      throw error;
    }
    syncLegacyCarouselFields(contentType, contentId, normalizedSlot);
    return heroCarouselSlotForContent(contentType, contentId);
  }

  function removeHeroCarouselSlot(contentType, contentId) {
    const previous = heroCarouselSlotForContent(contentType, contentId);
    db.prepare("DELETE FROM hero_carousel_slots WHERE content_type = ? AND content_id = ?").run(
      contentType,
      contentId
    );
    syncLegacyCarouselFields(contentType, contentId, null);
    return previous;
  }

  function syncHeroCarouselAssignment(contentType, payload, options = {}) {
    if (!payload.featured) return removeHeroCarouselSlot(contentType, payload.id);
    return assignHeroCarouselSlot(contentType, payload.id, payload.featuredOrder, options);
  }

  function listHeroCarouselSlots() {
    return db
      .prepare(
        `SELECT slot, content_type AS contentType, content_id AS contentId,
                content_title AS contentTitle, assignment_source AS assignmentSource,
                assigned_by_user_id AS assignedByUserId,
                assigned_by_username AS assignedByUsername,
                assigned_at AS assignedAt, updated_at AS updatedAt
         FROM hero_carousel_slots
         ORDER BY slot ASC`
      )
      .all()
      .map((slot) => {
        const linkedContent =
          slot.contentType === "project" ? projectById(slot.contentId) : postById(slot.contentId);
        const referenceStatus = !linkedContent
          ? "missing"
          : linkedContent.deletedAt
            ? "archived"
            : "available";
        return {
          ...slot,
          ...(linkedContent || {}),
          contentType: slot.contentType,
          id: slot.contentId,
          title: linkedContent?.title || slot.contentTitle || slot.contentId,
          featured: true,
          featuredOrder: slot.slot,
          linkedContent,
          referenceStatus
        };
      });
  }

  function listHeroCarouselSlotConflicts() {
    return db
      .prepare(
        `SELECT report_id AS reportId, migration_id AS migrationId, slot,
                content_type AS contentType, content_id AS contentId,
                content_title AS contentTitle, reason_code AS reasonCode,
                resolution_status AS resolutionStatus, detected_at AS detectedAt
         FROM hero_carousel_slot_conflicts
         ORDER BY slot ASC, report_id ASC`
      )
      .all();
  }

  function syncTags(type, contentId, tags) {
    const table = type === "project" ? "project_tags" : "post_tags";
    const idColumn = type === "project" ? "project_id" : "post_id";
    db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).run(contentId);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)");
    const getTag = db.prepare("SELECT id FROM tags WHERE slug = ?");
    const insertLink = db.prepare(`INSERT OR IGNORE INTO ${table} (${idColumn}, tag_id) VALUES (?, ?)`);

    for (const name of splitTags(tags)) {
      const slug = tagSlug(name);
      if (!slug) continue;
      insertTag.run(name, slug);
      const tag = getTag.get(slug);
      if (tag) insertLink.run(contentId, tag.id);
    }
  }

  function formulaBindingsForPost(postId) {
    return db
      .prepare(
        `SELECT b.binding_id AS bindingId, b.formula_id AS formulaId,
                b.revision_id AS revisionId, b.display_mode AS displayMode,
                b.ordinal, c.slug, c.display_name AS displayName,
                c.module_key AS moduleKey, c.category_path AS categoryPath,
                c.purpose, c.archived_at AS archivedAt,
                r.sequence_no AS revisionSequence, r.latex
         FROM article_formula_bindings b
         JOIN formula_cards c ON c.formula_id = b.formula_id
         JOIN formula_revisions r ON r.revision_id = b.revision_id
         WHERE b.post_id = ?
         ORDER BY b.ordinal ASC, b.binding_id ASC`
      )
      .all(postId)
      .map((binding) => ({ ...binding, archiveState: binding.archivedAt ? "archived" : "active" }));
  }

  function decoratePost(row) {
    if (!row) return null;
    const {
      coverCropX,
      coverCropY,
      coverCropWidth,
      coverCropHeight,
      coverCropSourceWidth,
      coverCropSourceHeight,
      ...post
    } = row;
    const cropValues = [
      coverCropX,
      coverCropY,
      coverCropWidth,
      coverCropHeight,
      coverCropSourceWidth,
      coverCropSourceHeight
    ];
    const coverCrop = cropValues.every((value) => value === null || value === undefined)
      ? null
      : {
          x: Number(coverCropX),
          y: Number(coverCropY),
          width: Number(coverCropWidth),
          height: Number(coverCropHeight),
          sourceWidth: Number(coverCropSourceWidth),
          sourceHeight: Number(coverCropSourceHeight)
        };
    return { ...post, coverCrop, formulaBindings: formulaBindingsForPost(row.id) };
  }

  function allPosts(admin = false) {
    return db
      .prepare(
        `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
                recommendation_priority AS recommendationPriority,
                excerpt, cover,
                cover_crop_x AS coverCropX, cover_crop_y AS coverCropY,
                cover_crop_width AS coverCropWidth, cover_crop_height AS coverCropHeight,
                cover_crop_source_width AS coverCropSourceWidth,
                cover_crop_source_height AS coverCropSourceHeight,
                markdown, reading_minutes AS readingMinutes, date,
                publish_status AS publishStatus,
                EXISTS(
                  SELECT 1 FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'post' AND hero.content_id = posts.id
                ) AS featured,
                COALESCE((
                  SELECT hero.slot FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'post' AND hero.content_id = posts.id
                ), 0) AS featuredOrder,
                deleted_at AS deletedAt, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM posts
         ${visibilityFilter(admin)}
         ORDER BY deleted_at IS NOT NULL ASC, recommendation_priority ASC, date DESC, updated_at DESC`
      )
      .all()
      .map(decoratePost);
  }

  function allProjects(admin = false) {
    return db
      .prepare(
        `SELECT id, slug, 'project' AS type, title, status, status_key AS statusKey,
                summary, cover, markdown, license, stars, date,
                visibility_status AS visibilityStatus,
                EXISTS(
                  SELECT 1 FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'project' AND hero.content_id = projects.id
                ) AS featured,
                COALESCE((
                  SELECT hero.slot FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'project' AND hero.content_id = projects.id
                ), 0) AS featuredOrder,
                deleted_at AS deletedAt,
                repo_url AS repoUrl, bom_url AS bomUrl, docs_url AS docsUrl, version, progress, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM projects
         ${projectVisibilityFilter(admin)}
         ORDER BY deleted_at IS NOT NULL ASC, updated_at DESC`
      )
      .all();
  }

  function carouselBufferRecord(row) {
    if (!row) return null;
    const linkedContent = row.contentType === "project" ? projectById(row.contentId) : postById(row.contentId);
    const referenceStatus = !linkedContent ? "missing" : linkedContent.deletedAt ? "archived" : "available";
    return {
      ...row,
      linkedContent,
      referenceStatus,
      displayTitle: linkedContent?.title || row.contentTitle || row.contentId,
      displayImage: linkedContent?.cover || row.imageReference || ""
    };
  }

  function listCarouselFocusBuffer({ status = "buffered" } = {}) {
    const where = status === "all" ? "" : "WHERE status = ?";
    const rows = db
      .prepare(
        `SELECT buffer_id AS bufferId, content_type AS contentType, content_id AS contentId,
                content_slug AS contentSlug, content_title AS contentTitle,
                image_reference AS imageReference, original_slot AS originalSlot,
                buffered_reason AS bufferedReason, status,
                buffered_at AS bufferedAt, updated_at AS updatedAt,
                restored_at AS restoredAt, removed_at AS removedAt
         FROM carousel_focus_buffer
         ${where}
         ORDER BY original_slot ASC, buffered_at ASC, buffer_id ASC`
      )
      .all(...(status === "all" ? [] : [status]));
    return rows.map(carouselBufferRecord);
  }

  function carouselFocusBufferById(bufferId) {
    const row = db
      .prepare(
        `SELECT buffer_id AS bufferId, content_type AS contentType, content_id AS contentId,
                content_slug AS contentSlug, content_title AS contentTitle,
                image_reference AS imageReference, original_slot AS originalSlot,
                buffered_reason AS bufferedReason, status,
                buffered_at AS bufferedAt, updated_at AS updatedAt,
                restored_at AS restoredAt, removed_at AS removedAt
         FROM carousel_focus_buffer
         WHERE buffer_id = ?`
      )
      .get(bufferId);
    return carouselBufferRecord(row);
  }

  function carouselBufferError(status, reasonCode, message) {
    const error = contentError(status, message);
    error.reasonCode = reasonCode;
    return error;
  }

  function reconcileCarouselFocusBuffer(isEligible) {
    return withTransaction(() => {
      const candidates = [
        ...allPosts(true).map((item) => ({ ...item, contentType: "post" })),
        ...allProjects(true).map((item) => ({ ...item, contentType: "project" }))
      ].filter((item) => item.featured && !item.deletedAt && !isEligible(item, item.contentType));
      const upsert = db.prepare(
        `INSERT INTO carousel_focus_buffer
          (buffer_id, content_type, content_id, content_slug, content_title,
           image_reference, original_slot, buffered_reason, status,
           buffered_at, updated_at, restored_at, removed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CAROUSEL_FOCUS_SCOPE_OUTSIDE', 'buffered',
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL)
         ON CONFLICT(content_type, content_id) DO UPDATE SET
           content_slug = excluded.content_slug,
           content_title = excluded.content_title,
           image_reference = excluded.image_reference,
           original_slot = excluded.original_slot,
           buffered_reason = excluded.buffered_reason,
           status = 'buffered',
           buffered_at = CASE
             WHEN carousel_focus_buffer.status = 'buffered'
               THEN carousel_focus_buffer.buffered_at
             ELSE CURRENT_TIMESTAMP
           END,
           updated_at = CURRENT_TIMESTAMP,
           restored_at = NULL,
           removed_at = NULL`
      );
      for (const item of candidates) {
        upsert.run(
          `carousel:${item.contentType}:${item.id}`,
          item.contentType,
          item.id,
          item.slug || item.id,
          item.title || "",
          item.cover || "",
          Number(item.featuredOrder || 0)
        );
        removeHeroCarouselSlot(item.contentType, item.id);
      }
      return {
        bufferedNow: candidates.length,
        buffered: listCarouselFocusBuffer(),
        reasonCode: "CAROUSEL_BUFFER_RECONCILED"
      };
    });
  }

  function restoreCarouselFocusBuffer(bufferId, slot) {
    return withTransaction(() => {
      const buffer = carouselFocusBufferById(bufferId);
      if (!buffer || buffer.status !== "buffered") {
        throw carouselBufferError(404, "CAROUSEL_BUFFER_NOT_FOUND", "轮播缓冲项不存在或已处理");
      }
      if (buffer.referenceStatus === "missing") {
        throw carouselBufferError(409, "CAROUSEL_REFERENCE_MISSING", "关联内容已缺失，不能恢复到轮播");
      }
      if (buffer.referenceStatus === "archived") {
        throw carouselBufferError(409, "CAROUSEL_REFERENCE_ARCHIVED", "关联内容已归档或在回收站，不能恢复到轮播");
      }
      assignHeroCarouselSlot(buffer.contentType, buffer.contentId, slot, {
        source: "focus_buffer_restore"
      });
      db.prepare(
        `UPDATE carousel_focus_buffer
         SET status = 'restored', restored_at = CURRENT_TIMESTAMP,
             removed_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE buffer_id = ?`
      ).run(bufferId);
      return {
        item: buffer.contentType === "project" ? projectById(buffer.contentId) : postById(buffer.contentId),
        buffer: carouselFocusBufferById(bufferId)
      };
    });
  }

  function removeCarouselFocusBuffer(bufferId) {
    return withTransaction(() => {
      const buffer = carouselFocusBufferById(bufferId);
      if (!buffer || buffer.status !== "buffered") {
        throw carouselBufferError(404, "CAROUSEL_BUFFER_NOT_FOUND", "轮播缓冲项不存在或已处理");
      }
      db.prepare(
        `UPDATE carousel_focus_buffer
         SET status = 'removed', removed_at = CURRENT_TIMESTAMP,
             restored_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE buffer_id = ?`
      ).run(bufferId);
      return carouselFocusBufferById(bufferId);
    });
  }

  function postById(id) {
    return decoratePost(
      db.prepare(
        `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
                recommendation_priority AS recommendationPriority,
                excerpt, cover,
                cover_crop_x AS coverCropX, cover_crop_y AS coverCropY,
                cover_crop_width AS coverCropWidth, cover_crop_height AS coverCropHeight,
                cover_crop_source_width AS coverCropSourceWidth,
                cover_crop_source_height AS coverCropSourceHeight,
                markdown, reading_minutes AS readingMinutes, date,
                publish_status AS publishStatus,
                EXISTS(
                  SELECT 1 FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'post' AND hero.content_id = posts.id
                ) AS featured,
                COALESCE((
                  SELECT hero.slot FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'post' AND hero.content_id = posts.id
                ), 0) AS featuredOrder,
                deleted_at AS deletedAt, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM posts
         WHERE id = ?`
      ).get(id)
    );
  }

  function projectById(id) {
    return db
      .prepare(
        `SELECT id, slug, 'project' AS type, title, status, status_key AS statusKey,
                summary, cover, markdown, license, stars, date,
                visibility_status AS visibilityStatus,
                EXISTS(
                  SELECT 1 FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'project' AND hero.content_id = projects.id
                ) AS featured,
                COALESCE((
                  SELECT hero.slot FROM hero_carousel_slots hero
                  WHERE hero.content_type = 'project' AND hero.content_id = projects.id
                ), 0) AS featuredOrder,
                deleted_at AS deletedAt,
                repo_url AS repoUrl, bom_url AS bomUrl, docs_url AS docsUrl, version, progress, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM projects
         WHERE id = ?`
      )
      .get(id);
  }

  function actorFields(actor = {}) {
    return {
      id: actor?.id || null,
      username: actor?.username || ""
    };
  }

  function createRevision(type, contentId, reason = "save", actor = {}) {
    const snapshot = type === "project" ? projectById(contentId) : postById(contentId);
    if (!snapshot) return null;
    const actorInfo = actorFields(actor);
    db.prepare(
      `INSERT INTO content_revisions
        (content_type, content_id, content_title, revision_reason, snapshot_json, source_updated_at, actor_user_id, actor_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      type,
      contentId,
      snapshot.title || "",
      reason || "save",
      JSON.stringify(snapshot),
      snapshot.updatedAt || "",
      actorInfo.id,
      actorInfo.username
    );
    return db.prepare("SELECT last_insert_rowid() AS id").get().id;
  }

  function listRevisions(type, contentId, limit = 50) {
    const rows = db
      .prepare(
        `SELECT id, content_type AS contentType, content_id AS contentId, content_title AS contentTitle,
                revision_reason AS revisionReason, snapshot_json AS snapshotJson,
                source_updated_at AS sourceUpdatedAt, actor_user_id AS actorUserId,
                actor_username AS actorUsername, created_at AS createdAt
         FROM content_revisions
         WHERE content_type = ? AND content_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(type, contentId, Math.max(1, Math.min(Number(limit || 50), 200)));

    return rows.map((row) => {
      const snapshot = JSON.parse(row.snapshotJson);
      delete row.snapshotJson;
      return { ...row, snapshot };
    });
  }

  function revisionById(type, contentId, revisionId) {
    const row = db
      .prepare(
        `SELECT id, content_type AS contentType, content_id AS contentId, snapshot_json AS snapshotJson
         FROM content_revisions
         WHERE content_type = ? AND content_id = ? AND id = ?`
      )
      .get(type, contentId, Number(revisionId));
    return row ? { ...row, snapshot: JSON.parse(row.snapshotJson) } : null;
  }

  function notFound(message) {
    const error = new Error(message);
    error.status = 404;
    return error;
  }

  function knowledgeNodeColumns() {
    return `id, slug, 'knowledge_node' AS type, node_type AS nodeType, symbol, title,
            summary, markdown, cover, accent_color AS accentColor, tags,
            publish_status AS publishStatus, visibility_status AS visibilityStatus,
            deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt,
            published_at AS publishedAt`;
  }

  function allKnowledgeNodes(admin = false) {
    const where = admin ? "" : "WHERE deleted_at IS NULL AND publish_status = 'published' AND visibility_status = 'public'";
    return db
      .prepare(
        `SELECT ${knowledgeNodeColumns()}
         FROM knowledge_nodes
         ${where}
         ORDER BY deleted_at IS NOT NULL ASC, updated_at DESC, title ASC`
      )
      .all();
  }

  function knowledgeNodeById(id) {
    const key = String(id || "");
    if (!key) return null;
    const byId = db.prepare(`SELECT ${knowledgeNodeColumns()} FROM knowledge_nodes WHERE id = ?`).get(key);
    if (byId) return byId;
    return db.prepare(`SELECT ${knowledgeNodeColumns()} FROM knowledge_nodes WHERE slug = ?`).get(key) || null;
  }

  function knowledgeNodeBySlugAny(slug) {
    const key = String(slug || "");
    if (!key) return null;
    return db.prepare(`SELECT ${knowledgeNodeColumns()} FROM knowledge_nodes WHERE slug = ?`).get(key) || null;
  }

  function publicKnowledgeNodeBaseBySlug(slug) {
    const key = String(slug || "");
    if (!key) return null;
    return (
      db
        .prepare(
          `SELECT ${knowledgeNodeColumns()}
           FROM knowledge_nodes
           WHERE slug = ?
             AND deleted_at IS NULL
             AND publish_status = 'published'
             AND visibility_status IN ('public', 'unlisted')`
        )
        .get(key) || null
    );
  }

  function compactKnowledgeNode(node, admin = false) {
    if (!node) return null;
    const result = {
      id: node.id,
      slug: node.slug,
      type: node.type,
      nodeType: node.nodeType,
      symbol: node.symbol,
      title: node.title,
      summary: node.summary,
      accentColor: node.accentColor,
      publishStatus: node.publishStatus,
      visibilityStatus: node.visibilityStatus
    };
    if (admin) result.deletedAt = node.deletedAt;
    return result;
  }

  function rawKnowledgeLinksForSource(sourceType, sourceId) {
    return db
      .prepare(
        `SELECT source_type AS sourceType, source_id AS sourceId, source_slug AS sourceSlug,
                target_slug AS targetSlug, label, color_token AS colorToken,
                link_kind AS linkKind, ordinal
         FROM knowledge_links
         WHERE source_type = ? AND source_id = ?
         ORDER BY ordinal ASC, id ASC`
      )
      .all(sourceType, sourceId);
  }

  function knowledgeLinksForSource(sourceType, sourceId, options = {}) {
    const admin = Boolean(options.admin);
    return rawKnowledgeLinksForSource(sourceType, sourceId).map((link) => {
      const target = admin ? knowledgeNodeBySlugAny(link.targetSlug) : publicKnowledgeNodeBaseBySlug(link.targetSlug);
      return {
        ...link,
        resolved: Boolean(target),
        target: target ? compactKnowledgeNode(target, admin) : null
      };
    });
  }

  function knowledgeBacklinksForTarget(targetSlug, options = {}) {
    const admin = Boolean(options.admin);
    return db
      .prepare(
        `SELECT source_type AS sourceType, source_id AS sourceId, source_slug AS sourceSlug,
                target_slug AS targetSlug, label, color_token AS colorToken,
                link_kind AS linkKind, ordinal
         FROM knowledge_links
         WHERE target_slug = ? AND source_type = 'knowledge_node'
         ORDER BY updated_at DESC, ordinal ASC`
      )
      .all(targetSlug)
      .map((link) => {
        const source = admin ? knowledgeNodeById(link.sourceId) : publicKnowledgeNodeBaseBySlug(link.sourceSlug);
        if (!source) return null;
        return {
          ...link,
          source: compactKnowledgeNode(source, admin)
        };
      })
      .filter(Boolean);
  }

  function decorateKnowledgeNode(node, options = {}) {
    if (!node) return null;
    const admin = Boolean(options.admin);
    return {
      ...node,
      links: knowledgeLinksForSource("knowledge_node", node.id, { admin }),
      backlinks: knowledgeBacklinksForTarget(node.slug, { admin })
    };
  }

  function publicKnowledgeNodeBySlug(slug) {
    return decorateKnowledgeNode(publicKnowledgeNodeBaseBySlug(slug), { admin: false });
  }

  function adminKnowledgeNode(id) {
    return decorateKnowledgeNode(knowledgeNodeById(id), { admin: true });
  }

  function knowledgeLinkSummary(links) {
    const dangling = [];
    for (const link of links) {
      if (!knowledgeNodeBySlugAny(link.targetSlug)) dangling.push(link.targetSlug);
    }
    const danglingTargets = [...new Set(dangling)];
    return {
      linksCount: links.length,
      danglingCount: danglingTargets.length,
      warnings: danglingTargets.map((slug) => `dangling derive target: ${slug}`)
    };
  }

  function syncKnowledgeLinksFromMarkdown({ sourceType, sourceId, sourceSlug, markdown }) {
    const links = extractDeriveLinks(markdown);
    db.prepare("DELETE FROM knowledge_links WHERE source_type = ? AND source_id = ?").run(sourceType, sourceId);
    const insertLink = db.prepare(
      `INSERT INTO knowledge_links
        (source_type, source_id, source_slug, target_slug, label, color_token, link_kind, ordinal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(source_type, source_id, target_slug, link_kind) DO UPDATE SET
         source_slug = excluded.source_slug,
         label = excluded.label,
         color_token = excluded.color_token,
         ordinal = excluded.ordinal,
         updated_at = CURRENT_TIMESTAMP`
    );
    for (const link of links) {
      insertLink.run(sourceType, sourceId, sourceSlug || "", link.targetSlug, link.label, link.colorToken, link.linkKind, link.ordinal);
    }
    const summary = knowledgeLinkSummary(links);
    return { ...summary, links };
  }

  function createKnowledgeNodeRevision(nodeId, reason = "save", actor = {}) {
    const snapshot = knowledgeNodeById(nodeId);
    if (!snapshot) return null;
    const actorInfo = actorFields(actor);
    const links = rawKnowledgeLinksForSource("knowledge_node", snapshot.id).map((link) => ({
      targetSlug: link.targetSlug,
      label: link.label,
      colorToken: link.colorToken,
      linkKind: link.linkKind,
      ordinal: link.ordinal
    }));
    db.prepare(
      `INSERT INTO knowledge_node_revisions
        (node_id, node_slug, node_title, revision_reason, snapshot_json, source_updated_at, actor_user_id, actor_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      snapshot.id,
      snapshot.slug,
      snapshot.title || "",
      reason || "save",
      JSON.stringify({ node: snapshot, links }),
      snapshot.updatedAt || "",
      actorInfo.id,
      actorInfo.username
    );
    return db.prepare("SELECT last_insert_rowid() AS id").get().id;
  }

  function knowledgeNodeRevisionReason(existing, payload) {
    if (!existing) return "save";
    if (payload.publishStatus === "published" && existing.publishStatus !== "published") return "publish";
    if (payload.publishStatus === "archived" && existing.publishStatus !== "archived") return "archive";
    if (existing.publishStatus === "published" && payload.publishStatus !== "published") return "unpublish";
    return "save";
  }

  function saveKnowledgeNode(payload) {
    return withTransaction(() => {
      const existing = knowledgeNodeById(payload.id);
      const slugOwner = knowledgeNodeBySlugAny(payload.slug);
      if (slugOwner && slugOwner.id !== payload.id) {
        throw contentError(400, "推导节点 slug 已存在");
      }
      if (existing) createKnowledgeNodeRevision(existing.id, knowledgeNodeRevisionReason(existing, payload), payload.actor);

      db.prepare(
        `INSERT INTO knowledge_nodes
          (id, slug, node_type, symbol, title, summary, markdown, cover, accent_color, tags,
           publish_status, visibility_status, deleted_at, created_at, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug,
           node_type = excluded.node_type,
           symbol = excluded.symbol,
           title = excluded.title,
           summary = excluded.summary,
           markdown = excluded.markdown,
           cover = excluded.cover,
           accent_color = excluded.accent_color,
           tags = excluded.tags,
           publish_status = excluded.publish_status,
           visibility_status = excluded.visibility_status,
           deleted_at = knowledge_nodes.deleted_at,
           published_at = CASE
             WHEN excluded.publish_status = 'published' THEN COALESCE(knowledge_nodes.published_at, CURRENT_TIMESTAMP)
             ELSE knowledge_nodes.published_at
           END,
           updated_at = CURRENT_TIMESTAMP`
      ).run(
        payload.id,
        payload.slug,
        payload.nodeType || "derivation",
        payload.symbol,
        payload.title,
        payload.summary || "",
        payload.markdown || "",
        payload.cover || "",
        payload.accentColor || "purple",
        payload.tags || "",
        payload.publishStatus || "draft",
        payload.visibilityStatus || "public",
        payload.publishStatus === "published" ? new Date().toISOString() : null
      );

      const node = knowledgeNodeById(payload.id);
      const linkSummary = syncKnowledgeLinksFromMarkdown({
        sourceType: "knowledge_node",
        sourceId: node.id,
        sourceSlug: node.slug,
        markdown: node.markdown
      });
      return {
        node: decorateKnowledgeNode(node, { admin: true }),
        warnings: linkSummary.warnings,
        linkSummary
      };
    });
  }

  function softDeleteKnowledgeNode(id, options = {}) {
    return withTransaction(() => {
      const node = knowledgeNodeById(id);
      if (!node) throw notFound("knowledge node not found");
      createKnowledgeNodeRevision(node.id, "soft_delete", options.actor);
      db.prepare("UPDATE knowledge_nodes SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(node.id);
      return decorateKnowledgeNode(knowledgeNodeById(node.id), { admin: true });
    });
  }

  function restoreKnowledgeNode(id, options = {}) {
    return withTransaction(() => {
      const node = knowledgeNodeById(id);
      if (!node) throw notFound("knowledge node not found");
      createKnowledgeNodeRevision(node.id, "restore", options.actor);
      db.prepare("UPDATE knowledge_nodes SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(node.id);
      return decorateKnowledgeNode(knowledgeNodeById(node.id), { admin: true });
    });
  }

  function listKnowledgeNodeRevisions(id, limit = 50) {
    const node = knowledgeNodeById(id);
    if (!node) return [];
    const rows = db
      .prepare(
        `SELECT id, node_id AS nodeId, node_slug AS nodeSlug, node_title AS nodeTitle,
                revision_reason AS revisionReason, snapshot_json AS snapshotJson,
                source_updated_at AS sourceUpdatedAt, actor_user_id AS actorUserId,
                actor_username AS actorUsername, created_at AS createdAt
         FROM knowledge_node_revisions
         WHERE node_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(node.id, Math.max(1, Math.min(Number(limit || 50), 200)));

    return rows.map((row) => {
      const snapshot = JSON.parse(row.snapshotJson);
      delete row.snapshotJson;
      return { ...row, snapshot };
    });
  }

  function knowledgeNodeRevisionById(nodeId, revisionId) {
    const row = db
      .prepare(
        `SELECT id, node_id AS nodeId, snapshot_json AS snapshotJson
         FROM knowledge_node_revisions
         WHERE node_id = ? AND id = ?`
      )
      .get(nodeId, Number(revisionId));
    return row ? { ...row, snapshot: JSON.parse(row.snapshotJson) } : null;
  }

  function upsertKnowledgeNodeSnapshot(snapshot) {
    const node = snapshot.node || snapshot;
    db.prepare(
      `INSERT INTO knowledge_nodes
        (id, slug, node_type, symbol, title, summary, markdown, cover, accent_color, tags,
         publish_status, visibility_status, deleted_at, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         node_type = excluded.node_type,
         symbol = excluded.symbol,
         title = excluded.title,
         summary = excluded.summary,
         markdown = excluded.markdown,
         cover = excluded.cover,
         accent_color = excluded.accent_color,
         tags = excluded.tags,
         publish_status = excluded.publish_status,
         visibility_status = excluded.visibility_status,
         deleted_at = excluded.deleted_at,
         created_at = excluded.created_at,
         published_at = excluded.published_at,
         updated_at = CURRENT_TIMESTAMP`
    ).run(
      node.id,
      node.slug || node.id,
      node.nodeType || "derivation",
      node.symbol || "",
      node.title || "",
      node.summary || "",
      node.markdown || "",
      node.cover || "",
      node.accentColor || "purple",
      node.tags || "",
      node.publishStatus || "draft",
      node.visibilityStatus || "public",
      node.deletedAt || null,
      node.createdAt || null,
      node.publishedAt || null
    );
    const restored = knowledgeNodeById(node.id);
    const linkSummary = syncKnowledgeLinksFromMarkdown({
      sourceType: "knowledge_node",
      sourceId: restored.id,
      sourceSlug: restored.slug,
      markdown: restored.markdown
    });
    return {
      node: decorateKnowledgeNode(restored, { admin: true }),
      warnings: linkSummary.warnings,
      linkSummary
    };
  }

  function restoreKnowledgeNodeRevision(id, revisionId, options = {}) {
    return withTransaction(() => {
      const node = knowledgeNodeById(id);
      if (!node) throw notFound("knowledge node not found");
      const revision = knowledgeNodeRevisionById(node.id, revisionId);
      if (!revision) throw notFound("revision not found");
      createKnowledgeNodeRevision(node.id, "before_revision_restore", options.actor);
      return upsertKnowledgeNodeSnapshot(revision.snapshot);
    });
  }

  function formulaCardColumns(options = {}) {
    const revisionPointer = options.publicRevision ? "c.published_revision_id" : "c.current_revision_id";
    const displayName = options.publicRevision
      ? "COALESCE(NULLIF(r.display_name, ''), c.display_name)"
      : "c.display_name";
    const moduleKey = options.publicRevision
      ? "COALESCE(NULLIF(r.module_key, ''), c.module_key)"
      : "c.module_key";
    const categoryPath = options.publicRevision
      ? "COALESCE(NULLIF(r.category_path, ''), c.category_path)"
      : "c.category_path";
    const purpose = options.publicRevision ? "COALESCE(r.purpose, c.purpose)" : "c.purpose";
    const revisionTagsJson = "r.tags_json";
    return `c.formula_id AS formulaId, c.slug, ${displayName} AS displayName,
            ${moduleKey} AS moduleKey, ${categoryPath} AS categoryPath, ${purpose} AS purpose,
            ${revisionPointer} AS currentRevisionId,
            c.published_revision_id AS publishedRevisionId,
            c.publish_status AS publishStatus, c.published_at AS publishedAt,
            c.archived_at AS archivedAt, c.created_at AS createdAt, c.updated_at AS updatedAt,
            (
              SELECT published.latex FROM formula_revisions published
              WHERE published.revision_id = c.published_revision_id
            ) AS publishedLatex,
            r.sequence_no AS currentRevisionSequence, r.latex,
            r.markdown_derivation AS markdownDerivation,
            r.display_name AS revisionDisplayName,
            r.module_key AS revisionModuleKey,
            r.category_path AS revisionCategoryPath,
            r.purpose AS revisionPurpose,
            ${revisionTagsJson} AS revisionTagsJson,
            r.revision_reason AS currentRevisionReason,
            r.source_book_id AS sourceBookId,
            r.source_book_revision AS sourceBookRevision,
            r.source_formula_id AS sourceFormulaId`;
  }

  function formulaTags(formulaId) {
    return db
      .prepare(
        `SELECT tag_key AS tagKey
         FROM formula_card_tags
         WHERE formula_id = ?
         ORDER BY tag_key ASC`
      )
      .all(formulaId)
      .map((row) => row.tagKey);
  }

  function parseFormulaTagsJson(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function decorateFormulaCard(row) {
    if (!row) return null;
    const revisionTags =
      row.revisionTagsJson === null || row.revisionTagsJson === undefined
        ? null
        : parseFormulaTagsJson(row.revisionTagsJson);
    return {
      ...row,
      tags: revisionTags === null ? formulaTags(row.formulaId) : revisionTags,
      archiveState: row.publishStatus === "archived" || row.archivedAt ? "archived" : "active",
      pendingPublication:
        row.publishStatus === "published" &&
        Boolean(row.currentRevisionId) &&
        row.currentRevisionId !== row.publishedRevisionId,
      insertRevisionId: row.publishStatus === "draft" ? row.currentRevisionId : row.publishedRevisionId,
      insertLatex: row.publishStatus === "draft" ? row.latex : row.publishedLatex
    };
  }

  function formulaCardByIdAny(id) {
    const key = String(id || "");
    if (!key) return null;
    const row = db
      .prepare(
        `SELECT ${formulaCardColumns()}
         FROM formula_cards c
         LEFT JOIN formula_revisions r ON r.revision_id = c.current_revision_id
         WHERE c.formula_id = ? OR c.slug = ?
         ORDER BY c.formula_id = ? DESC
         LIMIT 1`
      )
      .get(key, key, key);
    return decorateFormulaCard(row || null);
  }

  function formulaCardBySlugAny(slug) {
    const key = String(slug || "");
    if (!key) return null;
    const row = db
      .prepare(
        `SELECT ${formulaCardColumns()}
         FROM formula_cards c
         LEFT JOIN formula_revisions r ON r.revision_id = c.current_revision_id
         WHERE c.slug = ?`
      )
      .get(key);
    return decorateFormulaCard(row || null);
  }

  function publicFormulaCardBySlug(slug) {
    const key = String(slug || "");
    if (!key) return null;
    const row = db
      .prepare(
        `SELECT ${formulaCardColumns({ publicRevision: true })}
         FROM formula_cards c
         JOIN formula_revisions r ON r.revision_id = c.published_revision_id
         WHERE c.slug = ?
           AND c.publish_status = 'published'
           AND c.archived_at IS NULL
           AND EXISTS (
             SELECT 1 FROM formula_revision_publications publication
             WHERE publication.revision_id = c.published_revision_id
               AND publication.formula_id = c.formula_id
           )`
      )
      .get(key);
    const card = decorateFormulaCard(row || null);
    if (!card) return null;
    const derivation = formulaDerivationForCard(card.formulaId, {
      admin: false,
      revisionId: card.publishedRevisionId
    });
    const availableDependencyIds = new Set(
      derivation.dependencies.map((dependency) => dependency.formulaId)
    );
    const markdownDerivation = String(card.markdownDerivation || "").replace(
      /\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g,
      (shortcode, targetFormulaId) =>
        availableDependencyIds.has(targetFormulaId)
          ? shortcode
          : "{{formula-ref-unavailable}}"
    );
    return {
      ...card,
      markdownDerivation,
      pendingPublication: false,
      derivation,
      graph: formulaGraphForCard(card.formulaId, {
        admin: false,
        revisionId: card.publishedRevisionId
      })
    };
  }

  function resolveLegacyFormulaRedirect(slug) {
    const legacySlug = String(slug || "").trim().toLowerCase();
    if (!KNOWLEDGE_SLUG_PATTERN.test(legacySlug)) return null;
    const row = db
      .prepare(
        `SELECT redirect.legacy_slug AS legacySlug,
                redirect.source_node_id AS sourceNodeId,
                redirect.formula_id AS formulaId,
                redirect.target_slug AS targetSlug,
                mapping.target_ids_json AS targetIdsJson,
                card.publish_status AS publishStatus,
                card.published_revision_id AS publishedRevisionId
         FROM legacy_formula_redirects redirect
         JOIN legacy_formula_mappings mapping
           ON mapping.source_table = 'knowledge_nodes'
          AND mapping.source_key = redirect.source_node_id
          AND mapping.report_digest = redirect.report_digest
          AND mapping.disposition IN ('mapped', 'merged')
         JOIN formula_cards card
           ON card.formula_id = redirect.formula_id
          AND card.slug = redirect.target_slug
         JOIN formula_revisions revision
           ON revision.revision_id = card.published_revision_id
          AND revision.formula_id = card.formula_id
         WHERE redirect.legacy_slug = ?
           AND redirect.verification_status = 'verified'
           AND redirect.source_publish_status = 'published'
           AND redirect.source_visibility_status IN ('public', 'unlisted')
           AND redirect.source_deleted_at IS NULL
           AND card.publish_status = 'published'
           AND card.archived_at IS NULL
           AND EXISTS (
             SELECT 1
             FROM legacy_formula_migration_reports report
             WHERE report.plan_digest = redirect.report_digest
               AND report.mode = 'apply_verified'
               AND report.cleanup_eligible = 1
           )`
      )
      .get(legacySlug);
    if (!row) return null;
    let targetIds;
    try {
      targetIds = JSON.parse(row.targetIdsJson);
    } catch {
      return null;
    }
    const mappedTarget = Array.isArray(targetIds)
      ? targetIds.find(
          (target) =>
            target &&
            target.formulaId === row.formulaId &&
            target.slug === row.targetSlug &&
            target.publishedRevisionId === row.publishedRevisionId
        )
      : null;
    if (!mappedTarget || row.targetSlug === legacySlug) return null;
    const chained = db
      .prepare(
        `SELECT 1 AS found
         FROM legacy_formula_redirects redirect
         WHERE redirect.legacy_slug = ?
           AND redirect.verification_status = 'verified'
         LIMIT 1`
      )
      .get(row.targetSlug);
    if (chained) return null;
    return {
      legacySlug,
      formulaId: row.formulaId,
      targetSlug: row.targetSlug,
      statusCode: 308,
      location: `/derive.html?formula=${encodeURIComponent(row.targetSlug)}`
    };
  }

  function listFormulaRevisions(id, limit = 200) {
    const card = formulaCardByIdAny(id);
    if (!card) return [];
    return db
      .prepare(
        `SELECT r.revision_id AS revisionId, r.formula_id AS formulaId, r.sequence_no AS sequence,
                r.latex, r.markdown_derivation AS markdownDerivation,
                r.display_name AS displayName, r.module_key AS moduleKey,
                r.category_path AS categoryPath, r.purpose, r.tags_json AS tagsJson,
                r.revision_reason AS revisionReason,
                source_book_id AS sourceBookId,
                source_book_revision AS sourceBookRevision,
                source_formula_id AS sourceFormulaId,
                actor_user_id AS actorUserId, actor_username AS actorUsername,
                r.created_at AS createdAt,
                EXISTS (
                  SELECT 1 FROM formula_revision_publications publication
                  WHERE publication.revision_id = r.revision_id
                ) AS wasPublished
         FROM formula_revisions r
         WHERE r.formula_id = ?
         ORDER BY r.sequence_no DESC
         LIMIT ?`
      )
      .all(card.formulaId, Math.max(1, Math.min(Number(limit || 200), 500)))
      .map((revision) => ({
        ...revision,
        tags: parseFormulaTagsJson(revision.tagsJson),
        dependencies: formulaDependencyRows(revision.revisionId)
      }));
  }

  function formulaDependencyRows(revisionId) {
    if (!revisionId) return [];
    return db
      .prepare(
        `SELECT revision_id AS revisionId, source_formula_id AS sourceFormulaId,
                target_formula_id AS targetFormulaId, ordinal, provenance, created_at AS createdAt
         FROM formula_revision_dependencies
         WHERE revision_id = ?
         ORDER BY ordinal ASC, target_formula_id ASC`
      )
      .all(revisionId);
  }

  function formulaDerivationNode(row, options = {}) {
    if (!row) return null;
    const archived = row.publishStatus === "archived" || Boolean(row.archivedAt);
    if (!options.admin) {
      return {
        formulaId: row.formulaId,
        slug: row.slug,
        displayName: row.displayName,
        available: row.publishStatus === "published" && !archived,
        latex: row.latex || "",
        ordinal: Number(row.ordinal || 0)
      };
    }
    return {
      formulaId: row.formulaId,
      slug: row.slug,
      displayName: row.displayName,
      moduleKey: row.moduleKey,
      categoryPath: row.categoryPath,
      publishStatus: row.publishStatus,
      archiveState: archived ? "archived" : "active",
      available: options.admin ? !archived : row.publishStatus === "published",
      revisionId: row.revisionId || null,
      latex: row.latex || "",
      provenance: row.provenance || "markdown",
      ordinal: Number(row.ordinal || 0)
    };
  }

  function formulaDerivationForCard(id, options = {}) {
    const formulaId = String(id || "");
    const root = formulaCardByIdAny(formulaId);
    if (!root) return { incoming: [], dependencies: [], next: null, brokenCount: 0 };
    const admin = options.admin === true;
    const revisionId =
      options.revisionId || (admin ? root.currentRevisionId : root.publishedRevisionId);
    const targetPointer = admin ? "target.current_revision_id" : "target.published_revision_id";
    const sourcePointer = admin ? "source.current_revision_id" : "source.published_revision_id";
    const targetDisplayName = admin
      ? "target.display_name"
      : "COALESCE(NULLIF(revision.display_name, ''), target.display_name)";
    const sourceDisplayName = admin
      ? "source.display_name"
      : "COALESCE(NULLIF(revision.display_name, ''), source.display_name)";
    const publicTargetFilter = admin
      ? ""
      : `AND target.publish_status = 'published'
         AND target.archived_at IS NULL
         AND target.published_revision_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM formula_revision_publications publication
           WHERE publication.revision_id = target.published_revision_id
             AND publication.formula_id = target.formula_id
         )`;
    const publicSourceFilter = admin
      ? ""
      : `AND source.publish_status = 'published'
         AND source.archived_at IS NULL
         AND source.published_revision_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM formula_revision_publications publication
           WHERE publication.revision_id = source.published_revision_id
             AND publication.formula_id = source.formula_id
         )`;

    const dependencies = db
      .prepare(
        `SELECT target.formula_id AS formulaId, target.slug,
                ${targetDisplayName} AS displayName, target.module_key AS moduleKey,
                target.category_path AS categoryPath, target.publish_status AS publishStatus,
                target.archived_at AS archivedAt, revision.revision_id AS revisionId,
                revision.latex, dependency.provenance, dependency.ordinal
         FROM formula_revision_dependencies dependency
         JOIN formula_cards target ON target.formula_id = dependency.target_formula_id
         LEFT JOIN formula_revisions revision ON revision.revision_id = ${targetPointer}
         WHERE dependency.revision_id = ?
           ${publicTargetFilter}
         ORDER BY dependency.ordinal ASC, target.formula_id ASC`
      )
      .all(revisionId)
      .map((row) => formulaDerivationNode(row, { admin }));
    const totalDependencyCount = Number(
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM formula_revision_dependencies
           WHERE revision_id = ?`
        )
        .get(revisionId)?.count || 0
    );
    const incoming = db
      .prepare(
        `SELECT source.formula_id AS formulaId, source.slug,
                ${sourceDisplayName} AS displayName, source.module_key AS moduleKey,
                source.category_path AS categoryPath, source.publish_status AS publishStatus,
                source.archived_at AS archivedAt, revision.revision_id AS revisionId,
                revision.latex, dependency.provenance, dependency.ordinal
         FROM formula_revision_dependencies dependency
         JOIN formula_cards source ON source.formula_id = dependency.source_formula_id
         LEFT JOIN formula_revisions revision ON revision.revision_id = ${sourcePointer}
         WHERE dependency.target_formula_id = ?
           AND dependency.revision_id = ${sourcePointer}
           ${publicSourceFilter}
         ORDER BY source.display_name ASC, source.formula_id ASC`
      )
      .all(formulaId)
      .map((row) => formulaDerivationNode(row, { admin }));
    const result = {
      revisionId,
      incoming,
      dependencies,
      next: dependencies[0] || null,
      dependencyCount: totalDependencyCount,
      unavailableDependencyCount: totalDependencyCount - dependencies.length,
      brokenCount:
        incoming.filter((node) => !node.available).length +
        dependencies.filter((node) => !node.available).length
    };
    if (admin) {
      result.affectedSources = db
        .prepare(
          `WITH RECURSIVE affected(formula_id) AS (
             SELECT ?
             UNION
             SELECT dependency.source_formula_id
             FROM formula_revision_dependencies dependency
             JOIN formula_cards source ON source.formula_id = dependency.source_formula_id
             JOIN affected ON dependency.target_formula_id = affected.formula_id
             WHERE dependency.revision_id = source.current_revision_id
           )
           SELECT card.formula_id AS formulaId, card.slug,
                  card.display_name AS displayName, card.module_key AS moduleKey,
                  card.category_path AS categoryPath, card.publish_status AS publishStatus,
                  card.archived_at AS archivedAt
           FROM affected
           JOIN formula_cards card ON card.formula_id = affected.formula_id
           ORDER BY card.display_name ASC, card.formula_id ASC`
        )
        .all(formulaId)
        .map((row) => formulaDerivationNode(row, { admin: true }));
      result.publicationBlockers = db
        .prepare(
          `SELECT target.formula_id AS formulaId, target.display_name AS displayName,
                  target.publish_status AS publishStatus
           FROM formula_revision_dependencies dependency
           JOIN formula_cards target ON target.formula_id = dependency.target_formula_id
           WHERE dependency.revision_id = ?
             AND (
               target.publish_status <> 'published'
               OR target.archived_at IS NOT NULL
               OR target.published_revision_id IS NULL
               OR NOT EXISTS (
                 SELECT 1 FROM formula_revision_publications publication
                 WHERE publication.revision_id = target.published_revision_id
                   AND publication.formula_id = target.formula_id
               )
             )
           ORDER BY dependency.ordinal ASC`
        )
        .all(revisionId);
    }
    return result;
  }

  function formulaGraphForCard(id, options = {}) {
    const formulaId = String(id || "");
    const admin = options.admin === true;
    const pointer = admin ? "card.current_revision_id" : "card.published_revision_id";
    const sourcePointer = admin ? "source.current_revision_id" : "source.published_revision_id";
    const visibility = admin
      ? "card.current_revision_id IS NOT NULL"
      : `card.publish_status = 'published'
         AND card.archived_at IS NULL
         AND card.published_revision_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM formula_revision_publications publication
           WHERE publication.revision_id = card.published_revision_id
             AND publication.formula_id = card.formula_id
         )`;
    const graphDisplayName = admin
      ? "card.display_name"
      : "COALESCE(NULLIF(revision.display_name, ''), card.display_name)";
    const edgeVisibility = admin
      ? ""
      : `AND source.publish_status = 'published'
         AND target.publish_status = 'published'
         AND source.archived_at IS NULL
         AND target.archived_at IS NULL
         AND source.published_revision_id IS NOT NULL
         AND target.published_revision_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM formula_revision_publications source_publication
           WHERE source_publication.revision_id = source.published_revision_id
             AND source_publication.formula_id = source.formula_id
         )
         AND EXISTS (
           SELECT 1 FROM formula_revision_publications target_publication
           WHERE target_publication.revision_id = target.published_revision_id
             AND target_publication.formula_id = target.formula_id
         )`;
    const rows = db
      .prepare(
        `SELECT card.formula_id AS formulaId, card.slug,
                ${graphDisplayName} AS displayName, card.publish_status AS publishStatus,
                card.archived_at AS archivedAt, card.current_revision_id AS currentRevisionId,
                card.published_revision_id AS publishedRevisionId,
                revision.revision_id AS revisionId, revision.latex
         FROM formula_cards card
         JOIN formula_revisions revision ON revision.revision_id = ${pointer}
         WHERE ${visibility}
         ORDER BY card.formula_id ASC`
      )
      .all();
    const rowById = new Map(rows.map((row) => [row.formulaId, row]));
    if (!rowById.has(formulaId)) {
      return {
        mode: admin ? "current" : "published",
        currentNodeId: "",
        nodes: [],
        edges: [],
        initialNodeIds: [],
        expandableNodeIds: [],
        hiddenNodeCount: 0,
        truncated: false,
        limits: {
          initialNodes: FORMULA_GRAPH_INITIAL_NODE_LIMIT,
          payloadNodes: FORMULA_GRAPH_PAYLOAD_NODE_LIMIT
        }
      };
    }
    const allEdges = db
      .prepare(
        `SELECT dependency.source_formula_id AS sourceFormulaId,
                dependency.target_formula_id AS targetFormulaId,
                dependency.ordinal, dependency.provenance
         FROM formula_revision_dependencies dependency
         JOIN formula_cards source ON source.formula_id = dependency.source_formula_id
         JOIN formula_cards target ON target.formula_id = dependency.target_formula_id
         WHERE dependency.revision_id = ${sourcePointer}
           ${edgeVisibility}
         ORDER BY dependency.source_formula_id ASC,
                  dependency.ordinal ASC,
                  dependency.target_formula_id ASC`
      )
      .all()
      .filter(
        (edge) => rowById.has(edge.sourceFormulaId) && rowById.has(edge.targetFormulaId)
      );
    const neighbors = new Map(rows.map((row) => [row.formulaId, new Set()]));
    for (const edge of allEdges) {
      neighbors.get(edge.sourceFormulaId)?.add(edge.targetFormulaId);
      neighbors.get(edge.targetFormulaId)?.add(edge.sourceFormulaId);
    }

    const componentIds = [];
    const componentSet = new Set();
    const queue = [formulaId];
    while (queue.length && componentIds.length < FORMULA_GRAPH_PAYLOAD_NODE_LIMIT) {
      const current = queue.shift();
      if (componentSet.has(current)) continue;
      componentSet.add(current);
      componentIds.push(current);
      const adjacent = [...(neighbors.get(current) || [])].sort((left, right) =>
        left.localeCompare(right)
      );
      adjacent.forEach((neighbor) => {
        if (!componentSet.has(neighbor)) queue.push(neighbor);
      });
    }
    const reachableCount = (() => {
      const seen = new Set();
      const pending = [formulaId];
      while (pending.length) {
        const current = pending.shift();
        if (seen.has(current)) continue;
        seen.add(current);
        for (const neighbor of neighbors.get(current) || []) {
          if (!seen.has(neighbor)) pending.push(neighbor);
        }
      }
      return seen.size;
    })();
    const componentEdges = allEdges.filter(
      (edge) =>
        componentSet.has(edge.sourceFormulaId) &&
        componentSet.has(edge.targetFormulaId)
    );

    const incomingCount = new Map(componentIds.map((nodeId) => [nodeId, 0]));
    const outgoing = new Map(componentIds.map((nodeId) => [nodeId, []]));
    for (const edge of componentEdges) {
      incomingCount.set(
        edge.targetFormulaId,
        Number(incomingCount.get(edge.targetFormulaId) || 0) + 1
      );
      outgoing.get(edge.sourceFormulaId)?.push(edge.targetFormulaId);
    }
    for (const targets of outgoing.values()) targets.sort((left, right) => left.localeCompare(right));
    const layers = new Map(componentIds.map((nodeId) => [nodeId, 0]));
    const topologyQueue = componentIds
      .filter((nodeId) => Number(incomingCount.get(nodeId) || 0) === 0)
      .sort((left, right) => left.localeCompare(right));
    while (topologyQueue.length) {
      const sourceId = topologyQueue.shift();
      for (const targetId of outgoing.get(sourceId) || []) {
        layers.set(
          targetId,
          Math.max(Number(layers.get(targetId) || 0), Number(layers.get(sourceId) || 0) + 1)
        );
        incomingCount.set(targetId, Number(incomingCount.get(targetId) || 0) - 1);
        if (incomingCount.get(targetId) === 0) {
          topologyQueue.push(targetId);
          topologyQueue.sort((left, right) => left.localeCompare(right));
        }
      }
    }
    const rootLayer = Number(layers.get(formulaId) || 0);

    const initialFormulaIds = [];
    const initialSet = new Set();
    const initialQueue = [formulaId];
    while (
      initialQueue.length &&
      initialFormulaIds.length < FORMULA_GRAPH_INITIAL_NODE_LIMIT
    ) {
      const current = initialQueue.shift();
      if (initialSet.has(current) || !componentSet.has(current)) continue;
      initialSet.add(current);
      initialFormulaIds.push(current);
      const adjacent = [...(neighbors.get(current) || [])]
        .filter((neighbor) => componentSet.has(neighbor))
        .sort((left, right) => {
          const leftDistance = Math.abs(Number(layers.get(left) || 0) - rootLayer);
          const rightDistance = Math.abs(Number(layers.get(right) || 0) - rootLayer);
          return leftDistance - rightDistance || left.localeCompare(right);
        });
      adjacent.forEach((neighbor) => {
        if (!initialSet.has(neighbor)) initialQueue.push(neighbor);
      });
    }
    const keyFor = (nodeId) => (admin ? nodeId : rowById.get(nodeId)?.slug || "");
    const initialNodeIds = initialFormulaIds.map(keyFor).filter(Boolean);
    const expandableNodeIds = initialFormulaIds
      .filter((nodeId) =>
        [...(neighbors.get(nodeId) || [])].some(
          (neighbor) => componentSet.has(neighbor) && !initialSet.has(neighbor)
        )
      )
      .map(keyFor)
      .filter(Boolean);
    const nodes = componentIds.map((nodeId) => {
      const row = rowById.get(nodeId);
      const rank = Number(layers.get(nodeId) || 0) - rootLayer;
      const base = {
        id: keyFor(nodeId),
        slug: row.slug,
        displayName: row.displayName,
        latex: row.latex || "",
        rank,
        direction: rank < 0 ? "ancestor" : rank > 0 ? "dependency" : "current",
        current: nodeId === formulaId,
        initiallyVisible: initialSet.has(nodeId)
      };
      if (!admin) return base;
      return {
        ...base,
        formulaId: row.formulaId,
        revisionId: row.revisionId,
        publishStatus: row.publishStatus,
        pendingPublication:
          row.publishStatus === "published" &&
          row.currentRevisionId !== row.publishedRevisionId,
        archiveState:
          row.publishStatus === "archived" || row.archivedAt ? "archived" : "active"
      };
    });
    const edges = componentEdges.map((edge, index) => {
      const base = {
        id: `edge-${index + 1}`,
        source: keyFor(edge.sourceFormulaId),
        target: keyFor(edge.targetFormulaId),
        initiallyVisible:
          initialSet.has(edge.sourceFormulaId) && initialSet.has(edge.targetFormulaId)
      };
      return admin
        ? {
            ...base,
            provenance: edge.provenance,
            ordinal: Number(edge.ordinal || 0)
          }
        : base;
    });
    return {
      mode: admin ? "current" : "published",
      currentNodeId: keyFor(formulaId),
      nodes,
      edges,
      initialNodeIds,
      expandableNodeIds,
      hiddenNodeCount: Math.max(0, componentIds.length - initialNodeIds.length),
      truncated: reachableCount > componentIds.length,
      limits: {
        initialNodes: FORMULA_GRAPH_INITIAL_NODE_LIMIT,
        payloadNodes: FORMULA_GRAPH_PAYLOAD_NODE_LIMIT
      }
    };
  }

  function adminFormulaCard(id) {
    const card = formulaCardByIdAny(id);
    if (!card) return null;
    const derivation = formulaDerivationForCard(card.formulaId, {
      admin: true,
      revisionId: card.currentRevisionId
    });
    if (card.archivedAt) {
      derivation.currentArchived = true;
      derivation.brokenCount += 1;
    }
    return {
      ...card,
      revisions: listFormulaRevisions(card.formulaId),
      derivation,
      graph: formulaGraphForCard(card.formulaId, {
        admin: true,
        revisionId: card.currentRevisionId
      }),
      publishedDerivation: card.publishedRevisionId
        ? formulaDerivationForCard(card.formulaId, {
            admin: false,
            revisionId: card.publishedRevisionId
          })
        : null
    };
  }

  function parseFormulaRelationJson(value, fallback) {
    try {
      const parsed = JSON.parse(value || "");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function listFormulaRelationRepairs(options = {}) {
    const status = ["pending", "resolved", "all"].includes(options.status)
      ? options.status
      : "pending";
    const issueCode = String(options.issueCode || "").trim();
    const repairId = String(options.repairId || "").trim();
    const limit = Math.max(1, Math.min(Number(options.limit || 200), 500));
    const rows = db
      .prepare(
        `SELECT queue.repair_id AS repairId,
                queue.source_table AS sourceTable, queue.source_key AS sourceKey,
                queue.source_digest AS sourceDigest,
                queue.source_formula_id AS sourceFormulaId,
                queue.source_revision_id AS sourceRevisionId,
                queue.target_reference AS targetReference,
                queue.issue_code AS issueCode, queue.reason,
                queue.candidate_target_ids_json AS candidateTargetIdsJson,
                queue.evidence_json AS evidenceJson, queue.plan_digest AS planDigest,
                queue.created_at AS createdAt,
                source.display_name AS sourceDisplayName,
                source.current_revision_id AS sourceCurrentRevisionId,
                event.event_id AS latestEventId, event.event_type AS latestEventType,
                event.target_formula_id AS resolvedTargetFormulaId,
                event.evidence_json AS latestEventEvidenceJson,
                event.actor_username AS latestEventActor,
                event.created_at AS latestEventAt,
                target.display_name AS resolvedTargetDisplayName
         FROM formula_relation_repair_queue queue
         LEFT JOIN formula_cards source ON source.formula_id = queue.source_formula_id
         LEFT JOIN formula_relation_repair_events event
           ON event.event_id = (
             SELECT latest.event_id
             FROM formula_relation_repair_events latest
             WHERE latest.repair_id = queue.repair_id
             ORDER BY latest.created_at DESC, latest.rowid DESC
             LIMIT 1
           )
         LEFT JOIN formula_cards target ON target.formula_id = event.target_formula_id
         WHERE (? = '' OR queue.issue_code = ?)
           AND (? = '' OR queue.repair_id = ?)
           AND (
             ? = 'all'
             OR (? = 'resolved' AND event.event_type = 'resolved')
             OR (? = 'pending' AND COALESCE(event.event_type, '') <> 'resolved')
           )
         ORDER BY queue.created_at ASC, queue.repair_id ASC
         LIMIT ?`
      )
      .all(issueCode, issueCode, repairId, repairId, status, status, status, limit)
      .map((row) => ({
        repairId: row.repairId,
        sourceTable: row.sourceTable,
        sourceKey: row.sourceKey,
        sourceDigest: row.sourceDigest,
        sourceFormulaId: row.sourceFormulaId,
        sourceRevisionId: row.sourceRevisionId || row.sourceCurrentRevisionId || "",
        targetReference: row.targetReference,
        issueCode: row.issueCode,
        reason: row.reason,
        candidateTargetIds: parseFormulaRelationJson(row.candidateTargetIdsJson, []),
        evidence: parseFormulaRelationJson(row.evidenceJson, {}),
        planDigest: row.planDigest,
        createdAt: row.createdAt,
        sourceDisplayName: row.sourceDisplayName || row.sourceFormulaId || row.sourceKey,
        status: row.latestEventType === "resolved" ? "resolved" : "pending",
        latestEvent: row.latestEventId
          ? {
              eventId: row.latestEventId,
              eventType: row.latestEventType,
              targetFormulaId: row.resolvedTargetFormulaId || "",
              targetDisplayName: row.resolvedTargetDisplayName || row.resolvedTargetFormulaId || "",
              evidence: parseFormulaRelationJson(row.latestEventEvidenceJson, {}),
              actorUsername: row.latestEventActor || "",
              createdAt: row.latestEventAt
            }
          : null
      }));
    return rows;
  }

  function appendFormulaRelationRepairEvent(repairId, payload, actor = {}) {
    return withTransaction(() => {
      const repair = db
        .prepare(
          `SELECT queue.repair_id AS repairId,
                  queue.source_formula_id AS sourceFormulaId,
                  queue.source_revision_id AS sourceRevisionId,
                  source.current_revision_id AS sourceCurrentRevisionId
           FROM formula_relation_repair_queue queue
           LEFT JOIN formula_cards source ON source.formula_id = queue.source_formula_id
           WHERE queue.repair_id = ?`
        )
        .get(String(repairId || ""));
      if (!repair) throw notFound("公式关系待修复事项不存在");
      const latest = listFormulaRelationRepairs({
        status: "all",
        repairId: repair.repairId,
        limit: 1
      })[0];
      const eventType = payload.eventType;
      if (eventType === "resolved" && latest?.status === "resolved") {
        throw contentError(409, "此待修复事项已经结案；如需更改请先重新打开");
      }
      if (eventType === "reopened" && latest?.status !== "resolved") {
        throw contentError(409, "只有已结案事项可以重新打开");
      }

      let targetFormulaId = null;
      let verifiedRevisionId = repair.sourceRevisionId || repair.sourceCurrentRevisionId || "";
      if (eventType === "resolved") {
        targetFormulaId = payload.targetFormulaId;
        const target = formulaCardByIdAny(targetFormulaId);
        if (!target) throw contentError(400, "结案目标公式不存在");
        if (target.archiveState === "archived") throw contentError(409, "已归档公式不能作为结案目标");
        if (!repair.sourceFormulaId || repair.sourceFormulaId === targetFormulaId) {
          throw contentError(400, "结案关系缺少有效来源，或形成自环");
        }
        if (!verifiedRevisionId) throw contentError(409, "来源公式尚无可核验修订，不能结案");
        const relation = db
          .prepare(
            `SELECT 1 AS present
             FROM formula_revision_dependencies
             WHERE revision_id = ?
               AND source_formula_id = ?
               AND target_formula_id = ?`
          )
          .get(verifiedRevisionId, repair.sourceFormulaId, targetFormulaId);
        if (!relation) {
          throw contentError(409, "请先在来源公式修订中保存该依赖关系，再追加结案证据");
        }
      }

      const actorInfo = actorFields(actor);
      const eventId = `repair-event.${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO formula_relation_repair_events
          (event_id, repair_id, event_type, target_formula_id, evidence_json,
           actor_user_id, actor_username)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        eventId,
        repair.repairId,
        eventType,
        targetFormulaId,
        JSON.stringify({ note: payload.note, verifiedRevisionId }),
        actorInfo.id,
        actorInfo.username
      );
      return listFormulaRelationRepairs({
        status: "all",
        repairId: repair.repairId,
        limit: 1
      })[0];
    });
  }

  function dependencyError(error) {
    if (/self-reference|self-link/i.test(error.message)) {
      return contentError(400, "公式卡不能依赖自身");
    }
    if (/duplicate|unique constraint/i.test(error.message)) {
      return contentError(400, "同一修订不能重复引用同一依赖公式");
    }
    if (/target is missing|foreign key/i.test(error.message)) {
      return contentError(400, "公式依赖目标不存在");
    }
    if (/cycle/i.test(error.message)) {
      return contentError(409, "此依赖会形成循环推导，保存已阻止");
    }
    if (/not eligible for publication/i.test(error.message)) {
      return contentError(409, "依赖公式尚未发布或已归档，当前修订不能发布");
    }
    return error;
  }

  function currentFormulaDependencyEdges(excludedSourceIds = []) {
    const excluded = new Set(excludedSourceIds.map(String));
    return db
      .prepare(
        `SELECT dependency.revision_id AS revisionId,
                dependency.source_formula_id AS sourceFormulaId,
                dependency.target_formula_id AS targetFormulaId,
                dependency.ordinal
         FROM formula_revision_dependencies dependency
         JOIN formula_cards card
           ON card.current_revision_id = dependency.revision_id
          AND card.formula_id = dependency.source_formula_id
         ORDER BY dependency.source_formula_id ASC,
                  dependency.ordinal ASC,
                  dependency.target_formula_id ASC`
      )
      .all()
      .filter((edge) => !excluded.has(edge.sourceFormulaId));
  }

  function validateFormulaDependencyTargets(formulaId, targetFormulaIds, options = {}) {
    const formulaIds = new Set(
      db.prepare("SELECT formula_id AS formulaId FROM formula_cards").all().map((row) => row.formulaId)
    );
    formulaIds.add(String(formulaId));
    for (const extraFormulaId of options.formulaIds || []) formulaIds.add(String(extraFormulaId));
    return validateFormulaDependencyGraph({
      formulaIds,
      edges: [
        ...currentFormulaDependencyEdges([formulaId]),
        ...targetFormulaIds.map((targetFormulaId, ordinal) => ({
          sourceFormulaId: formulaId,
          targetFormulaId,
          ordinal
        }))
      ]
    });
  }

  function insertFormulaDependencies(revisionId, formulaId, targetFormulaIds, provenance = "markdown") {
    const insert = db.prepare(
      `INSERT INTO formula_revision_dependencies
        (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
       VALUES (?, ?, ?, ?, ?)`
    );
    try {
      targetFormulaIds.forEach((targetFormulaId, ordinal) => {
        insert.run(revisionId, formulaId, targetFormulaId, ordinal, provenance);
      });
    } catch (error) {
      throw dependencyError(error);
    }
  }

  function appendDependencyMarkers(markdown, targetFormulaIds) {
    if (!targetFormulaIds.length) return String(markdown || "");
    const source = String(markdown || "").trimEnd();
    const markers = targetFormulaIds.map((formulaId) => `{{formula-ref:${formulaId}}}`).join("\n");
    return `${source}${source ? "\n\n" : ""}${markers}`;
  }

  function replaceDependencyMarkers(markdown, targetFormulaIds) {
    const withoutMarkers = String(markdown || "")
      .replace(/\{\{formula-ref:[a-z0-9][a-z0-9._-]{1,127}\}\}/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd();
    return appendDependencyMarkers(withoutMarkers, targetFormulaIds);
  }

  function saveFormulaDerivation(sourceId, payload, actor = {}) {
    return withTransaction(() => {
      const source = formulaCardByIdAny(sourceId);
      if (!source) throw notFound("formula source card not found");
      const existingDependencies = formulaDependencyRows(source.currentRevisionId);
      const existing = existingDependencies[0] || null;
      const affectedSources = formulaDerivationForCard(source.formulaId, { admin: true }).affectedSources;

      if (existingDependencies.length > 1) {
        throw contentError(409, "此公式已有多个分支依赖；请在 Markdown 推导中逐项编辑公式依赖");
      }
      if (payload.action === "remove") {
        if (!existing) {
          return {
            changed: false,
            replaced: false,
            previousTargetId: null,
            source: adminFormulaCard(source.formulaId),
            target: null,
            affectedSources
          };
        }
        const markdownDerivation = replaceDependencyMarkers(source.markdownDerivation, []);
        const saved = saveFormulaCard({
          ...source,
          markdownDerivation,
          revisionReason: "legacy-derivation-remove",
          preserveLegacyDependencies: false,
          forceDependencyRevision: markdownDerivation === source.markdownDerivation,
          actor
        });
        return {
          changed: true,
          replaced: false,
          previousTargetId: existing?.targetFormulaId || null,
          source: saved.card,
          target: null,
          affectedSources
        };
      }

      const target = formulaCardByIdAny(payload.targetFormulaId);
      if (!target) throw contentError(400, `下一阶公式卡不存在：${payload.targetFormulaId}`);
      if (source.formulaId === target.formulaId) throw contentError(400, "公式卡不能把自身设为下一阶");
      if (source.archivedAt || target.archivedAt) {
        throw contentError(409, "不能为已归档公式卡新建或替换推导关系；可先恢复公式卡");
      }
      if (existing?.targetFormulaId === target.formulaId) {
        return {
          changed: false,
          replaced: false,
          previousTargetId: existing.targetFormulaId,
          source: adminFormulaCard(source.formulaId),
          target: adminFormulaCard(target.formulaId),
          affectedSources
        };
      }
      if (existing && !payload.replace) {
        throw contentError(
          409,
          `此公式卡已有下一阶 ${existing.targetFormulaId}；必须明确确认替换，不能形成分叉`
        );
      }
      try {
        const saved = saveFormulaCard({
          ...source,
          markdownDerivation: replaceDependencyMarkers(source.markdownDerivation, [target.formulaId]),
          revisionReason: existing ? "legacy-derivation-replace" : "legacy-derivation-set",
          preserveLegacyDependencies: false,
          actor
        });
        return {
          changed: true,
          replaced: Boolean(existing),
          previousTargetId: existing?.targetFormulaId || null,
          source: saved.card,
          target: adminFormulaCard(target.formulaId),
          affectedSources
        };
      } catch (error) {
        throw dependencyError(error);
      }
    });
  }

  function formulaReferenceDecisionColumns() {
    return `d.decision_id AS decisionId, d.binding_id AS bindingId,
            d.post_id AS postId, p.slug AS postSlug, p.title AS postTitle,
            d.formula_id AS formulaId, c.slug AS formulaSlug,
            c.display_name AS formulaDisplayName, c.module_key AS moduleKey,
            c.category_path AS categoryPath, c.purpose,
            c.publish_status AS publishStatus, c.archived_at AS archivedAt,
            c.current_revision_id AS currentRevisionId,
            c.published_revision_id AS publishedRevisionId,
            d.bound_revision_id AS boundRevisionId,
            bound.sequence_no AS boundRevisionSequence, bound.latex AS boundLatex,
            bound.markdown_derivation AS boundMarkdownDerivation,
            d.target_revision_id AS targetRevisionId,
            target.sequence_no AS targetRevisionSequence, target.latex AS targetLatex,
            target.markdown_derivation AS targetMarkdownDerivation,
            current.sequence_no AS currentRevisionSequence, current.latex AS currentLatex,
            current.markdown_derivation AS currentMarkdownDerivation,
            d.event_type AS eventType, d.status,
            d.resolved_formula_id AS resolvedFormulaId,
            resolved_card.slug AS resolvedFormulaSlug,
            d.resolved_revision_id AS resolvedRevisionId,
            d.actor_user_id AS actorUserId, d.actor_username AS actorUsername,
            d.created_at AS createdAt, d.resolved_at AS resolvedAt`;
  }

  function listFormulaReferenceDecisions(filters = {}) {
    const status = ["pending", "kept", "adopted", "cloned", "superseded", "all"].includes(filters.status)
      ? filters.status
      : "pending";
    const where = [];
    const params = [];
    if (status !== "all") {
      where.push("d.status = ?");
      params.push(status);
    }
    if (filters.postId) {
      where.push("d.post_id = ?");
      params.push(String(filters.postId));
    }
    if (filters.formulaId) {
      where.push("d.formula_id = ?");
      params.push(String(filters.formulaId));
    }
    if (filters.decisionId) {
      where.push("d.decision_id = ?");
      params.push(String(filters.decisionId));
    }
    return db
      .prepare(
        `SELECT ${formulaReferenceDecisionColumns()}
         FROM formula_reference_decisions d
         JOIN posts p ON p.id = d.post_id
         JOIN formula_cards c ON c.formula_id = d.formula_id
         JOIN formula_revisions bound ON bound.revision_id = d.bound_revision_id
         JOIN formula_revisions target ON target.revision_id = d.target_revision_id
         LEFT JOIN formula_revisions current ON current.revision_id = c.current_revision_id
         LEFT JOIN formula_cards resolved_card ON resolved_card.formula_id = d.resolved_formula_id
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY d.status = 'pending' DESC, d.created_at DESC, d.decision_id DESC`
      )
      .all(...params)
      .map((decision) => ({
        ...decision,
        archiveState: decision.archivedAt ? "archived" : "active"
      }));
  }

  function formulaReferenceDecisionById(id) {
    return listFormulaReferenceDecisions({ status: "all", decisionId: id })[0] || null;
  }

  function createFormulaReferenceDecisions(formulaId, eventType, targetRevisionId, actor = {}) {
    const bindings = db
      .prepare(
        `SELECT binding_id AS bindingId, post_id AS postId, revision_id AS boundRevisionId
         FROM article_formula_bindings
         WHERE formula_id = ?
         ORDER BY post_id ASC, binding_id ASC`
      )
      .all(formulaId);
    const actorInfo = actorFields(actor);
    const supersede = db.prepare(
      `UPDATE formula_reference_decisions
       SET status = 'superseded', actor_user_id = ?, actor_username = ?
       WHERE binding_id = ? AND status = 'pending'`
    );
    const insert = db.prepare(
      `INSERT INTO formula_reference_decisions
        (decision_id, binding_id, post_id, formula_id, bound_revision_id,
         target_revision_id, event_type, status, actor_user_id, actor_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    );
    let created = 0;
    for (const binding of bindings) {
      if (eventType === "revision_update" && binding.boundRevisionId === targetRevisionId) continue;
      supersede.run(actorInfo.id, actorInfo.username, binding.bindingId);
      insert.run(
        `decision.${crypto.randomUUID()}`,
        binding.bindingId,
        binding.postId,
        formulaId,
        binding.boundRevisionId,
        targetRevisionId,
        eventType,
        actorInfo.id,
        actorInfo.username
      );
      created += 1;
    }
    return created;
  }

  function formulaClassificationUsage(classification) {
    if (classification.kind === "module") {
      return Number(
        db.prepare("SELECT COUNT(*) AS count FROM formula_cards WHERE module_key = ?").get(classification.slug).count || 0
      );
    }
    if (classification.kind === "category") {
      return Number(
        db
          .prepare("SELECT COUNT(*) AS count FROM formula_cards WHERE module_key = ? AND category_path = ?")
          .get(classification.parentSlug, classification.displayName).count || 0
      );
    }
    return Number(
      db.prepare("SELECT COUNT(*) AS count FROM formula_card_tags WHERE tag_key = ?").get(classification.displayName).count || 0
    );
  }

  function listFormulaClassifications(filters = {}) {
    const where = [];
    const params = [];
    if (filters.kind && ["module", "category", "tag"].includes(filters.kind)) {
      where.push("kind = ?");
      params.push(filters.kind);
    }
    if (filters.parentSlug) {
      where.push("parent_slug = ?");
      params.push(String(filters.parentSlug));
    }
    const query = normalizedClassificationName(filters.query);
    if (query) {
      where.push("(normalized_name LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')");
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(pattern, pattern);
    }
    return db
      .prepare(
        `SELECT classification_id AS classificationId, kind, slug,
                display_name AS displayName, parent_slug AS parentSlug,
                normalized_name AS normalizedName, created_at AS createdAt,
                updated_at AS updatedAt
         FROM formula_classifications
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY kind ASC, parent_slug ASC, display_name COLLATE NOCASE ASC, classification_id ASC`
      )
      .all(...params)
      .map((classification) => ({
        ...classification,
        usageCount: formulaClassificationUsage(classification)
      }));
  }

  function likelyFormulaClassificationDuplicates(payload) {
    const compact = normalizedClassificationName(payload.displayName).replace(/[^a-z0-9\u4e00-\u9fff]/gu, "");
    if (!compact) return [];
    return listFormulaClassifications({ kind: payload.kind, parentSlug: payload.parentSlug })
      .filter((candidate) => {
        const candidateCompact = candidate.normalizedName.replace(/[^a-z0-9\u4e00-\u9fff]/gu, "");
        return (
          candidate.slug === payload.slug ||
          candidateCompact === compact ||
          (Math.min(candidateCompact.length, compact.length) >= 4 &&
            (candidateCompact.includes(compact) || compact.includes(candidateCompact)))
        );
      })
      .slice(0, 5);
  }

  function saveFormulaClassification(payload, options = {}) {
    const parentSlug = payload.kind === "category" ? payload.parentSlug : "";
    const normalizedName = normalizedClassificationName(payload.displayName);
    const exact = db
      .prepare(
        `SELECT classification_id AS classificationId, kind, slug,
                display_name AS displayName, parent_slug AS parentSlug,
                normalized_name AS normalizedName, created_at AS createdAt,
                updated_at AS updatedAt
         FROM formula_classifications
         WHERE kind = ? AND parent_slug = ? AND normalized_name = ?`
      )
      .get(payload.kind, parentSlug, normalizedName);
    if (exact) return { classification: { ...exact, usageCount: formulaClassificationUsage(exact) }, reused: true };

    const candidates = likelyFormulaClassificationDuplicates({ ...payload, parentSlug });
    if (candidates.length && payload.confirmCreate !== true && options.allowLikelyDuplicate !== true) {
      const names = candidates.map((candidate) => candidate.displayName).join("、");
      throw contentError(409, `发现可能重复的公式分类：${names}。请选择已有项，或明确确认新建。`);
    }

    const slug = payload.slug || generatedClassificationSlug(payload.displayName);
    const classificationId = formulaClassificationId(payload.kind, parentSlug, normalizedName);
    try {
      db.prepare(
        `INSERT INTO formula_classifications
          (classification_id, kind, slug, display_name, parent_slug, normalized_name)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(classificationId, payload.kind, slug, payload.displayName, parentSlug, normalizedName);
    } catch (error) {
      if (/UNIQUE constraint failed/u.test(String(error?.message || ""))) {
        throw contentError(409, `公式分类 slug 已存在：${slug}。请选择已有项或更换名称。`);
      }
      throw error;
    }
    const classification = listFormulaClassifications({ kind: payload.kind, parentSlug }).find(
      (item) => item.classificationId === classificationId
    );
    return { classification, reused: false, duplicateCandidates: candidates };
  }

  function ensureFormulaClassifications(payload) {
    const moduleExists = db
      .prepare(
        `SELECT 1 AS present FROM formula_classifications
         WHERE kind = 'module' AND slug = ?`
      )
      .get(payload.moduleKey);
    if (!moduleExists) {
      saveFormulaClassification(
        {
          kind: "module",
          slug: payload.moduleKey,
          displayName: payload.moduleKey,
          parentSlug: "",
          confirmCreate: true
        },
        { allowLikelyDuplicate: true }
      );
    }
    const categoryExists = db
      .prepare(
        `SELECT 1 AS present FROM formula_classifications
         WHERE kind = 'category' AND parent_slug = ? AND normalized_name = ?`
      )
      .get(payload.moduleKey, normalizedClassificationName(payload.categoryPath));
    if (!categoryExists) {
      saveFormulaClassification(
        {
          kind: "category",
          slug: generatedClassificationSlug(payload.categoryPath),
          displayName: payload.categoryPath,
          parentSlug: payload.moduleKey,
          confirmCreate: true
        },
        { allowLikelyDuplicate: true }
      );
    }
    for (const tag of payload.tags || []) {
      const tagExists = db
        .prepare(
          `SELECT 1 AS present FROM formula_classifications
           WHERE kind = 'tag' AND normalized_name = ?`
        )
        .get(normalizedClassificationName(tag));
      if (!tagExists) {
        saveFormulaClassification(
          {
            kind: "tag",
            slug: generatedClassificationSlug(tag),
            displayName: tag,
            parentSlug: "",
            confirmCreate: true
          },
          { allowLikelyDuplicate: true }
        );
      }
    }
  }

  function assertFormulaClassificationsRegistered(payload) {
    const module = db
      .prepare(
        `SELECT classification_id AS classificationId
         FROM formula_classifications
         WHERE kind = 'module' AND slug = ?`
      )
      .get(payload.moduleKey);
    if (!module) {
      throw contentError(409, `所属模块尚未登记：${payload.moduleKey}。请先明确点击“新增模块”。`);
    }
    const category = db
      .prepare(
        `SELECT classification_id AS classificationId
         FROM formula_classifications
         WHERE kind = 'category' AND parent_slug = ? AND normalized_name = ?`
      )
      .get(payload.moduleKey, normalizedClassificationName(payload.categoryPath));
    if (!category) {
      throw contentError(409, `主分类尚未登记：${payload.categoryPath}。请先明确点击“新增主分类”。`);
    }
    const tagLookup = db.prepare(
      `SELECT classification_id AS classificationId
       FROM formula_classifications
       WHERE kind = 'tag' AND normalized_name = ?`
    );
    const missingTag = (payload.tags || []).find(
      (tag) => !tagLookup.get(normalizedClassificationName(tag))
    );
    if (missingTag) {
      throw contentError(409, `标签尚未登记：${missingTag}。请先明确点击“添加标签”。`);
    }
  }

  function syncFormulaTags(formulaId, tags) {
    db.prepare("DELETE FROM formula_card_tags WHERE formula_id = ?").run(formulaId);
    const insert = db.prepare(
      `INSERT INTO formula_card_tags (formula_id, tag_key, namespace, value)
       VALUES (?, ?, ?, ?)`
    );
    for (const tagKey of tags || []) {
      const separator = tagKey.indexOf(":");
      insert.run(formulaId, tagKey, tagKey.slice(0, separator), tagKey.slice(separator + 1));
    }
  }

  function formulaCatalogFacets() {
    const categoryRows = db
      .prepare(
        `SELECT module_key AS moduleKey, category_path AS categoryPath,
                SUM(CASE WHEN publish_status != 'archived' THEN 1 ELSE 0 END) AS activeCount,
                SUM(CASE WHEN publish_status = 'draft' THEN 1 ELSE 0 END) AS draftCount,
                SUM(CASE WHEN publish_status = 'published' THEN 1 ELSE 0 END) AS publishedCount,
                SUM(CASE WHEN publish_status = 'archived' THEN 1 ELSE 0 END) AS archivedCount
         FROM formula_cards
         GROUP BY module_key, category_path
         ORDER BY module_key ASC, category_path ASC`
      )
      .all();
    const modules = [];
    for (const row of categoryRows) {
      let module = modules.find((entry) => entry.moduleKey === row.moduleKey);
      if (!module) {
        module = {
          moduleKey: row.moduleKey,
          activeCount: 0,
          draftCount: 0,
          publishedCount: 0,
          archivedCount: 0,
          categories: []
        };
        modules.push(module);
      }
      const category = {
        categoryPath: row.categoryPath,
        activeCount: Number(row.activeCount || 0),
        draftCount: Number(row.draftCount || 0),
        publishedCount: Number(row.publishedCount || 0),
        archivedCount: Number(row.archivedCount || 0)
      };
      module.categories.push(category);
      module.activeCount += category.activeCount;
      module.draftCount += category.draftCount;
      module.publishedCount += category.publishedCount;
      module.archivedCount += category.archivedCount;
    }
    const tags = db
      .prepare(
        `SELECT t.tag_key AS tagKey,
                SUM(CASE WHEN c.publish_status != 'archived' THEN 1 ELSE 0 END) AS activeCount,
                SUM(CASE WHEN c.publish_status = 'draft' THEN 1 ELSE 0 END) AS draftCount,
                SUM(CASE WHEN c.publish_status = 'published' THEN 1 ELSE 0 END) AS publishedCount,
                SUM(CASE WHEN c.publish_status = 'archived' THEN 1 ELSE 0 END) AS archivedCount
         FROM formula_card_tags t
         JOIN formula_cards c ON c.formula_id = t.formula_id
         GROUP BY t.tag_key
         ORDER BY t.tag_key ASC`
      )
      .all()
      .map((row) => ({
        tagKey: row.tagKey,
        activeCount: Number(row.activeCount || 0),
        draftCount: Number(row.draftCount || 0),
        publishedCount: Number(row.publishedCount || 0),
        archivedCount: Number(row.archivedCount || 0)
      }));
    return { modules, tags, classifications: listFormulaClassifications() };
  }

  function listFormulaCards(filters = {}) {
    const facets = formulaCatalogFacets();
    const moduleKey = String(filters.moduleKey || "").trim();
    const categoryPath = String(filters.categoryPath || "").trim();
    const query = String(filters.query || "").trim();
    const tag = String(filters.tag || "").trim();
    const archiveState = ["active", "archived", "all"].includes(filters.archiveState) ? filters.archiveState : "active";
    const publishStatus = ["draft", "published", "archived", "all"].includes(filters.publishStatus)
      ? filters.publishStatus
      : "all";
    const requestedPageSize = Number(filters.pageSize || 12);
    const requestedPage = Number(filters.page || 1);
    const pageSize = Number.isFinite(requestedPageSize) ? Math.max(1, Math.min(Math.trunc(requestedPageSize), 50)) : 12;
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;
    const allowGlobalSearch = filters.allowGlobalSearch === true && Boolean(query || tag);
    if ((!moduleKey || !categoryPath) && !allowGlobalSearch) {
      return {
        items: [],
        facets,
        selection: { moduleKey, categoryPath, query, tag, archiveState, publishStatus },
        pagination: { page: 1, pageSize, total: 0, pageCount: 0 },
        requiresCategory: true
      };
    }

    const where = [];
    const params = [];
    if (moduleKey) {
      where.push("c.module_key = ?");
      params.push(moduleKey);
    }
    if (categoryPath) {
      where.push("c.category_path = ?");
      params.push(categoryPath);
    }
    if (archiveState === "active") where.push("c.publish_status != 'archived'");
    if (archiveState === "archived") where.push("c.publish_status = 'archived'");
    if (publishStatus !== "all") where.push("c.publish_status = ?");
    if (publishStatus !== "all") params.push(publishStatus);
    if (query) {
      where.push(
        `(c.formula_id LIKE ? ESCAPE '\\' OR c.slug LIKE ? ESCAPE '\\' OR
          c.display_name LIKE ? ESCAPE '\\' OR c.purpose LIKE ? ESCAPE '\\' OR
          r.latex LIKE ? ESCAPE '\\' OR r.markdown_derivation LIKE ? ESCAPE '\\')`
      );
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (tag) {
      where.push(
        `EXISTS (
          SELECT 1 FROM formula_card_tags ft
          WHERE ft.formula_id = c.formula_id AND ft.tag_key = ?
        )`
      );
      params.push(tag);
    }
    const whereSql = where.length ? where.join(" AND ") : "1 = 1";
    const total = Number(
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM formula_cards c
           LEFT JOIN formula_revisions r ON r.revision_id = c.current_revision_id
           WHERE ${whereSql}`
        )
        .get(...params).count || 0
    );
    const pageCount = total ? Math.ceil(total / pageSize) : 0;
    const effectivePage = pageCount ? Math.min(page, pageCount) : 1;
    const rows = db
      .prepare(
        `SELECT ${formulaCardColumns()}
         FROM formula_cards c
         LEFT JOIN formula_revisions r ON r.revision_id = c.current_revision_id
         WHERE ${whereSql}
         ORDER BY c.display_name ASC, c.formula_id ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, (effectivePage - 1) * pageSize);
    return {
      items: rows.map(decorateFormulaCard),
      facets,
      selection: { moduleKey, categoryPath, query, tag, archiveState, publishStatus },
      pagination: { page: effectivePage, pageSize, total, pageCount },
      requiresCategory: !moduleKey || !categoryPath
    };
  }

  function syncPostFormulaBindings(postId, markdown, options = {}) {
    const references = extractFormulaReferences(markdown);
    const allowArchivedBindingIds = new Set(options.allowArchivedBindingIds || []);
    const keep = new Set(references.map((reference) => reference.bindingId));
    const existingRows = db
      .prepare(
        `SELECT binding_id AS bindingId, post_id AS postId, formula_id AS formulaId,
                revision_id AS revisionId, display_mode AS displayMode
         FROM article_formula_bindings
         WHERE post_id = ?`
      )
      .all(postId);
    const existingById = new Map(existingRows.map((row) => [row.bindingId, row]));
    const lookupRevision = db.prepare(
      `SELECT c.formula_id AS formulaId, c.archived_at AS archivedAt
       FROM formula_revisions r
       JOIN formula_cards c ON c.formula_id = r.formula_id
       WHERE r.revision_id = ? AND r.formula_id = ?`
    );
    const bindingOwner = db.prepare(
      `SELECT post_id AS postId, formula_id AS formulaId, revision_id AS revisionId
       FROM article_formula_bindings WHERE binding_id = ?`
    );
    const insert = db.prepare(
      `INSERT INTO article_formula_bindings
        (binding_id, post_id, formula_id, revision_id, display_mode, ordinal)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const updatePresentation = db.prepare(
      `UPDATE article_formula_bindings
       SET display_mode = ?, ordinal = ?, updated_at = CURRENT_TIMESTAMP
       WHERE binding_id = ?`
    );

    for (const reference of references) {
      const revision = lookupRevision.get(reference.revisionId, reference.formulaId);
      if (!revision) {
        throw contentError(400, `文章公式引用不存在或修订不属于该公式：${reference.formulaId}/${reference.revisionId}`);
      }
      const owner = bindingOwner.get(reference.bindingId);
      if (owner && owner.postId !== postId) {
        throw contentError(409, `文章公式 bindingId 已被其他文章占用：${reference.bindingId}`);
      }
      const existing = existingById.get(reference.bindingId);
      if (existing) {
        if (existing.formulaId !== reference.formulaId || existing.revisionId !== reference.revisionId) {
          throw contentError(409, `文章公式绑定身份不可改写：${reference.bindingId}`);
        }
        updatePresentation.run(reference.displayMode, reference.ordinal, reference.bindingId);
        continue;
      }
      if (revision.archivedAt && !allowArchivedBindingIds.has(reference.bindingId)) {
        throw contentError(409, `已归档公式卡不能建立新文章绑定：${reference.formulaId}`);
      }
      insert.run(
        reference.bindingId,
        postId,
        reference.formulaId,
        reference.revisionId,
        reference.displayMode,
        reference.ordinal
      );
    }

    const remove = db.prepare("DELETE FROM article_formula_bindings WHERE binding_id = ?");
    const supersedeDecision = db.prepare(
      `UPDATE formula_reference_decisions
       SET status = 'superseded'
       WHERE binding_id = ? AND status = 'pending'`
    );
    for (const existing of existingRows) {
      if (!keep.has(existing.bindingId)) {
        supersedeDecision.run(existing.bindingId);
        remove.run(existing.bindingId);
      }
    }
    return formulaBindingsForPost(postId);
  }

  function insertFormulaRevision(payload, actor = {}) {
    const actorInfo = actorFields(actor);
    const dependencyFormulaIds = extractFormulaDependencyReferences(payload.markdownDerivation || "");
    validateFormulaDependencyTargets(payload.formulaId, dependencyFormulaIds);
    const revisionId = formulaRevisionId(payload);
    const existing = db
      .prepare(
        `SELECT revision_id AS revisionId, formula_id AS formulaId, latex,
                markdown_derivation AS markdownDerivation,
                display_name AS displayName, module_key AS moduleKey,
                category_path AS categoryPath, purpose, tags_json AS tagsJson,
                source_book_id AS sourceBookId,
                source_book_revision AS sourceBookRevision,
                source_formula_id AS sourceFormulaId
         FROM formula_revisions
         WHERE revision_id = ?`
      )
      .get(revisionId);
    if (existing) {
      if (
        existing.formulaId !== payload.formulaId ||
        existing.latex !== payload.latex ||
        existing.markdownDerivation !== (payload.markdownDerivation || "") ||
        existing.displayName !== payload.displayName ||
        existing.moduleKey !== payload.moduleKey ||
        existing.categoryPath !== payload.categoryPath ||
        existing.purpose !== (payload.purpose || "") ||
        existing.tagsJson !== JSON.stringify(payload.tags || []) ||
        existing.sourceBookId !== (payload.sourceBookId || "") ||
        existing.sourceBookRevision !== (payload.sourceBookRevision || "") ||
        existing.sourceFormulaId !== (payload.sourceFormulaId || "")
      ) {
        throw contentError(409, `公式修订标识冲突：${revisionId}`);
      }
      const storedDependencies = formulaDependencyRows(revisionId).map((item) => item.targetFormulaId);
      if (
        storedDependencies.length !== dependencyFormulaIds.length ||
        storedDependencies.some((formulaId, index) => formulaId !== dependencyFormulaIds[index])
      ) {
        throw contentError(409, `公式修订依赖与既有不可变修订冲突：${revisionId}`);
      }
      return { revisionId, created: false };
    }
    const sequence = Number(
      db.prepare("SELECT COALESCE(MAX(sequence_no), 0) + 1 AS sequence FROM formula_revisions WHERE formula_id = ?").get(payload.formulaId).sequence
    );
    db.prepare(
      `INSERT INTO formula_revisions
        (revision_id, formula_id, sequence_no, latex, markdown_derivation,
         display_name, module_key, category_path, purpose, tags_json, revision_reason,
         source_book_id, source_book_revision, source_formula_id,
         actor_user_id, actor_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      revisionId,
      payload.formulaId,
      sequence,
      payload.latex,
      payload.markdownDerivation || "",
      payload.displayName,
      payload.moduleKey,
      payload.categoryPath,
      payload.purpose || "",
      JSON.stringify(payload.tags || []),
      payload.revisionReason || "save",
      payload.sourceBookId || "",
      payload.sourceBookRevision || "",
      payload.sourceFormulaId || "",
      actorInfo.id,
      actorInfo.username
    );
    insertFormulaDependencies(revisionId, payload.formulaId, dependencyFormulaIds);
    return { revisionId, created: true, sequence };
  }

  function saveFormulaCard(payload) {
    return withTransaction(() => {
      const existing = formulaCardByIdAny(payload.formulaId);
      const legacyDependencies =
        existing && payload.preserveLegacyDependencies !== false
          ? formulaDependencyRows(existing.currentRevisionId)
              .filter((dependency) => dependency.provenance === "legacy_linear")
              .map((dependency) => dependency.targetFormulaId)
          : [];
      const explicitDependencies = extractFormulaDependencyReferences(payload.markdownDerivation || "");
      const promotedLegacyDependencies = legacyDependencies.filter(
        (formulaId) => !explicitDependencies.includes(formulaId)
      );
      const effectivePayload = {
        ...payload,
        markdownDerivation: appendDependencyMarkers(
          payload.markdownDerivation || "",
          promotedLegacyDependencies
        )
      };
      effectivePayload.dependencyFormulaIds = extractFormulaDependencyReferences(
        effectivePayload.markdownDerivation
      );
      validateFormulaDependencyTargets(
        effectivePayload.formulaId,
        effectivePayload.dependencyFormulaIds
      );
      const slugOwner = formulaCardBySlugAny(payload.slug);
      if (existing && existing.formulaId !== payload.formulaId) {
        throw contentError(409, `公式 formulaId 已被其他卡片占用：${payload.formulaId}`);
      }
      if (slugOwner && slugOwner.formulaId !== payload.formulaId) {
        throw contentError(409, `公式 slug 已存在：${payload.slug}`);
      }
      if (existing && existing.slug !== payload.slug) {
        throw contentError(409, "公式 route slug 建立后不可修改");
      }
      ensureFormulaClassifications(payload);
      if (!existing) {
        db.prepare(
          `INSERT INTO formula_cards
            (formula_id, slug, display_name, module_key, category_path, purpose,
             current_revision_id, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).run(
          effectivePayload.formulaId,
          effectivePayload.slug,
          effectivePayload.displayName,
          effectivePayload.moduleKey,
          effectivePayload.categoryPath,
          effectivePayload.purpose || ""
        );
      } else {
        db.prepare(
          `UPDATE formula_cards
           SET display_name = ?, module_key = ?, category_path = ?, purpose = ?, updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(
          effectivePayload.displayName,
          effectivePayload.moduleKey,
          effectivePayload.categoryPath,
          effectivePayload.purpose || "",
          effectivePayload.formulaId
        );
      }

      const current = formulaCardByIdAny(effectivePayload.formulaId);
      const presentationChanged =
        Boolean(existing) &&
        (existing.revisionDisplayName !== effectivePayload.displayName ||
          existing.revisionModuleKey !== effectivePayload.moduleKey ||
          existing.revisionCategoryPath !== effectivePayload.categoryPath ||
          existing.revisionPurpose !== (effectivePayload.purpose || "") ||
          JSON.stringify(existing.tags || []) !== JSON.stringify(effectivePayload.tags || []));
      let revisionCreated = false;
      let currentRevisionId = current.currentRevisionId;
      if (
        !currentRevisionId ||
        current.latex !== effectivePayload.latex ||
        current.markdownDerivation !== (effectivePayload.markdownDerivation || "") ||
        presentationChanged ||
        effectivePayload.forceDependencyRevision === true
      ) {
        const revision = insertFormulaRevision(effectivePayload, effectivePayload.actor);
        currentRevisionId = revision.revisionId;
        revisionCreated = revision.created;
        db.prepare(
          `UPDATE formula_cards
           SET current_revision_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(currentRevisionId, effectivePayload.formulaId);
      }
      syncFormulaTags(effectivePayload.formulaId, effectivePayload.tags);
      const revisionChanged = Boolean(existing?.currentRevisionId && existing.currentRevisionId !== currentRevisionId);
      const decisionCount = revisionChanged
        ? createFormulaReferenceDecisions(
            effectivePayload.formulaId,
            "revision_update",
            currentRevisionId,
            effectivePayload.actor
          )
        : 0;
      return {
        card: adminFormulaCard(effectivePayload.formulaId),
        revisionCreated,
        revisionChanged,
        currentRevisionId,
        decisionCount
      };
    });
  }

  function publishFormulaCard(id, actor = {}) {
    return withTransaction(() => {
      const card = formulaCardByIdAny(id);
      if (!card) throw notFound("formula card not found");
      if (card.publishStatus === "archived") {
        throw contentError(409, "已归档公式卡不能直接发布；请先恢复");
      }
      if (!card.currentRevisionId) throw contentError(409, "公式卡没有可发布的当前修订");
      const blockers = formulaDerivationForCard(card.formulaId, {
        admin: true,
        revisionId: card.currentRevisionId
      }).publicationBlockers;
      if (blockers.length) {
        throw contentError(
          409,
          `依赖公式尚未发布或已归档，当前修订不能发布：${blockers
            .map((blocker) => blocker.formulaId)
            .join("、")}`
        );
      }
      const actorInfo = actorFields(actor);
      const publication = db
        .prepare(
          `INSERT OR IGNORE INTO formula_revision_publications
            (revision_id, formula_id, actor_user_id, actor_username)
           VALUES (?, ?, ?, ?)`
        )
        .run(card.currentRevisionId, card.formulaId, actorInfo.id, actorInfo.username);
      const publicationChanged =
        card.publishStatus !== "published" || card.publishedRevisionId !== card.currentRevisionId;
      try {
        db.prepare(
          `UPDATE formula_cards
           SET publish_status = 'published',
               published_revision_id = current_revision_id,
               published_at = CURRENT_TIMESTAMP,
               archived_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(card.formulaId);
      } catch (error) {
        throw dependencyError(error);
      }
      return {
        card: adminFormulaCard(card.formulaId),
        publicationCreated: Number(publication.changes || 0) > 0,
        publicationChanged
      };
    });
  }

  function archiveFormulaCard(id, actor = {}) {
    return withTransaction(() => {
      const card = formulaCardByIdAny(id);
      if (!card) throw notFound("formula card not found");
      const archiveChanged = card.publishStatus !== "archived";
      db.prepare(
        `UPDATE formula_cards
         SET publish_status = 'archived',
             archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE formula_id = ?`
      ).run(card.formulaId);
      const decisionCount = archiveChanged
        ? createFormulaReferenceDecisions(
            card.formulaId,
            "card_archive",
            card.publishedRevisionId || card.currentRevisionId,
            actor
          )
        : 0;
      return { ...adminFormulaCard(card.formulaId), decisionCount };
    });
  }

  function restoreFormulaCard(id) {
    return withTransaction(() => {
      const card = formulaCardByIdAny(id);
      if (!card) throw notFound("formula card not found");
      db.prepare(
        `UPDATE formula_cards
         SET publish_status = CASE WHEN published_revision_id IS NULL THEN 'draft' ELSE 'published' END,
             archived_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE formula_id = ?`
      ).run(card.formulaId);
      return adminFormulaCard(card.formulaId);
    });
  }

  function exportFormulaCatalog() {
    const cards = db
      .prepare(
        `SELECT formula_id AS formulaId, slug, display_name AS displayName,
                module_key AS moduleKey, category_path AS categoryPath, purpose,
                current_revision_id AS currentRevisionId,
                published_revision_id AS publishedRevisionId,
                publish_status AS publishStatus, archived_at AS archivedAt
         FROM formula_cards
         ORDER BY formula_id ASC`
      )
      .all()
      .map((card) => {
        const revisions = db
          .prepare(
            `SELECT revision_id AS revisionId, sequence_no AS sequence, latex,
                    markdown_derivation AS markdownDerivation,
                    display_name AS displayName, module_key AS moduleKey,
                    category_path AS categoryPath, purpose, tags_json AS tagsJson,
                    revision_reason AS revisionReason,
                    source_book_id AS sourceBookId,
                    source_book_revision AS sourceBookRevision,
                    source_formula_id AS sourceFormulaId
             FROM formula_revisions
             WHERE formula_id = ?
             ORDER BY sequence_no ASC, revision_id ASC`
          )
          .all(card.formulaId)
          .map((revision) => ({
            ...revision,
            tags: parseFormulaTagsJson(revision.tagsJson)
          }));
        const publishedRevisionIds = db
          .prepare(
            `SELECT revision_id AS revisionId
             FROM formula_revision_publications
             WHERE formula_id = ?
             ORDER BY published_at ASC, revision_id ASC`
          )
          .all(card.formulaId)
          .map((publication) => publication.revisionId);
        return {
          formulaId: card.formulaId,
          slug: card.slug,
          displayName: card.displayName,
          moduleKey: card.moduleKey,
          categoryPath: card.categoryPath,
          purpose: card.purpose,
          tags: formulaTags(card.formulaId),
          publishStatus: card.publishStatus,
          archiveState: card.publishStatus === "archived" || card.archivedAt ? "archived" : "active",
          currentRevisionId: card.currentRevisionId,
          publishedRevisionId: card.publishedRevisionId,
          publishedRevisionIds,
          revisions
        };
      });
    return { schemaVersion: "larkix.formula-catalog.v1", cards };
  }

  function importFormulaCatalog(pkg, options = {}) {
    const actor = options.actor || {};
    const cards = pkg.cards || [];
    const importedFormulaIds = new Set(cards.map((card) => card.formulaId));
    const existingCards = new Map();
    const allFormulaIds = new Set(
      db.prepare("SELECT formula_id AS formulaId FROM formula_cards").all().map((row) => row.formulaId)
    );
    importedFormulaIds.forEach((formulaId) => allFormulaIds.add(formulaId));
    for (const card of cards) {
      const existing = formulaCardByIdAny(card.formulaId);
      existingCards.set(card.formulaId, existing);
      const slugOwner = formulaCardBySlugAny(card.slug);
      if (existing && existing.slug !== card.slug) {
        throw contentError(409, `公式 ${card.formulaId} 的 route slug 与现有卡片不一致`);
      }
      if (slugOwner && slugOwner.formulaId !== card.formulaId) {
        throw contentError(409, `公式导入 slug 已被占用：${card.slug}`);
      }
      for (const revision of card.revisions) {
        const byId = db
          .prepare(
            `SELECT formula_id AS formulaId, sequence_no AS sequence, latex,
                    markdown_derivation AS markdownDerivation,
                    display_name AS displayName, module_key AS moduleKey,
                    category_path AS categoryPath, purpose, tags_json AS tagsJson,
                    revision_reason AS revisionReason,
                    source_book_id AS sourceBookId,
                    source_book_revision AS sourceBookRevision,
                    source_formula_id AS sourceFormulaId
             FROM formula_revisions WHERE revision_id = ?`
          )
          .get(revision.revisionId);
        if (
          byId &&
          (byId.formulaId !== card.formulaId ||
            byId.sequence !== revision.sequence ||
            byId.latex !== revision.latex ||
            byId.markdownDerivation !== (revision.markdownDerivation || "") ||
            byId.displayName !== revision.displayName ||
            byId.moduleKey !== revision.moduleKey ||
            byId.categoryPath !== revision.categoryPath ||
            byId.purpose !== (revision.purpose || "") ||
            byId.tagsJson !== JSON.stringify(revision.tags || []) ||
            byId.sourceBookId !== revision.sourceBookId ||
            byId.sourceBookRevision !== revision.sourceBookRevision ||
            byId.sourceFormulaId !== revision.sourceFormulaId)
        ) {
          throw contentError(409, `公式修订冲突：${revision.revisionId}`);
        }
        const bySequence = db
          .prepare("SELECT revision_id AS revisionId FROM formula_revisions WHERE formula_id = ? AND sequence_no = ?")
          .get(card.formulaId, revision.sequence);
        if (bySequence && bySequence.revisionId !== revision.revisionId) {
          throw contentError(409, `公式 ${card.formulaId} 的修订序号 ${revision.sequence} 已被占用`);
        }
        const storedDependencies = formulaDependencyRows(revision.revisionId);
        const expectedDependencies = revision.dependencyFormulaIds || [];
        if (
          storedDependencies.some(
            (dependency) =>
              expectedDependencies[Number(dependency.ordinal)] !== dependency.targetFormulaId
          )
        ) {
          throw contentError(409, `公式修订依赖与导入包冲突：${revision.revisionId}`);
        }
        validateFormulaDependencyGraph({
          formulaIds: allFormulaIds,
          edges: [
            ...currentFormulaDependencyEdges([card.formulaId]),
            ...expectedDependencies.map((targetFormulaId, ordinal) => ({
              revisionId: revision.revisionId,
              sourceFormulaId: card.formulaId,
              targetFormulaId,
              ordinal
            }))
          ]
        });
      }
    }

    const importedCurrentEdges = cards.flatMap((card) => {
      const current = card.revisions.find(
        (revision) => revision.revisionId === card.currentRevisionId
      );
      return (current?.dependencyFormulaIds || []).map((targetFormulaId, ordinal) => ({
        revisionId: current.revisionId,
        sourceFormulaId: card.formulaId,
        targetFormulaId,
        ordinal
      }));
    });
    const graphAnalysis = validateFormulaDependencyGraph({
      formulaIds: allFormulaIds,
      edges: [
        ...currentFormulaDependencyEdges([...importedFormulaIds]),
        ...importedCurrentEdges
      ]
    });
    const desiredStatus = new Map(
      db
        .prepare(
          `SELECT formula_id AS formulaId, publish_status AS publishStatus,
                  published_revision_id AS publishedRevisionId, archived_at AS archivedAt
           FROM formula_cards`
        )
        .all()
        .map((card) => [card.formulaId, card])
    );
    cards.forEach((card) =>
      desiredStatus.set(card.formulaId, {
        formulaId: card.formulaId,
        publishStatus: card.publishStatus,
        publishedRevisionId: card.publishedRevisionId,
        archivedAt: card.publishStatus === "archived" ? "catalog-import" : null
      })
    );
    for (const card of cards.filter((item) => item.publishStatus === "published")) {
      const current = card.revisions.find(
        (revision) => revision.revisionId === card.currentRevisionId
      );
      const blockedTargets = (current?.dependencyFormulaIds || []).filter((targetFormulaId) => {
        const target = desiredStatus.get(targetFormulaId);
        return (
          !target ||
          target.publishStatus !== "published" ||
          !target.publishedRevisionId ||
          Boolean(target.archivedAt)
        );
      });
      if (blockedTargets.length) {
        throw contentError(
          409,
          `已发布公式 ${card.formulaId} 的依赖尚未发布或已归档：${blockedTargets.join("、")}`
        );
      }
    }
    const dependencyFirstCards = graphAnalysis.dependencyFirstOrder
      .filter((formulaId) => importedFormulaIds.has(formulaId))
      .map((formulaId) => cards.find((card) => card.formulaId === formulaId));

    return withTransaction(() => {
      const actorInfo = actorFields(actor);
      let revisionsCreated = 0;
      let dependenciesCreated = 0;
      let publicationsCreated = 0;
      let decisionsCreated = 0;
      for (const card of cards) {
        const existing = existingCards.get(card.formulaId);
        ensureFormulaClassifications(card);
        if (!existing) {
          db.prepare(
            `INSERT INTO formula_cards
              (formula_id, slug, display_name, module_key, category_path, purpose,
               current_revision_id, archived_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).run(card.formulaId, card.slug, card.displayName, card.moduleKey, card.categoryPath, card.purpose || "");
        } else {
          db.prepare(
            `UPDATE formula_cards
             SET display_name = ?, module_key = ?, category_path = ?, purpose = ?, updated_at = CURRENT_TIMESTAMP
             WHERE formula_id = ?`
          ).run(card.displayName, card.moduleKey, card.categoryPath, card.purpose || "", card.formulaId);
        }

      }

      for (const card of cards) {
        for (const revision of card.revisions) {
          const found = db.prepare("SELECT 1 AS present FROM formula_revisions WHERE revision_id = ?").get(revision.revisionId);
          if (!found) {
            db.prepare(
              `INSERT INTO formula_revisions
                (revision_id, formula_id, sequence_no, latex, markdown_derivation,
                 display_name, module_key, category_path, purpose, tags_json, revision_reason,
                 source_book_id, source_book_revision, source_formula_id,
                 actor_user_id, actor_username)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              revision.revisionId,
              card.formulaId,
              revision.sequence,
              revision.latex,
              revision.markdownDerivation || "",
              revision.displayName,
              revision.moduleKey,
              revision.categoryPath,
              revision.purpose || "",
              JSON.stringify(revision.tags || []),
              revision.revisionReason || "import",
              revision.sourceBookId || "",
              revision.sourceBookRevision || "",
              revision.sourceFormulaId || "",
              actorInfo.id,
              actorInfo.username
            );
            revisionsCreated += 1;
          }
          const existingDependencies = new Set(
            formulaDependencyRows(revision.revisionId).map(
              (dependency) => dependency.targetFormulaId
            )
          );
          const insertDependency = db.prepare(
            `INSERT INTO formula_revision_dependencies
              (revision_id, source_formula_id, target_formula_id, ordinal, provenance)
             VALUES (?, ?, ?, ?, 'markdown')`
          );
          (revision.dependencyFormulaIds || []).forEach((targetFormulaId, ordinal) => {
            if (existingDependencies.has(targetFormulaId)) return;
            try {
              insertDependency.run(
                revision.revisionId,
                card.formulaId,
                targetFormulaId,
                ordinal
              );
              dependenciesCreated += 1;
            } catch (error) {
              throw dependencyError(error);
            }
          });
        }
      }

      for (const card of cards) {
        const insertPublication = db.prepare(
          `INSERT OR IGNORE INTO formula_revision_publications
            (revision_id, formula_id, actor_user_id, actor_username)
           VALUES (?, ?, ?, ?)`
        );
        for (const revisionId of card.publishedRevisionIds || []) {
          const result = insertPublication.run(revisionId, card.formulaId, actorInfo.id, actorInfo.username);
          publicationsCreated += Number(result.changes || 0);
        }
      }

      for (const card of dependencyFirstCards) {
        db.prepare(
          `UPDATE formula_cards
           SET current_revision_id = ?,
               published_revision_id = ?,
               publish_status = ?,
               published_at = CASE WHEN ? IS NULL THEN published_at ELSE COALESCE(published_at, CURRENT_TIMESTAMP) END,
               archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END,
               updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(
          card.currentRevisionId,
          card.publishedRevisionId || null,
          card.publishStatus,
          card.publishedRevisionId || null,
          card.publishStatus,
          card.formulaId
        );
        syncFormulaTags(card.formulaId, card.tags);
      }

      for (const card of cards) {
        const existing = existingCards.get(card.formulaId);
        if (existing?.currentRevisionId && existing.currentRevisionId !== card.currentRevisionId) {
          decisionsCreated += createFormulaReferenceDecisions(
            card.formulaId,
            "revision_update",
            card.currentRevisionId,
            actor
          );
        }
        if (existing && existing.publishStatus !== "archived" && card.publishStatus === "archived") {
          decisionsCreated += createFormulaReferenceDecisions(
            card.formulaId,
            "card_archive",
            card.currentRevisionId,
            actor
          );
        }
      }
      return {
        importedCards: cards.length,
        revisionsCreated,
        ...(dependenciesCreated ? { dependenciesCreated } : {}),
        publicationsCreated,
        ...(decisionsCreated ? { decisionsCreated } : {}),
        totalCards: Number(db.prepare("SELECT COUNT(*) AS count FROM formula_cards").get().count || 0)
      };
    });
  }

  function formulaPublicationBlockers(markdown) {
    const references = extractFormulaReferences(markdown);
    const lookup = db.prepare(
      `SELECT c.formula_id AS formulaId, c.display_name AS displayName,
              c.publish_status AS publishStatus,
              EXISTS (
                SELECT 1 FROM formula_revision_publications publication
                WHERE publication.revision_id = ?
                  AND publication.formula_id = c.formula_id
              ) AS revisionWasPublished
       FROM formula_revisions revision
       JOIN formula_cards c ON c.formula_id = revision.formula_id
       WHERE revision.revision_id = ? AND revision.formula_id = ?`
    );
    const blockers = [];
    for (const reference of references) {
      const card = lookup.get(reference.revisionId, reference.revisionId, reference.formulaId);
      if (!card) continue;
      if (card.publishStatus === "draft") {
        blockers.push({
          reasonCode: "DRAFT_FORMULA",
          formulaId: card.formulaId,
          displayName: card.displayName,
          revisionId: reference.revisionId
        });
      } else if (!card.revisionWasPublished) {
        blockers.push({
          reasonCode: card.publishStatus === "archived" ? "ARCHIVED_UNPUBLISHED_REVISION" : "PENDING_FORMULA_REVISION",
          formulaId: card.formulaId,
          displayName: card.displayName,
          revisionId: reference.revisionId
        });
      }
    }
    return blockers;
  }

  function assertPostFormulaPublicationAllowed(payload) {
    if (payload.publishStatus !== "published") return;
    const blockers = formulaPublicationBlockers(payload.markdown);
    if (!blockers.length) return;
    const reasons = blockers.map((blocker) => {
      const identity = `「${blocker.displayName}」(${blocker.formulaId})`;
      if (blocker.reasonCode === "DRAFT_FORMULA") return `草稿公式卡 ${identity} 尚未发布`;
      if (blocker.reasonCode === "PENDING_FORMULA_REVISION") return `公式卡 ${identity} 引用了待发布修订`;
      return `已归档公式卡 ${identity} 的该修订从未发布`;
    });
    const error = contentError(409, `文章不能发布：${reasons.join("；")}。请先发布公式卡或改用已发布修订。`);
    error.reasonCode = blockers.some((blocker) => blocker.reasonCode === "DRAFT_FORMULA")
      ? "ARTICLE_DRAFT_FORMULA_BLOCKED"
      : "ARTICLE_UNPUBLISHED_FORMULA_REVISION_BLOCKED";
    throw error;
  }

  function savePost(payload) {
    return withTransaction(() => {
      assertPostFormulaPublicationAllowed(payload);
      createRevision("post", payload.id, "save", payload.actor);
      db.prepare(
        `INSERT INTO posts (id, slug, title, category, category_key, recommendation_priority, excerpt, cover,
                          cover_crop_x, cover_crop_y, cover_crop_width, cover_crop_height,
                          cover_crop_source_width, cover_crop_source_height, markdown, reading_minutes, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         category = excluded.category,
         category_key = excluded.category_key,
         recommendation_priority = excluded.recommendation_priority,
         excerpt = excluded.excerpt,
         cover = excluded.cover,
         cover_crop_x = excluded.cover_crop_x,
         cover_crop_y = excluded.cover_crop_y,
         cover_crop_width = excluded.cover_crop_width,
         cover_crop_height = excluded.cover_crop_height,
         cover_crop_source_width = excluded.cover_crop_source_width,
         cover_crop_source_height = excluded.cover_crop_source_height,
         markdown = excluded.markdown,
         reading_minutes = excluded.reading_minutes,
         date = excluded.date,
         publish_status = excluded.publish_status,
         featured = excluded.featured,
         featured_order = excluded.featured_order,
         deleted_at = posts.deleted_at,
         tags = excluded.tags,
         published_at = CASE
           WHEN excluded.publish_status = 'published' THEN COALESCE(posts.published_at, CURRENT_TIMESTAMP)
           ELSE posts.published_at
         END,
         updated_at = CURRENT_TIMESTAMP`
      ).run(
        payload.id,
        payload.slug || payload.id,
        payload.title,
        payload.category,
        payload.categoryKey,
        Number(payload.recommendationPriority || 100),
        payload.excerpt || "",
        payload.cover || "",
        payload.coverCrop?.x ?? null,
        payload.coverCrop?.y ?? null,
        payload.coverCrop?.width ?? null,
        payload.coverCrop?.height ?? null,
        payload.coverCrop?.sourceWidth ?? null,
        payload.coverCrop?.sourceHeight ?? null,
        payload.markdown || "",
        payload.readingMinutes ?? null,
        payload.date || new Date().toISOString().slice(0, 10),
        payload.publishStatus || "draft",
        0,
        0,
        payload.tags || "",
        payload.publishStatus === "published" ? new Date().toISOString() : null
      );
      syncHeroCarouselAssignment("post", payload, {
        actor: payload.actor,
        source: "content_save"
      });
      syncTags("post", payload.id, payload.tags);
      syncPostFormulaBindings(payload.id, payload.markdown, {
        allowArchivedBindingIds: payload.allowArchivedFormulaBindingIds || []
      });
      return postById(payload.id);
    });
  }

  function createFormulaFromSelection(
    { post, formula, selection, sourceHash, baseSourceHash = "" },
    actor = {}
  ) {
    return withTransaction(() => {
      if (sourceTextHash(post.markdown) !== sourceHash) {
        const error = contentError(409, "文章来源哈希不匹配，正文或选区已变化，请重新框选");
        error.reasonCode = "ARTICLE_SOURCE_HASH_MISMATCH";
        throw error;
      }
      const storedPost = postById(post.id);
      const currentBaseHash = storedPost ? sourceTextHash(storedPost.markdown) : "";
      if (currentBaseHash !== baseSourceHash) {
        const error = contentError(409, "文章已被其他操作更新，未创建公式卡；请刷新后重新框选");
        error.reasonCode = "ARTICLE_BASE_SOURCE_HASH_MISMATCH";
        throw error;
      }
      if (
        post.markdown.slice(selection.selectionStart, selection.selectionEnd) !==
        selection.selectedText
      ) {
        const error = contentError(409, "文章公式选区与来源快照不一致，请重新框选");
        error.reasonCode = "ARTICLE_SELECTION_SOURCE_MISMATCH";
        throw error;
      }
      assertFormulaClassificationsRegistered(formula);
      if (formulaCardByIdAny(formula.formulaId) || formulaCardBySlugAny(formula.slug)) {
        throw contentError(409, "相同名称与 LaTeX 的公式卡已存在，请搜索并绑定已有卡");
      }
      const savedFormula = saveFormulaCard({ ...formula, actor });
      const bindingId = `bind.${crypto.randomUUID()}`;
      const binding = {
        bindingId,
        formulaId: savedFormula.card.formulaId,
        revisionId: savedFormula.card.currentRevisionId,
        displayMode: selection.displayMode
      };
      const shortcode = formulaBindingShortcode(binding);
      const boundSource = formulaBindingMarkdown(post.markdown, selection, shortcode);
      const savedPost = savePost({ ...post, markdown: boundSource.markdown, actor });
      const savedBinding = savedPost.formulaBindings.find(
        (item) => item.bindingId === bindingId
      );
      if (!savedBinding) {
        throw contentError(500, "公式卡已创建但文章绑定校验失败，事务已回滚");
      }
      return {
        card: savedFormula.card,
        post: savedPost,
        binding: savedBinding,
        shortcode,
        selection: {
          start: selection.selectionStart,
          end: selection.selectionEnd,
          bindingStart: boundSource.bindingStart,
          bindingEnd: boundSource.bindingEnd,
          cursor: boundSource.cursor
        },
        sourceHash: sourceTextHash(savedPost.markdown)
      };
    });
  }

  function rebindFormulaReference(decision, formulaId, revisionId, actor = {}) {
    const post = postById(decision.postId);
    if (!post) throw notFound("referencing article not found");
    const reference = extractFormulaReferences(post.markdown).find(
      (item) => item.bindingId === decision.bindingId
    );
    if (
      !reference ||
      reference.formulaId !== decision.formulaId ||
      reference.revisionId !== decision.boundRevisionId
    ) {
      throw contentError(409, "文章公式引用已变化，请刷新待决事项后重试");
    }
    const shortcode = formulaBindingShortcode({
      bindingId: decision.bindingId,
      formulaId,
      revisionId,
      displayMode: reference.displayMode
    });
    const markdown = `${post.markdown.slice(0, reference.start)}${shortcode}${post.markdown.slice(reference.end)}`;
    db.prepare("DELETE FROM article_formula_bindings WHERE binding_id = ?").run(decision.bindingId);
    const card = formulaCardByIdAny(formulaId);
    const savedPost = savePost({
      ...post,
      markdown,
      actor,
      allowArchivedFormulaBindingIds: card?.archivedAt ? [decision.bindingId] : []
    });
    return {
      post: savedPost,
      binding: savedPost.formulaBindings.find((item) => item.bindingId === decision.bindingId),
      shortcode
    };
  }

  function resolveFormulaReferenceDecision(id, payload, actor = {}) {
    return withTransaction(() => {
      const decision = formulaReferenceDecisionById(id);
      if (!decision) throw notFound("formula reference decision not found");
      if (decision.status !== "pending") {
        throw contentError(409, "该公式版本事项已处理，请刷新后查看");
      }
      const binding = db
        .prepare(
          `SELECT binding_id AS bindingId, post_id AS postId, formula_id AS formulaId,
                  revision_id AS revisionId
           FROM article_formula_bindings
           WHERE binding_id = ?`
        )
        .get(decision.bindingId);
      if (
        !binding ||
        binding.postId !== decision.postId ||
        binding.formulaId !== decision.formulaId ||
        binding.revisionId !== decision.boundRevisionId
      ) {
        throw contentError(409, "文章公式绑定已变化，请刷新待决事项后重试");
      }

      let status = "";
      let resolvedFormulaId = decision.formulaId;
      let resolvedRevisionId = decision.boundRevisionId;
      let savedPost = postById(decision.postId);
      let savedCard = formulaCardByIdAny(decision.formulaId);
      let bindingResult = binding;
      if (payload.action === "keep") {
        status = "kept";
      } else if (payload.action === "adopt") {
        if (!savedCard?.currentRevisionId) throw contentError(409, "公式卡没有可采用的当前修订");
        status = "adopted";
        resolvedRevisionId = savedCard.currentRevisionId;
        const rebound = rebindFormulaReference(decision, resolvedFormulaId, resolvedRevisionId, actor);
        savedPost = rebound.post;
        bindingResult = rebound.binding;
      } else if (payload.action === "clone") {
        status = "cloned";
        const created = saveFormulaCard({ ...payload.formula, actor });
        savedCard = created.card;
        resolvedFormulaId = savedCard.formulaId;
        resolvedRevisionId = savedCard.currentRevisionId;
        const rebound = rebindFormulaReference(decision, resolvedFormulaId, resolvedRevisionId, actor);
        savedPost = rebound.post;
        bindingResult = rebound.binding;
      } else {
        throw contentError(400, "公式版本处理方式不合法");
      }

      const actorInfo = actorFields(actor);
      db.prepare(
        `UPDATE formula_reference_decisions
         SET status = ?, resolved_formula_id = ?, resolved_revision_id = ?,
             actor_user_id = ?, actor_username = ?, resolved_at = CURRENT_TIMESTAMP
         WHERE decision_id = ? AND status = 'pending'`
      ).run(status, resolvedFormulaId, resolvedRevisionId, actorInfo.id, actorInfo.username, decision.decisionId);

      return {
        decision: formulaReferenceDecisionById(decision.decisionId),
        post: savedPost,
        binding: bindingResult,
        card: adminFormulaCard(resolvedFormulaId)
      };
    });
  }

  function saveProject(payload) {
    return withTransaction(() => {
      createRevision("project", payload.id, "save", payload.actor);
      db.prepare(
        `INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date,
                             visibility_status, featured, featured_order, deleted_at,
                             repo_url, bom_url, docs_url, version, progress, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
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
         deleted_at = projects.deleted_at,
         repo_url = excluded.repo_url,
         bom_url = excluded.bom_url,
         docs_url = excluded.docs_url,
         version = excluded.version,
         progress = excluded.progress,
         tags = excluded.tags,
         published_at = CASE
           WHEN excluded.visibility_status = 'published' THEN COALESCE(projects.published_at, CURRENT_TIMESTAMP)
           ELSE projects.published_at
         END,
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
        0,
        0,
        payload.repoUrl || "",
        payload.bomUrl || "",
        payload.docsUrl || "",
        payload.version || "",
        Number(payload.progress || 0),
        payload.tags || "",
        payload.visibilityStatus === "published" ? new Date().toISOString() : null
      );
      syncHeroCarouselAssignment("project", payload, {
        actor: payload.actor,
        source: "content_save"
      });
      syncTags("project", payload.id, payload.tags);
      return projectById(payload.id);
    });
  }

  function restorePost(id, options = {}) {
    return withTransaction(() => {
      createRevision("post", id, "restore", options.actor);
      db.prepare("UPDATE posts SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return postById(id);
    });
  }

  function restoreProject(id, options = {}) {
    return withTransaction(() => {
      createRevision("project", id, "restore", options.actor);
      db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return projectById(id);
    });
  }

  function hardDeletePost(id, options = {}) {
    return withTransaction(() => {
      createRevision("post", id, "hard_delete", options.actor);
      removeHeroCarouselSlot("post", id);
      db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    });
  }

  function hardDeleteProject(id, options = {}) {
    return withTransaction(() => {
      createRevision("project", id, "hard_delete", options.actor);
      removeHeroCarouselSlot("project", id);
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    });
  }

  function softDeletePost(id, options = {}) {
    return withTransaction(() => {
      createRevision("post", id, "soft_delete", options.actor);
      removeHeroCarouselSlot("post", id);
      db.prepare("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return postById(id);
    });
  }

  function softDeleteProject(id, options = {}) {
    return withTransaction(() => {
      createRevision("project", id, "soft_delete", options.actor);
      removeHeroCarouselSlot("project", id);
      db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return projectById(id);
    });
  }

  function upsertPostSnapshot(snapshot) {
    db.prepare(
      `INSERT INTO posts (id, slug, title, category, category_key, recommendation_priority, excerpt, cover,
                          cover_crop_x, cover_crop_y, cover_crop_width, cover_crop_height,
                          cover_crop_source_width, cover_crop_source_height, markdown, reading_minutes, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         category = excluded.category,
         category_key = excluded.category_key,
         recommendation_priority = excluded.recommendation_priority,
         excerpt = excluded.excerpt,
         cover = excluded.cover,
         cover_crop_x = excluded.cover_crop_x,
         cover_crop_y = excluded.cover_crop_y,
         cover_crop_width = excluded.cover_crop_width,
         cover_crop_height = excluded.cover_crop_height,
         cover_crop_source_width = excluded.cover_crop_source_width,
         cover_crop_source_height = excluded.cover_crop_source_height,
         markdown = excluded.markdown,
         reading_minutes = excluded.reading_minutes,
         date = excluded.date,
         publish_status = excluded.publish_status,
         featured = excluded.featured,
         featured_order = excluded.featured_order,
         deleted_at = excluded.deleted_at,
         tags = excluded.tags,
         created_at = excluded.created_at,
         published_at = excluded.published_at,
         updated_at = CURRENT_TIMESTAMP`
    ).run(
      snapshot.id,
      snapshot.slug || snapshot.id,
      snapshot.title || "",
      snapshot.category || "",
      snapshot.categoryKey || "",
      Number(snapshot.recommendationPriority || 100),
      snapshot.excerpt || "",
      snapshot.cover || "",
      snapshot.coverCrop?.x ?? null,
      snapshot.coverCrop?.y ?? null,
      snapshot.coverCrop?.width ?? null,
      snapshot.coverCrop?.height ?? null,
      snapshot.coverCrop?.sourceWidth ?? null,
      snapshot.coverCrop?.sourceHeight ?? null,
      snapshot.markdown || "",
      snapshot.readingMinutes ?? null,
      snapshot.date || "",
      snapshot.publishStatus || "draft",
      0,
      0,
      snapshot.deletedAt || null,
      snapshot.tags || "",
      snapshot.createdAt || null,
      snapshot.publishedAt || null
    );
    const assignment = heroCarouselSlotForContent("post", snapshot.id);
    syncLegacyCarouselFields("post", snapshot.id, assignment?.slot ?? null);
    syncTags("post", snapshot.id, snapshot.tags);
    return postById(snapshot.id);
  }

  function upsertProjectSnapshot(snapshot) {
    db.prepare(
      `INSERT INTO projects (id, slug, title, status, status_key, summary, cover, markdown, license, stars, date,
                             visibility_status, featured, featured_order, deleted_at,
                             repo_url, bom_url, docs_url, version, progress, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
         deleted_at = excluded.deleted_at,
         repo_url = excluded.repo_url,
         bom_url = excluded.bom_url,
         docs_url = excluded.docs_url,
         version = excluded.version,
         progress = excluded.progress,
         tags = excluded.tags,
         created_at = excluded.created_at,
         published_at = excluded.published_at,
         updated_at = CURRENT_TIMESTAMP`
    ).run(
      snapshot.id,
      snapshot.slug || snapshot.id,
      snapshot.title || "",
      snapshot.status || "",
      snapshot.statusKey || "planned",
      snapshot.summary || "",
      snapshot.cover || "",
      snapshot.markdown || "",
      snapshot.license || "MIT License",
      Number(snapshot.stars || 0),
      snapshot.date || "",
      snapshot.visibilityStatus || "draft",
      0,
      0,
      snapshot.deletedAt || null,
      snapshot.repoUrl || "",
      snapshot.bomUrl || "",
      snapshot.docsUrl || "",
      snapshot.version || "",
      Number(snapshot.progress || 0),
      snapshot.tags || "",
      snapshot.createdAt || null,
      snapshot.publishedAt || null
    );
    const assignment = heroCarouselSlotForContent("project", snapshot.id);
    syncLegacyCarouselFields("project", snapshot.id, assignment?.slot ?? null);
    syncTags("project", snapshot.id, snapshot.tags);
    return projectById(snapshot.id);
  }

  function restoreRevision(type, contentId, revisionId, options = {}) {
    return withTransaction(() => {
      const revision = revisionById(type, contentId, revisionId);
      if (!revision) throw notFound("revision not found");
      createRevision(type, contentId, "before_revision_restore", options.actor);
      if (type === "project") return upsertProjectSnapshot(revision.snapshot);
      return upsertPostSnapshot(revision.snapshot);
    });
  }

  function syncTaxonomyForExistingContent() {
    for (const post of db.prepare("SELECT id, tags FROM posts").all()) {
      syncTags("post", post.id, post.tags);
    }
    for (const project of db.prepare("SELECT id, tags FROM projects").all()) {
      syncTags("project", project.id, project.tags);
    }
  }

  return {
    withTransaction,
    allPosts,
    allProjects,
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
    formulaBindingsForPost,
    publicFormulaCardBySlug,
    resolveLegacyFormulaRedirect,
    adminFormulaCard,
    listFormulaRevisions,
    listFormulaReferenceDecisions,
    listFormulaRelationRepairs,
    appendFormulaRelationRepairEvent,
    saveFormulaDerivation,
    saveFormulaClassification,
    saveFormulaCard,
    publishFormulaCard,
    archiveFormulaCard,
    restoreFormulaCard,
    exportFormulaCatalog,
    importFormulaCatalog,
    createFormulaFromSelection,
    resolveFormulaReferenceDecision,
    formulaPublicationBlockers,
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
    softDeleteKnowledgeNode,
    syncTaxonomyForExistingContent
  };
}

module.exports = {
  FOCUS_SCOPES,
  FOCUS_SCOPE_ALIASES,
  createContentStore,
  extractFormulaReferences,
  focusScopeForContent,
  formulaBindingMarkdown,
  formulaBindingShortcode,
  formulaRevisionId,
  isContentInFocusScope,
  normalizedFocusScope,
  normalizeFlag
};
