function normalizeFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1" ? 1 : 0;
}

function visibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND publish_status = 'published'";
}

function projectVisibilityFilter(admin = false) {
  return admin ? "" : "WHERE deleted_at IS NULL AND visibility_status = 'published'";
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
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createContentStore(db) {
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

  function savePost(payload) {
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
  }

  function saveProject(payload) {
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
  }

  function restorePost(id) {
    db.prepare("UPDATE posts SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  }

  function restoreProject(id) {
    db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  }

  function hardDeletePost(id) {
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  }

  function hardDeleteProject(id) {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  function softDeletePost(id) {
    db.prepare("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  }

  function softDeleteProject(id) {
    db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
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
    allPosts,
    allProjects,
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
