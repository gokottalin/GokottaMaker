(function () {
  const postStorageKey = "larkixmaker_posts";
  const projectStorageKey = "larkixmaker_projects";
  const deletedStorageKey = "larkixmaker_deleted";

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function deleted(type) {
    const data = read(deletedStorageKey, { posts: [], projects: [] });
    return new Set(data[type] || []);
  }

  function setDeleted(type, ids) {
    const data = read(deletedStorageKey, { posts: [], projects: [] });
    data[type] = [...ids];
    write(deletedStorageKey, data);
  }

  function mergeDefaults(defaults, localItems, deletedIds) {
    const localMap = new Map(localItems.map((item) => [item.id, item]));
    const merged = defaults
      .filter((item) => !deletedIds.has(item.id))
      .map((item) => ({ ...item, ...(localMap.get(item.id) || {}) }));
    const additions = localItems.filter((item) => !defaults.some((base) => base.id === item.id) && !deletedIds.has(item.id));
    return [...additions, ...merged];
  }

  function focusMode() {
    const value = window.LARKIX_SERVER_CONTENT?.publicFocusMode;
    return value && typeof value === "object" ? { enabled: true, ...value } : { enabled: true };
  }

  function focusModeEnabled() {
    return focusMode().enabled === true;
  }

  function focusPostAllowed(post) {
    const categoryKey = String(post?.categoryKey || "").toLowerCase();
    const category = String(post?.category || "");
    const tags = String(post?.tags || "").toLowerCase();
    if (["electronics-basics", "power-electronics", "projects", "derivations"].includes(categoryKey)) return true;
    if (["电子基础", "电力电子", "开源项目"].includes(category)) return true;
    if (/(?:^|[\s,，、])module:(?:electronics-basics|power-electronics|projects|derivations)(?:$|[\s,，、])/.test(tags)) return true;
    if (String(post?.tags || "").split(/[,，、]/).some((tag) => tag.trim().startsWith("公式"))) return true;
    return /\{\{(?:formula|derive):/.test(String(post?.markdown || ""));
  }

  function getPosts() {
    const posts = window.LARKIX_SERVER_CONTENT?.posts || mergeDefaults(window.LARKIX_POSTS || [], read(postStorageKey, []), deleted("posts"));
    return focusModeEnabled() ? posts.filter(focusPostAllowed) : posts;
  }

  function getProjects() {
    if (window.LARKIX_SERVER_CONTENT?.projects) return window.LARKIX_SERVER_CONTENT.projects;
    return mergeDefaults(window.LARKIX_PROJECTS || window.LARKIX_SEED?.projects || [], read(projectStorageKey, []), deleted("projects"));
  }

  function sanitizeProjectPreview(project) {
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

  function getProjectDirectory() {
    if (window.LARKIX_SERVER_CONTENT?.projectDirectory) return window.LARKIX_SERVER_CONTENT.projectDirectory;
    return mergeDefaults(window.LARKIX_PROJECTS || window.LARKIX_SEED?.projects || [], read(projectStorageKey, []), deleted("projects")).map(sanitizeProjectPreview);
  }

  function getHeroCarousel() {
    const slots = window.LARKIX_SERVER_CONTENT?.heroCarousel;
    if (!Array.isArray(slots)) return [];
    return slots
      .slice()
      .sort((a, b) => Number(a.slot ?? a.featuredOrder ?? 0) - Number(b.slot ?? b.featuredOrder ?? 0))
      .slice(0, 4);
  }

  function isCurrentHref(href) {
    const target = new URL(href, location.href);
    return target.pathname === location.pathname && target.search === location.search;
  }

  function applyFocusedNavigation() {
    if (!focusModeEnabled()) return;
    document.body.classList.add("public-focus-mode");
    const links = [
      { href: "./maker.html", label: "首页" },
      { href: "./category.html?category=electronics-basics", label: "电子基础" },
      { href: "./derive.html", label: "公式推导" },
      { href: "./projects.html", label: "开源项目" }
    ];
    document.querySelectorAll(".site-header .main-nav").forEach((nav) => {
      nav.classList.add("focus-mode-nav");
      nav.innerHTML = links
        .map((link) => `<a href="${link.href}"${isCurrentHref(link.href) ? ' aria-current="page"' : ""}>${link.label}</a>`)
        .join("");
    });
    if (focusMode().hideAdminFromPublicNav !== false) {
      document.querySelectorAll('.site-header .admin-link[href="./admin/index.html"], .site-header .admin-link[href$="/admin/index.html"]').forEach((link) => {
        link.hidden = true;
      });
    }
  }

  function savePost(post) {
    const items = read(postStorageKey, []);
    const next = items.some((item) => item.id === post.id) ? items.map((item) => (item.id === post.id ? post : item)) : [post, ...items];
    write(postStorageKey, next);
  }

  function saveProject(project) {
    const items = read(projectStorageKey, []);
    const next = items.some((item) => item.id === project.id)
      ? items.map((item) => (item.id === project.id ? project : item))
      : [project, ...items];
    write(projectStorageKey, next);
  }

  function remove(type, id) {
    const key = type === "project" ? projectStorageKey : postStorageKey;
    const deletedKey = type === "project" ? "projects" : "posts";
    write(
      key,
      read(key, []).filter((item) => item.id !== id)
    );
    const ids = deleted(deletedKey);
    ids.add(id);
    setDeleted(deletedKey, ids);
  }

  window.LarkixContent = {
    getPosts,
    getProjects,
    getProjectDirectory,
    getHeroCarousel,
    savePost,
    saveProject,
    remove
  };

  window.addEventListener("DOMContentLoaded", applyFocusedNavigation);
})();
