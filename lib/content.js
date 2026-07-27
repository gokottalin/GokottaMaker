"use strict";

const crypto = require("node:crypto");

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

function formulaRevisionId({ formulaId, latex, sourceBookId = "", sourceBookRevision = "", sourceFormulaId = "" }) {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify([formulaId, latex, sourceBookId, sourceBookRevision, sourceFormulaId]))
    .digest("hex")
    .slice(0, 32);
  return `rev.${digest}`;
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
    return row ? { ...row, formulaBindings: formulaBindingsForPost(row.id) } : null;
  }

  function allPosts(admin = false) {
    return db
      .prepare(
        `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
                recommendation_priority AS recommendationPriority,
                excerpt, cover, markdown, read_time AS readTime, date,
                publish_status AS publishStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt, tags,
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
                visibility_status AS visibilityStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt,
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
      const disablePost = db.prepare("UPDATE posts SET featured = 0 WHERE id = ?");
      const disableProject = db.prepare("UPDATE projects SET featured = 0 WHERE id = ?");
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
        (item.contentType === "project" ? disableProject : disablePost).run(item.id);
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
      const active = [
        ...allPosts(true).map((item) => ({ ...item, contentType: "post" })),
        ...allProjects(true).map((item) => ({ ...item, contentType: "project" }))
      ].filter((item) => item.featured && !item.deletedAt);
      const conflict = active.find(
        (item) =>
          Number(item.featuredOrder || 0) === slot &&
          !(item.contentType === buffer.contentType && item.id === buffer.contentId)
      );
      if (conflict) {
        throw carouselBufferError(
          409,
          "CAROUSEL_SLOT_CONFLICT",
          `轮播槽位 ${slot} 已被《${conflict.title || "未命名内容"}》使用，请明确选择空槽位`
        );
      }
      const update =
        buffer.contentType === "project"
          ? db.prepare("UPDATE projects SET featured = 1, featured_order = ? WHERE id = ?")
          : db.prepare("UPDATE posts SET featured = 1, featured_order = ? WHERE id = ?");
      update.run(slot, buffer.contentId);
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
                excerpt, cover, markdown, read_time AS readTime, date,
                publish_status AS publishStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt, tags,
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
                visibility_status AS visibilityStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt,
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

  function formulaCardColumns() {
    return `c.formula_id AS formulaId, c.slug, c.display_name AS displayName,
            c.module_key AS moduleKey, c.category_path AS categoryPath, c.purpose,
            c.current_revision_id AS currentRevisionId, c.archived_at AS archivedAt,
            c.created_at AS createdAt, c.updated_at AS updatedAt,
            r.sequence_no AS currentRevisionSequence, r.latex,
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

  function decorateFormulaCard(row) {
    if (!row) return null;
    return {
      ...row,
      tags: formulaTags(row.formulaId),
      archiveState: row.archivedAt ? "archived" : "active"
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
    const card = formulaCardBySlugAny(slug);
    return card && !card.archivedAt
      ? { ...card, derivation: formulaDerivationForCard(card.formulaId, { admin: false }) }
      : null;
  }

  function listFormulaRevisions(id, limit = 200) {
    const card = formulaCardByIdAny(id);
    if (!card) return [];
    return db
      .prepare(
        `SELECT revision_id AS revisionId, formula_id AS formulaId, sequence_no AS sequence,
                latex, revision_reason AS revisionReason,
                source_book_id AS sourceBookId,
                source_book_revision AS sourceBookRevision,
                source_formula_id AS sourceFormulaId,
                actor_user_id AS actorUserId, actor_username AS actorUsername,
                created_at AS createdAt
         FROM formula_revisions
         WHERE formula_id = ?
         ORDER BY sequence_no DESC
         LIMIT ?`
      )
      .all(card.formulaId, Math.max(1, Math.min(Number(limit || 200), 500)));
  }

  function formulaDerivationNode(row, options = {}) {
    if (!row) return null;
    const node = {
      formulaId: row.formulaId,
      slug: row.slug,
      displayName: row.displayName,
      moduleKey: row.moduleKey,
      categoryPath: row.categoryPath,
      archiveState: row.archivedAt ? "archived" : "active",
      available: !row.archivedAt
    };
    if (options.edge) {
      node.createdAt = row.edgeCreatedAt || "";
      node.updatedAt = row.edgeUpdatedAt || "";
      if (options.admin) {
        node.actorUserId = row.actorUserId || null;
        node.actorUsername = row.actorUsername || "";
      }
    }
    return node;
  }

  function formulaDerivationForCard(id, options = {}) {
    const formulaId = String(id || "");
    const nodeColumns = (alias) =>
      `${alias}.formula_id AS formulaId, ${alias}.slug,
       ${alias}.display_name AS displayName, ${alias}.module_key AS moduleKey,
       ${alias}.category_path AS categoryPath, ${alias}.archived_at AS archivedAt`;
    const next = db
      .prepare(
        `SELECT ${nodeColumns("target")},
                e.actor_user_id AS actorUserId, e.actor_username AS actorUsername,
                e.created_at AS edgeCreatedAt, e.updated_at AS edgeUpdatedAt
         FROM formula_derivation_edges e
         JOIN formula_cards target ON target.formula_id = e.target_formula_id
         WHERE e.source_formula_id = ?`
      )
      .get(formulaId);
    const incoming = db
      .prepare(
        `SELECT ${nodeColumns("source")},
                e.actor_user_id AS actorUserId, e.actor_username AS actorUsername,
                e.created_at AS edgeCreatedAt, e.updated_at AS edgeUpdatedAt
         FROM formula_derivation_edges e
         JOIN formula_cards source ON source.formula_id = e.source_formula_id
         WHERE e.target_formula_id = ?
         ORDER BY source.display_name ASC, source.formula_id ASC`
      )
      .all(formulaId)
      .map((row) => formulaDerivationNode(row, { edge: true, admin: options.admin }));
    const result = {
      incoming,
      next: formulaDerivationNode(next, { edge: true, admin: options.admin }),
      brokenCount: incoming.filter((node) => !node.available).length + (next && next.archivedAt ? 1 : 0)
    };
    if (options.admin) {
      result.affectedSources = db
        .prepare(
          `WITH RECURSIVE affected(formula_id) AS (
             SELECT ?
             UNION
             SELECT e.source_formula_id
             FROM formula_derivation_edges e
             JOIN affected a ON e.target_formula_id = a.formula_id
           )
           SELECT ${nodeColumns("card")}
           FROM affected a
           JOIN formula_cards card ON card.formula_id = a.formula_id
           ORDER BY card.display_name ASC, card.formula_id ASC`
        )
        .all(formulaId)
        .map((row) => formulaDerivationNode(row));
    }
    return result;
  }

  function adminFormulaCard(id) {
    const card = formulaCardByIdAny(id);
    if (!card) return null;
    const derivation = formulaDerivationForCard(card.formulaId, { admin: true });
    if (card.archivedAt) {
      derivation.currentArchived = true;
      derivation.brokenCount += 1;
    }
    return {
      ...card,
      revisions: listFormulaRevisions(card.formulaId),
      derivation
    };
  }

  function saveFormulaDerivation(sourceId, payload, actor = {}) {
    return withTransaction(() => {
      const source = formulaCardByIdAny(sourceId);
      if (!source) throw notFound("formula source card not found");
      const existing = db
        .prepare(
          `SELECT target_formula_id AS targetFormulaId
           FROM formula_derivation_edges
           WHERE source_formula_id = ?`
        )
        .get(source.formulaId);
      const affectedSources = formulaDerivationForCard(source.formulaId, { admin: true }).affectedSources;

      if (payload.action === "remove") {
        if (existing) {
          db.prepare("DELETE FROM formula_derivation_edges WHERE source_formula_id = ?").run(source.formulaId);
        }
        return {
          changed: Boolean(existing),
          replaced: false,
          previousTargetId: existing?.targetFormulaId || null,
          source: adminFormulaCard(source.formulaId),
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

      if (existing) {
        db.prepare("DELETE FROM formula_derivation_edges WHERE source_formula_id = ?").run(source.formulaId);
      }
      const actorInfo = actorFields(actor);
      try {
        db.prepare(
          `INSERT INTO formula_derivation_edges
            (source_formula_id, target_formula_id, actor_user_id, actor_username)
           VALUES (?, ?, ?, ?)`
        ).run(source.formulaId, target.formulaId, actorInfo.id, actorInfo.username);
      } catch (error) {
        if (/cycle/i.test(error.message)) throw contentError(409, "此关系会形成循环推导，保存已阻止");
        if (/self-link/i.test(error.message)) throw contentError(400, "公式卡不能把自身设为下一阶");
        if (/missing|foreign key/i.test(error.message)) throw contentError(400, "推导关系中的公式卡不存在");
        throw error;
      }
      return {
        changed: true,
        replaced: Boolean(existing),
        previousTargetId: existing?.targetFormulaId || null,
        source: adminFormulaCard(source.formulaId),
        target: adminFormulaCard(target.formulaId),
        affectedSources
      };
    });
  }

  function formulaReferenceDecisionColumns() {
    return `d.decision_id AS decisionId, d.binding_id AS bindingId,
            d.post_id AS postId, p.slug AS postSlug, p.title AS postTitle,
            d.formula_id AS formulaId, c.slug AS formulaSlug,
            c.display_name AS formulaDisplayName, c.module_key AS moduleKey,
            c.category_path AS categoryPath, c.purpose,
            c.archived_at AS archivedAt, c.current_revision_id AS currentRevisionId,
            d.bound_revision_id AS boundRevisionId,
            bound.sequence_no AS boundRevisionSequence, bound.latex AS boundLatex,
            d.target_revision_id AS targetRevisionId,
            target.sequence_no AS targetRevisionSequence, target.latex AS targetLatex,
            current.sequence_no AS currentRevisionSequence, current.latex AS currentLatex,
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
                SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS activeCount,
                SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archivedCount
         FROM formula_cards
         GROUP BY module_key, category_path
         ORDER BY module_key ASC, category_path ASC`
      )
      .all();
    const modules = [];
    for (const row of categoryRows) {
      let module = modules.find((entry) => entry.moduleKey === row.moduleKey);
      if (!module) {
        module = { moduleKey: row.moduleKey, activeCount: 0, archivedCount: 0, categories: [] };
        modules.push(module);
      }
      const category = {
        categoryPath: row.categoryPath,
        activeCount: Number(row.activeCount || 0),
        archivedCount: Number(row.archivedCount || 0)
      };
      module.categories.push(category);
      module.activeCount += category.activeCount;
      module.archivedCount += category.archivedCount;
    }
    const tags = db
      .prepare(
        `SELECT t.tag_key AS tagKey,
                SUM(CASE WHEN c.archived_at IS NULL THEN 1 ELSE 0 END) AS activeCount,
                SUM(CASE WHEN c.archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archivedCount
         FROM formula_card_tags t
         JOIN formula_cards c ON c.formula_id = t.formula_id
         GROUP BY t.tag_key
         ORDER BY t.tag_key ASC`
      )
      .all()
      .map((row) => ({
        tagKey: row.tagKey,
        activeCount: Number(row.activeCount || 0),
        archivedCount: Number(row.archivedCount || 0)
      }));
    return { modules, tags };
  }

  function listFormulaCards(filters = {}) {
    const facets = formulaCatalogFacets();
    const moduleKey = String(filters.moduleKey || "").trim();
    const categoryPath = String(filters.categoryPath || "").trim();
    const query = String(filters.query || "").trim();
    const tag = String(filters.tag || "").trim();
    const archiveState = ["active", "archived", "all"].includes(filters.archiveState) ? filters.archiveState : "active";
    const requestedPageSize = Number(filters.pageSize || 12);
    const requestedPage = Number(filters.page || 1);
    const pageSize = Number.isFinite(requestedPageSize) ? Math.max(1, Math.min(Math.trunc(requestedPageSize), 50)) : 12;
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;
    const allowGlobalSearch = filters.allowGlobalSearch === true && Boolean(query || tag);
    if ((!moduleKey || !categoryPath) && !allowGlobalSearch) {
      return {
        items: [],
        facets,
        selection: { moduleKey, categoryPath, query, tag, archiveState },
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
    if (archiveState === "active") where.push("c.archived_at IS NULL");
    if (archiveState === "archived") where.push("c.archived_at IS NOT NULL");
    if (query) {
      where.push(
        `(c.formula_id LIKE ? ESCAPE '\\' OR c.slug LIKE ? ESCAPE '\\' OR
          c.display_name LIKE ? ESCAPE '\\' OR c.purpose LIKE ? ESCAPE '\\' OR
          r.latex LIKE ? ESCAPE '\\')`
      );
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
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
      selection: { moduleKey, categoryPath, query, tag, archiveState },
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
    const revisionId = formulaRevisionId(payload);
    const existing = db
      .prepare(
        `SELECT revision_id AS revisionId, formula_id AS formulaId, latex,
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
        existing.sourceBookId !== (payload.sourceBookId || "") ||
        existing.sourceBookRevision !== (payload.sourceBookRevision || "") ||
        existing.sourceFormulaId !== (payload.sourceFormulaId || "")
      ) {
        throw contentError(409, `公式修订标识冲突：${revisionId}`);
      }
      return { revisionId, created: false };
    }
    const sequence = Number(
      db.prepare("SELECT COALESCE(MAX(sequence_no), 0) + 1 AS sequence FROM formula_revisions WHERE formula_id = ?").get(payload.formulaId).sequence
    );
    db.prepare(
      `INSERT INTO formula_revisions
        (revision_id, formula_id, sequence_no, latex, revision_reason,
         source_book_id, source_book_revision, source_formula_id,
         actor_user_id, actor_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      revisionId,
      payload.formulaId,
      sequence,
      payload.latex,
      payload.revisionReason || "save",
      payload.sourceBookId || "",
      payload.sourceBookRevision || "",
      payload.sourceFormulaId || "",
      actorInfo.id,
      actorInfo.username
    );
    return { revisionId, created: true, sequence };
  }

  function saveFormulaCard(payload) {
    return withTransaction(() => {
      const existing = formulaCardByIdAny(payload.formulaId);
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

      if (!existing) {
        db.prepare(
          `INSERT INTO formula_cards
            (formula_id, slug, display_name, module_key, category_path, purpose,
             current_revision_id, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).run(payload.formulaId, payload.slug, payload.displayName, payload.moduleKey, payload.categoryPath, payload.purpose || "");
      } else {
        db.prepare(
          `UPDATE formula_cards
           SET display_name = ?, module_key = ?, category_path = ?, purpose = ?, updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(payload.displayName, payload.moduleKey, payload.categoryPath, payload.purpose || "", payload.formulaId);
      }

      const current = formulaCardByIdAny(payload.formulaId);
      let revisionCreated = false;
      let currentRevisionId = current.currentRevisionId;
      if (!currentRevisionId || current.latex !== payload.latex) {
        const revision = insertFormulaRevision(payload, payload.actor);
        currentRevisionId = revision.revisionId;
        revisionCreated = revision.created;
        db.prepare(
          `UPDATE formula_cards
           SET current_revision_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(currentRevisionId, payload.formulaId);
      }
      syncFormulaTags(payload.formulaId, payload.tags);
      const revisionChanged = Boolean(existing?.currentRevisionId && existing.currentRevisionId !== currentRevisionId);
      const decisionCount = revisionChanged
        ? createFormulaReferenceDecisions(payload.formulaId, "revision_update", currentRevisionId, payload.actor)
        : 0;
      return {
        card: adminFormulaCard(payload.formulaId),
        revisionCreated,
        revisionChanged,
        currentRevisionId,
        decisionCount
      };
    });
  }

  function archiveFormulaCard(id, actor = {}) {
    return withTransaction(() => {
      const card = formulaCardByIdAny(id);
      if (!card) throw notFound("formula card not found");
      const archiveChanged = !card.archivedAt;
      db.prepare(
        `UPDATE formula_cards
         SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE formula_id = ?`
      ).run(card.formulaId);
      const decisionCount = archiveChanged
        ? createFormulaReferenceDecisions(card.formulaId, "card_archive", card.currentRevisionId, actor)
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
         SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP
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
                current_revision_id AS currentRevisionId, archived_at AS archivedAt
         FROM formula_cards
         ORDER BY formula_id ASC`
      )
      .all()
      .map((card) => {
        const revisions = db
          .prepare(
            `SELECT revision_id AS revisionId, sequence_no AS sequence, latex,
                    revision_reason AS revisionReason,
                    source_book_id AS sourceBookId,
                    source_book_revision AS sourceBookRevision,
                    source_formula_id AS sourceFormulaId
             FROM formula_revisions
             WHERE formula_id = ?
             ORDER BY sequence_no ASC, revision_id ASC`
          )
          .all(card.formulaId);
        return {
          formulaId: card.formulaId,
          slug: card.slug,
          displayName: card.displayName,
          moduleKey: card.moduleKey,
          categoryPath: card.categoryPath,
          purpose: card.purpose,
          tags: formulaTags(card.formulaId),
          archiveState: card.archivedAt ? "archived" : "active",
          currentRevisionId: card.currentRevisionId,
          revisions
        };
      });
    return { schemaVersion: "larkix.formula-catalog.v1", cards };
  }

  function importFormulaCatalog(pkg, options = {}) {
    const actor = options.actor || {};
    const cards = pkg.cards || [];
    for (const card of cards) {
      const existing = formulaCardByIdAny(card.formulaId);
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
      }
    }

    return withTransaction(() => {
      const actorInfo = actorFields(actor);
      let revisionsCreated = 0;
      let decisionsCreated = 0;
      for (const card of cards) {
        const existing = formulaCardByIdAny(card.formulaId);
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

        for (const revision of card.revisions) {
          const found = db.prepare("SELECT 1 AS present FROM formula_revisions WHERE revision_id = ?").get(revision.revisionId);
          if (found) continue;
          db.prepare(
            `INSERT INTO formula_revisions
              (revision_id, formula_id, sequence_no, latex, revision_reason,
               source_book_id, source_book_revision, source_formula_id,
               actor_user_id, actor_username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            revision.revisionId,
            card.formulaId,
            revision.sequence,
            revision.latex,
            revision.revisionReason || "import",
            revision.sourceBookId || "",
            revision.sourceBookRevision || "",
            revision.sourceFormulaId || "",
            actorInfo.id,
            actorInfo.username
          );
          revisionsCreated += 1;
        }
        db.prepare(
          `UPDATE formula_cards
           SET current_revision_id = ?,
               archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END,
               updated_at = CURRENT_TIMESTAMP
           WHERE formula_id = ?`
        ).run(card.currentRevisionId, card.archiveState, card.formulaId);
        syncFormulaTags(card.formulaId, card.tags);
        if (existing?.currentRevisionId && existing.currentRevisionId !== card.currentRevisionId) {
          decisionsCreated += createFormulaReferenceDecisions(
            card.formulaId,
            "revision_update",
            card.currentRevisionId,
            actor
          );
        }
        if (existing && !existing.archivedAt && card.archiveState === "archived") {
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
        ...(decisionsCreated ? { decisionsCreated } : {}),
        totalCards: Number(db.prepare("SELECT COUNT(*) AS count FROM formula_cards").get().count || 0)
      };
    });
  }

  function savePost(payload) {
    return withTransaction(() => {
      createRevision("post", payload.id, "save", payload.actor);
      db.prepare(
        `INSERT INTO posts (id, slug, title, category, category_key, recommendation_priority, excerpt, cover, markdown, read_time, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         category = excluded.category,
         category_key = excluded.category_key,
         recommendation_priority = excluded.recommendation_priority,
         excerpt = excluded.excerpt,
         cover = excluded.cover,
         markdown = excluded.markdown,
         read_time = excluded.read_time,
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
        payload.markdown || "",
        payload.readTime || "10 分钟阅读",
        payload.date || new Date().toISOString().slice(0, 10),
        payload.publishStatus || "draft",
        normalizeFlag(payload.featured),
        Number(payload.featuredOrder || 0),
        payload.tags || "",
        payload.publishStatus === "published" ? new Date().toISOString() : null
      );
      syncTags("post", payload.id, payload.tags);
      syncPostFormulaBindings(payload.id, payload.markdown, {
        allowArchivedBindingIds: payload.allowArchivedFormulaBindingIds || []
      });
      return postById(payload.id);
    });
  }

  function createFormulaFromSelection({ post, formula, selection }, actor = {}) {
    return withTransaction(() => {
      const savedFormula = saveFormulaCard({ ...formula, actor });
      const bindingId = `bind.${crypto.randomUUID()}`;
      const binding = {
        bindingId,
        formulaId: savedFormula.card.formulaId,
        revisionId: savedFormula.card.currentRevisionId,
        displayMode: selection.displayMode
      };
      const shortcode = formulaBindingShortcode(binding);
      const nextMarkdown = `${post.markdown.slice(0, selection.selectionStart)}${shortcode}${post.markdown.slice(selection.selectionEnd)}`;
      const savedPost = savePost({ ...post, markdown: nextMarkdown, actor });
      return {
        card: savedFormula.card,
        post: savedPost,
        binding: savedPost.formulaBindings.find((item) => item.bindingId === bindingId),
        shortcode,
        selection: {
          start: selection.selectionStart,
          end: selection.selectionStart + shortcode.length
        }
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
        normalizeFlag(payload.featured),
        Number(payload.featuredOrder || 0),
        payload.repoUrl || "",
        payload.bomUrl || "",
        payload.docsUrl || "",
        payload.version || "",
        Number(payload.progress || 0),
        payload.tags || "",
        payload.visibilityStatus === "published" ? new Date().toISOString() : null
      );
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
      db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    });
  }

  function hardDeleteProject(id, options = {}) {
    return withTransaction(() => {
      createRevision("project", id, "hard_delete", options.actor);
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    });
  }

  function softDeletePost(id, options = {}) {
    return withTransaction(() => {
      createRevision("post", id, "soft_delete", options.actor);
      db.prepare("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return postById(id);
    });
  }

  function softDeleteProject(id, options = {}) {
    return withTransaction(() => {
      createRevision("project", id, "soft_delete", options.actor);
      db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return projectById(id);
    });
  }

  function upsertPostSnapshot(snapshot) {
    db.prepare(
      `INSERT INTO posts (id, slug, title, category, category_key, recommendation_priority, excerpt, cover, markdown, read_time, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         category = excluded.category,
         category_key = excluded.category_key,
         recommendation_priority = excluded.recommendation_priority,
         excerpt = excluded.excerpt,
         cover = excluded.cover,
         markdown = excluded.markdown,
         read_time = excluded.read_time,
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
      snapshot.markdown || "",
      snapshot.readTime || "",
      snapshot.date || "",
      snapshot.publishStatus || "draft",
      normalizeFlag(snapshot.featured),
      Number(snapshot.featuredOrder || 0),
      snapshot.deletedAt || null,
      snapshot.tags || "",
      snapshot.createdAt || null,
      snapshot.publishedAt || null
    );
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
      normalizeFlag(snapshot.featured),
      Number(snapshot.featuredOrder || 0),
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
    listCarouselFocusBuffer,
    carouselFocusBufferById,
    reconcileCarouselFocusBuffer,
    restoreCarouselFocusBuffer,
    removeCarouselFocusBuffer,
    allKnowledgeNodes,
    listFormulaCards,
    formulaBindingsForPost,
    publicFormulaCardBySlug,
    adminFormulaCard,
    listFormulaRevisions,
    listFormulaReferenceDecisions,
    saveFormulaDerivation,
    saveFormulaCard,
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
  formulaBindingShortcode,
  formulaRevisionId,
  isContentInFocusScope,
  normalizedFocusScope,
  normalizeFlag
};
