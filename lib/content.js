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
      .all();
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

  function postById(id) {
    return db
      .prepare(
        `SELECT id, slug, 'post' AS type, title, category, category_key AS categoryKey,
                recommendation_priority AS recommendationPriority,
                excerpt, cover, markdown, read_time AS readTime, date,
                publish_status AS publishStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM posts
         WHERE id = ?`
      )
      .get(id);
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
      return postById(payload.id);
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
    allKnowledgeNodes,
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
  createContentStore,
  normalizeFlag
};
