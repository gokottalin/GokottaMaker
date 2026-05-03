(function () {
  const postStorageKey = "gokottamaker_posts";
  const projectStorageKey = "gokottamaker_projects";
  const deletedStorageKey = "gokottamaker_deleted";

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

  function getPosts() {
    if (window.GOKOTTA_SERVER_CONTENT?.posts) return window.GOKOTTA_SERVER_CONTENT.posts;
    return mergeDefaults(window.GOKOTTA_POSTS || [], read(postStorageKey, []), deleted("posts"));
  }

  function getProjects() {
    if (window.GOKOTTA_SERVER_CONTENT?.projects) return window.GOKOTTA_SERVER_CONTENT.projects;
    return mergeDefaults(window.GOKOTTA_PROJECTS || window.GOKOTTA_SEED?.projects || [], read(projectStorageKey, []), deleted("projects"));
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

  window.GokottaContent = {
    getPosts,
    getProjects,
    savePost,
    saveProject,
    remove
  };
})();
