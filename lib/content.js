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
                excerpt, cover, markdown, read_time AS readTime, date,
                publish_status AS publishStatus, featured, featured_order AS featuredOrder, deleted_at AS deletedAt, tags,
                created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
         FROM posts
         ${visibilityFilter(admin)}
         ORDER BY deleted_at IS NOT NULL ASC, date DESC, updated_at DESC`
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

  function savePost(payload) {
    return withTransaction(() => {
      createRevision("post", payload.id, "save", payload.actor);
      db.prepare(
        `INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
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
      `INSERT INTO posts (id, slug, title, category, category_key, excerpt, cover, markdown, read_time, date,
                          publish_status, featured, featured_order, deleted_at, tags, created_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
    postById,
    projectById,
    listRevisions,
    restoreRevision,
    savePost,
    saveProject,
    restorePost,
    restoreProject,
    hardDeletePost,
    hardDeleteProject,
    softDeletePost,
    softDeleteProject,
    syncTaxonomyForExistingContent
  };
}

module.exports = {
  createContentStore,
  normalizeFlag
};
