(function () {
  const savedLoginKey = "gokottamaker_admin_saved_login";
  const draftKey = "gokottamaker_admin_autodraft_v1";
  const autosaveDelay = 900;

  const loginPanel = document.querySelector("#loginPanel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#loginForm");
  const loginNotice = document.querySelector("#loginNotice");
  const adminNotice = document.querySelector("#adminNotice");
  const logoutButton = document.querySelector("#logoutButton");
  const exportButton = document.querySelector("#exportButton");
  const contentForm = document.querySelector("#contentForm");
  const preview = document.querySelector("#markdownPreview");
  const markdownFile = document.querySelector("#markdownFile");
  const coverFile = document.querySelector("#coverFile");
  const coverPreview = document.querySelector("#coverPreview");
  const coverHint = document.querySelector("#coverHint");
  const resetButton = document.querySelector("#resetButton");
  const list = document.querySelector("#adminContentList");
  const categoryField = document.querySelector("#categoryField");
  const statusField = document.querySelector("#statusField");
  const projectExtra = document.querySelector("#projectExtra");
  const imageLibrary = document.querySelector("#imageLibrary");
  const refreshImagesButton = document.querySelector("#refreshImagesButton");
  const draftStatus = document.querySelector("#draftStatus");
  const draftStatusText = document.querySelector("#draftStatusText");
  const discardDraftButton = document.querySelector("#discardDraftButton");
  const contentSearch = document.querySelector("#contentSearch");
  const typeFilter = document.querySelector("#typeFilter");
  const statusFilter = document.querySelector("#statusFilter");
  const clearFiltersButton = document.querySelector("#clearFiltersButton");
  const selectAllContent = document.querySelector("#selectAllContent");
  const contentResultCount = document.querySelector("#contentResultCount");
  const selectedCount = document.querySelector("#selectedCount");
  const bulkPublishButton = document.querySelector("#bulkPublishButton");
  const bulkDraftButton = document.querySelector("#bulkDraftButton");
  const bulkDeleteButton = document.querySelector("#bulkDeleteButton");
  const bulkRestoreButton = document.querySelector("#bulkRestoreButton");
  const refreshHealthButton = document.querySelector("#refreshHealthButton");
  const healthPanel = document.querySelector("#healthPanel");

  let editingType = null;
  let editingId = null;
  let currentCover = "";
  let csrfToken = "";
  let serverContent = { posts: [], projects: [] };
  let isDirty = false;
  let isRestoringForm = false;
  let autosaveTimer = 0;
  let lastDraftSavedAt = "";
  const selectedContent = new Set();
  const filters = { search: "", type: "all", status: "all" };

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const response = await fetch(path, {
      credentials: "same-origin",
      headers,
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "请求失败");
    if (payload.csrfToken) csrfToken = payload.csrfToken;
    return payload;
  }

  async function loadServerContent() {
    serverContent = await request("/api/admin/content");
  }

  function setLoggedIn(value) {
    loginPanel.hidden = value;
    dashboard.hidden = !value;
  }

  function saveLogin(username) {
    localStorage.setItem(savedLoginKey, JSON.stringify({ username }));
  }

  function loadSavedLogin() {
    try {
      const saved = JSON.parse(localStorage.getItem(savedLoginKey) || "{}");
      if (saved.username) loginForm.username.value = saved.username;
    } catch {
      return;
    }
  }

  function setNotice(message = "", type = "info") {
    const target = dashboard.hidden ? loginNotice : adminNotice;
    if (!target) return;
    target.textContent = message;
    target.classList.remove("is-success", "is-warning", "is-error");
    if (message && type !== "info") target.classList.add(`is-${type}`);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.idleText = button.textContent;
      button.textContent = label || "处理中...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.idleText || button.textContent;
      button.disabled = false;
      delete button.dataset.idleText;
    }
  }

  async function withBusy(button, label, task) {
    setBusy(button, true, label);
    try {
      return await task();
    } finally {
      setBusy(button, false);
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderMarkdown(markdown) {
    if (window.GokottaMarkdown) return window.GokottaMarkdown.render(markdown).html;
    return `<p>${escapeHtml(markdown || "Markdown 预览会显示在这里。")}</p>`;
  }

  function getType() {
    return new FormData(contentForm).get("type");
  }

  function categoryKey(category) {
    return { 模拟电子: "analog", STM32: "stm32", ESP32: "esp32", 开源项目: "projects" }[category] || "analog";
  }

  function statusText(statusKey) {
    return { planned: "规划中", development: "开发中", online: "已上线" }[statusKey] || "规划中";
  }

  function adminSrc(src) {
    if (!src) return "";
    if (src.startsWith("data:") || src.startsWith("http")) return src;
    if (src.startsWith("./")) return `../${src.slice(2)}`;
    return src;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function itemKey(item) {
    return `${item.contentType}:${item.id}`;
  }

  function publishValue(item) {
    return item.contentType === "project" ? item.visibilityStatus : item.publishStatus;
  }

  function searchableText(item) {
    return [
      item.title,
      item.excerpt,
      item.summary,
      item.category,
      item.status,
      item.license,
      item.tags,
      item.date,
      item.id,
      item.slug
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function updateTypeFields() {
    const type = getType();
    categoryField.hidden = type === "project";
    statusField.hidden = type !== "project";
    projectExtra.hidden = type !== "project";
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(contentForm.markdown.value);
  }

  function currentSnapshot() {
    const data = new FormData(contentForm);
    return {
      editingType,
      editingId,
      cover: currentCover,
      type: data.get("type") || "post",
      title: data.get("title") || "",
      category: data.get("category") || "模拟电子",
      statusKey: data.get("statusKey") || "planned",
      excerpt: data.get("excerpt") || "",
      tags: data.get("tags") || "",
      publishStatus: data.get("publishStatus") || "draft",
      featured: data.get("featured") === "on",
      featuredOrder: data.get("featuredOrder") || "0",
      version: data.get("version") || "",
      progress: data.get("progress") || "0",
      repoUrl: data.get("repoUrl") || "",
      bomUrl: data.get("bomUrl") || "",
      docsUrl: data.get("docsUrl") || "",
      markdown: data.get("markdown") || ""
    };
  }

  function snapshotHasContent(snapshot) {
    return Boolean(
      snapshot.title.trim() ||
        snapshot.excerpt.trim() ||
        snapshot.tags.trim() ||
        snapshot.markdown.trim() ||
        snapshot.cover ||
        snapshot.version.trim() ||
        snapshot.repoUrl.trim() ||
        snapshot.bomUrl.trim() ||
        snapshot.docsUrl.trim()
    );
  }

  function updateDraftStatus() {
    const draft = readDraft();
    draftStatus.hidden = !draft;
    if (!draft) return;
    const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : "刚刚";
    const title = draft.snapshot?.title ? `《${draft.snapshot.title}》` : "未命名内容";
    draftStatusText.textContent = `${title} 已自动保存在此浏览器，保存时间：${savedAt}。`;
  }

  function markDirty(value = true) {
    if (isRestoringForm) return;
    isDirty = value;
    if (isDirty) {
      queueDraftSave();
      setNotice("当前有未保存修改，本地草稿会自动保存在此浏览器。", "warning");
    }
  }

  function markClean() {
    isDirty = false;
  }

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  }

  function saveDraft() {
    const snapshot = currentSnapshot();
    if (!snapshotHasContent(snapshot)) {
      clearDraft();
      return;
    }
    lastDraftSavedAt = new Date().toISOString();
    localStorage.setItem(draftKey, JSON.stringify({ savedAt: lastDraftSavedAt, snapshot }));
    updateDraftStatus();
  }

  function queueDraftSave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(saveDraft, autosaveDelay);
  }

  function clearDraft() {
    localStorage.removeItem(draftKey);
    updateDraftStatus();
  }

  function confirmDiscard(message = "当前有未保存修改，确认继续吗？") {
    if (!isDirty) return true;
    return window.confirm(message);
  }

  function setCover(cover, label, options = {}) {
    const { dirty = true } = options;
    currentCover = cover || "";
    if (currentCover) {
      coverPreview.src = adminSrc(currentCover);
      coverPreview.classList.add("is-visible");
      coverHint.textContent = label || "已选择封面图片";
    } else {
      coverPreview.removeAttribute("src");
      coverPreview.classList.remove("is-visible");
      coverHint.textContent = "从资源管理器选择图片，推荐 1600x900 或 1920x1080";
    }
    if (dirty) markDirty();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("图片读取失败")));
      reader.readAsDataURL(file);
    });
  }

  function resetForm(options = {}) {
    const { dirty = false, clearLocalDraft = false } = options;
    isRestoringForm = true;
    editingType = null;
    editingId = null;
    contentForm.reset();
    contentForm.type.value = "post";
    contentForm.publishStatus.value = "draft";
    contentForm.featuredOrder.value = "0";
    setCover("", "", { dirty: false });
    updateTypeFields();
    updatePreview();
    isRestoringForm = false;
    if (clearLocalDraft) clearDraft();
    dirty ? markDirty() : markClean();
  }

  function combinedItems() {
    return [
      ...serverContent.posts.map((item) => ({ ...item, contentType: "post" })),
      ...serverContent.projects.map((item) => ({ ...item, contentType: "project" }))
    ];
  }

  function filteredItems() {
    const query = filters.search.trim().toLowerCase();
    return combinedItems().filter((item) => {
      if (filters.type !== "all" && item.contentType !== filters.type) return false;
      if (filters.status === "published" && (item.deletedAt || publishValue(item) !== "published")) return false;
      if (filters.status === "draft" && (item.deletedAt || publishValue(item) === "published")) return false;
      if (filters.status === "deleted" && !item.deletedAt) return false;
      if (filters.status === "featured" && !item.featured) return false;
      if (query && !searchableText(item).includes(query)) return false;
      return true;
    });
  }

  function pruneSelection() {
    const keys = new Set(combinedItems().map(itemKey));
    [...selectedContent].forEach((key) => {
      if (!keys.has(key)) selectedContent.delete(key);
    });
  }

  function updateBulkState(items = filteredItems()) {
    pruneSelection();
    const visibleKeys = items.map(itemKey);
    const selectedVisible = visibleKeys.filter((key) => selectedContent.has(key));
    contentResultCount.textContent = `${items.length} 项内容`;
    selectedCount.textContent = `已选择 ${selectedContent.size} 项`;
    selectAllContent.checked = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;
    selectAllContent.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleKeys.length;
    const hasSelection = selectedContent.size > 0;
    [bulkPublishButton, bulkDraftButton, bulkDeleteButton, bulkRestoreButton].forEach((button) => {
      button.disabled = !hasSelection;
    });
  }

  function renderList() {
    const items = filteredItems();
    updateBulkState(items);
    list.innerHTML =
      items
        .map((item) => {
          const kind = item.contentType === "project" ? "项目" : "文章";
          const publish = publishValue(item);
          const meta = item.contentType === "project" ? `${item.status} / ${item.license || ""}` : `${item.category} / ${item.readTime || ""}`;
          const tags = item.tags ? ` / ${item.tags}` : "";
          const deleted = Boolean(item.deletedAt);
          const key = itemKey(item);
          return `
            <article class="admin-row ${deleted ? "is-deleted" : ""}">
              <label class="admin-row-select" aria-label="选择 ${escapeHtml(item.title)}">
                <input data-action="select" data-key="${escapeHtml(key)}" type="checkbox" ${selectedContent.has(key) ? "checked" : ""} />
              </label>
              <img src="${adminSrc(item.cover)}" alt="${escapeHtml(item.title)}封面" />
              <div>
                <strong>
                  <span class="content-kind">${kind}</span>${escapeHtml(item.title)}
                  <span class="content-status">${deleted ? "回收站" : publish === "published" ? "已发布" : "草稿"}</span>
                </strong>
                <p>${escapeHtml(meta)}${escapeHtml(tags)} / ${escapeHtml(item.date || "暂无日期")} ${item.featured ? " / 首页轮播" : ""}</p>
                <p>${escapeHtml(item.excerpt || item.summary)}</p>
              </div>
              <div class="row-actions">
                ${deleted ? `
                  <button class="button secondary" data-action="restore" data-type="${item.contentType}" data-id="${item.id}" type="button">恢复</button>
                  <button class="button secondary" data-action="hard-delete" data-type="${item.contentType}" data-id="${item.id}" type="button">永久删除</button>
                ` : `
                  <button class="button secondary" data-action="edit" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
                  <button class="button secondary" data-action="delete" data-type="${item.contentType}" data-id="${item.id}" type="button">移入回收站</button>
                `}
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">没有匹配的内容。</div>`;
  }

  function renderImageLibrary(images = []) {
    imageLibrary.innerHTML =
      images
        .map(
          (image) => `
            <button class="image-choice" type="button" data-cover="${image.url}">
              <img src="${adminSrc(image.url)}" alt="${escapeHtml(image.name)}" />
              <span>${escapeHtml(image.name)}</span>
              <small class="image-meta">${formatBytes(image.size)} / ${escapeHtml(new Date(image.updatedAt).toLocaleDateString())}</small>
            </button>
          `
        )
        .join("") || `<div class="empty-state">还没有上传图片。</div>`;
  }

  async function loadImages() {
    const result = await request("/api/uploads");
    renderImageLibrary(result.uploads || []);
  }

  function healthCard(title, ok, lines) {
    return `
      <article class="health-card ${ok ? "is-ok" : "is-bad"}">
        <strong>${escapeHtml(title)}</strong>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </article>
    `;
  }

  function renderHealth(data) {
    if (!data) {
      healthPanel.innerHTML = `<div class="empty-state">暂时无法读取系统状态。</div>`;
      return;
    }
    const backup = data.backups?.latest;
    healthPanel.innerHTML = [
      healthCard("服务", Boolean(data.ok), [
        `版本：${data.versionLabel || ""}`,
        `提交：${data.gitCommit || ""}`,
        `Node：${data.node || ""}`,
        `运行：${data.uptimeSeconds || 0} 秒`
      ]),
      healthCard("数据库", Boolean(data.databaseReady && data.databaseWritable), [
        data.databaseReady ? "数据库连接正常" : "数据库连接异常",
        data.databaseWritable ? "数据库目录可写" : "数据库目录不可写",
        `体积：${formatBytes(data.database?.totalBytes)}`
      ]),
      healthCard("上传目录", Boolean(data.uploadsWritable), [
        data.uploadsWritable ? "上传目录可写" : "上传目录不可写",
        `文件：${data.uploadsStorage?.files || 0}`,
        `体积：${formatBytes(data.uploadsStorage?.bytes)}`
      ]),
      healthCard("内容", true, [
        `公开文章：${data.publicPosts || 0}`,
        `公开项目：${data.publicProjects || 0}`,
        `管理端内容：${(data.adminPosts || 0) + (data.adminProjects || 0)}`
      ]),
      healthCard("备份", Boolean(data.backups?.exists), [
        `备份目录：${data.backups?.exists ? "可读取" : "不可读取"}`,
        `备份数量：${data.backups?.count || 0}`,
        backup ? `最近备份：${backup.name}` : "最近备份：暂无"
      ])
    ].join("");
  }

  async function loadHealth() {
    const data = await request("/api/admin/health");
    renderHealth(data);
  }

  function applySnapshotToForm(snapshot, options = {}) {
    const { dirty = false } = options;
    isRestoringForm = true;
    editingType = snapshot.editingType || null;
    editingId = snapshot.editingId || null;
    contentForm.type.value = snapshot.type || "post";
    contentForm.title.value = snapshot.title || "";
    contentForm.excerpt.value = snapshot.excerpt || "";
    contentForm.tags.value = snapshot.tags || "";
    contentForm.markdown.value = snapshot.markdown || "";
    contentForm.publishStatus.value = snapshot.publishStatus || "draft";
    contentForm.featured.checked = Boolean(snapshot.featured);
    contentForm.featuredOrder.value = snapshot.featuredOrder || 0;
    contentForm.category.value = snapshot.category || "模拟电子";
    contentForm.statusKey.value = snapshot.statusKey || "planned";
    contentForm.version.value = snapshot.version || "";
    contentForm.progress.value = snapshot.progress || 0;
    contentForm.repoUrl.value = snapshot.repoUrl || "";
    contentForm.bomUrl.value = snapshot.bomUrl || "";
    contentForm.docsUrl.value = snapshot.docsUrl || "";
    setCover(snapshot.cover, snapshot.cover ? "已从本地草稿恢复封面" : "", { dirty: false });
    updateTypeFields();
    updatePreview();
    isRestoringForm = false;
    dirty ? markDirty() : markClean();
  }

  function applyItemToForm(type, item) {
    if (!confirmDiscard("当前编辑器里有未保存修改，切换内容会覆盖表单，确认继续吗？")) return;
    applySnapshotToForm(
      {
        editingType: type,
        editingId: item.id,
        type,
        title: item.title || "",
        excerpt: item.excerpt || item.summary || "",
        tags: item.tags || "",
        markdown: item.markdown || "",
        publishStatus: type === "post" ? item.publishStatus || "draft" : item.visibilityStatus || "draft",
        featured: Boolean(item.featured),
        featuredOrder: item.featuredOrder || 0,
        category: item.category || "模拟电子",
        statusKey: item.statusKey || "planned",
        version: item.version || "",
        progress: item.progress || 0,
        repoUrl: item.repoUrl || "",
        bomUrl: item.bomUrl || "",
        docsUrl: item.docsUrl || "",
        cover: item.cover || ""
      },
      { dirty: false }
    );
    setNotice(`正在编辑：${item.title || "未命名内容"}`, "info");
    window.location.hash = "editor";
  }

  function restoreDraftIfNeeded() {
    const draft = readDraft();
    updateDraftStatus();
    if (!draft?.snapshot || !snapshotHasContent(draft.snapshot)) return;
    const title = draft.snapshot.title ? `《${draft.snapshot.title}》` : "未命名内容";
    if (window.confirm(`检测到本地草稿 ${title}，是否恢复到编辑器？`)) {
      applySnapshotToForm(draft.snapshot, { dirty: true });
      setNotice("已恢复本地草稿。草稿尚未写入 SQLite，请确认后保存内容。", "warning");
      window.location.hash = "editor";
    }
  }

  function buildPayload() {
    const data = new FormData(contentForm);
    const type = data.get("type");
    const now = new Date().toISOString().slice(0, 10);
    const contentId = editingId || `${type}-${Date.now()}`;
    const base = {
      id: contentId,
      slug: contentId,
      type,
      title: data.get("title"),
      cover: currentCover || (type === "post" ? "./assets/covers/analog-cover.png" : "./assets/covers/project-cover.png"),
      markdown: data.get("markdown"),
      tags: data.get("tags"),
      date: now,
      featured: data.get("featured") === "on",
      featuredOrder: Number(data.get("featuredOrder") || 0)
    };

    if (type === "post") {
      const category = data.get("category");
      return {
        endpoint: "/api/posts",
        collectionKey: "posts",
        payload: {
          ...base,
          category,
          categoryKey: categoryKey(category),
          publishStatus: data.get("publishStatus"),
          readTime: "10 分钟阅读",
          excerpt: data.get("excerpt")
        }
      };
    }

    const statusKey = data.get("statusKey");
    return {
      endpoint: "/api/projects",
      collectionKey: "projects",
      payload: {
        ...base,
        statusKey,
        status: statusText(statusKey),
        visibilityStatus: data.get("publishStatus"),
        summary: data.get("excerpt"),
        license: "MIT License",
        stars: 0,
        version: data.get("version"),
        progress: Number(data.get("progress") || 0),
        repoUrl: data.get("repoUrl"),
        bomUrl: data.get("bomUrl"),
        docsUrl: data.get("docsUrl")
      }
    };
  }

  function selectedItems() {
    const itemMap = new Map(combinedItems().map((item) => [itemKey(item), item]));
    return [...selectedContent].map((key) => itemMap.get(key)).filter(Boolean);
  }

  async function saveItemStatus(item, status) {
    if (item.contentType === "post") {
      const payload = { ...item, type: "post", publishStatus: status };
      const result = await request("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      serverContent = { ...serverContent, posts: result.posts };
      return;
    }

    const payload = { ...item, type: "project", visibilityStatus: status };
    const result = await request("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    serverContent = { ...serverContent, projects: result.projects };
  }

  async function mutateItem(item, action) {
    const collectionKey = item.contentType === "project" ? "projects" : "posts";
    const basePath = item.contentType === "project" ? "projects" : "posts";
    let result;

    if (action === "publish") {
      await saveItemStatus(item, "published");
      return;
    }
    if (action === "draft") {
      await saveItemStatus(item, "draft");
      return;
    }
    if (action === "delete") {
      result = await request(`/api/${basePath}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    }
    if (action === "restore") {
      result = await request(`/api/${basePath}/${encodeURIComponent(item.id)}/restore`, { method: "POST", body: "{}" });
    }
    if (result) serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
  }

  async function runBulkAction(action, button, label, confirmMessage) {
    const items = selectedItems();
    if (!items.length) {
      setNotice("请先选择内容。", "warning");
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage.replace("{count}", items.length))) return;

    await withBusy(button, label, async () => {
      for (const item of items) {
        await mutateItem(item, action);
      }
      selectedContent.clear();
      renderList();
      setNotice(`批量操作完成：${items.length} 项。`, "success");
    });
    updateBulkState();
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector("button[type='submit']");
    const data = new FormData(loginForm);
    const username = data.get("username");
    const password = data.get("password");
    withBusy(submitButton, "登录中...", async () => {
      try {
        const login = await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
        csrfToken = login.csrfToken || csrfToken;
        await loadServerContent();
        await loadImages();
        await loadHealth().catch(() => {});
        setNotice("");
        saveLogin(username);
        setLoggedIn(true);
        renderList();
        restoreDraftIfNeeded();
      } catch (error) {
        loginNotice.textContent = error.message;
      }
    });
  });

  logoutButton.addEventListener("click", () => {
    if (!confirmDiscard("当前有未保存修改，退出登录会保留本地草稿但不会写入数据库，确认退出吗？")) return;
    withBusy(logoutButton, "退出中...", async () => {
      await request("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
      csrfToken = "";
      setLoggedIn(false);
      setNotice("");
    });
  });

  exportButton.addEventListener("click", () => {
    withBusy(exportButton, "导出中...", async () => {
      try {
        const data = await request("/api/admin/export");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `gokottamaker-content-${data.site?.versionLabel || "export"}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setNotice("内容导出已生成。", "success");
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });

  resetButton.addEventListener("click", () => {
    if (!confirmDiscard("当前有未保存修改，新建空白会清空编辑器，确认继续吗？")) return;
    resetForm({ clearLocalDraft: true });
    setNotice("已切换为新建空白内容。", "info");
  });

  discardDraftButton.addEventListener("click", () => {
    if (!window.confirm("确认丢弃本地草稿吗？数据库中已保存的内容不会受影响。")) return;
    clearDraft();
    markClean();
    setNotice("本地草稿已丢弃。", "success");
  });

  refreshImagesButton.addEventListener("click", () => {
    withBusy(refreshImagesButton, "刷新中...", async () => {
      try {
        await loadImages();
        setNotice("图片库已刷新。", "success");
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });

  refreshHealthButton.addEventListener("click", () => {
    withBusy(refreshHealthButton, "刷新中...", async () => {
      try {
        await loadHealth();
        setNotice("系统状态已刷新。", "success");
      } catch (error) {
        renderHealth(null);
        setNotice(error.message, "error");
      }
    });
  });

  contentSearch.addEventListener("input", () => {
    filters.search = contentSearch.value;
    renderList();
  });

  typeFilter.addEventListener("change", () => {
    filters.type = typeFilter.value;
    renderList();
  });

  statusFilter.addEventListener("change", () => {
    filters.status = statusFilter.value;
    renderList();
  });

  clearFiltersButton.addEventListener("click", () => {
    filters.search = "";
    filters.type = "all";
    filters.status = "all";
    contentSearch.value = "";
    typeFilter.value = "all";
    statusFilter.value = "all";
    renderList();
  });

  selectAllContent.addEventListener("change", () => {
    const items = filteredItems();
    if (selectAllContent.checked) {
      items.forEach((item) => selectedContent.add(itemKey(item)));
    } else {
      items.forEach((item) => selectedContent.delete(itemKey(item)));
    }
    renderList();
  });

  bulkPublishButton.addEventListener("click", () => {
    runBulkAction("publish", bulkPublishButton, "发布中...", "确认发布已选择的 {count} 项内容吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkDraftButton.addEventListener("click", () => {
    runBulkAction("draft", bulkDraftButton, "转草稿中...", "确认将已选择的 {count} 项内容转为草稿吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkDeleteButton.addEventListener("click", () => {
    runBulkAction("delete", bulkDeleteButton, "回收中...", "确认将已选择的 {count} 项内容移入回收站吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkRestoreButton.addEventListener("click", () => {
    runBulkAction("restore", bulkRestoreButton, "恢复中...", "确认恢复已选择的 {count} 项内容吗？").catch((error) => setNotice(error.message, "error"));
  });

  contentForm.addEventListener("input", () => {
    markDirty();
    updatePreview();
  });

  contentForm.addEventListener("change", (event) => {
    if (event.target.name === "type") updateTypeFields();
    markDirty();
  });

  imageLibrary.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cover]");
    if (!button) return;
    setCover(button.dataset.cover, "已从图片库选择封面");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(button.dataset.cover).catch(() => {});
    }
    setNotice("已选择图片，并复制图片路径。", "success");
  });

  markdownFile.addEventListener("change", async () => {
    const file = markdownFile.files[0];
    if (!file) return;
    contentForm.markdown.value = await file.text();
    if (!contentForm.title.value) contentForm.title.value = file.name.replace(/\.md$/i, "");
    updatePreview();
    markDirty();
  });

  coverFile.addEventListener("change", () => {
    const file = coverFile.files[0];
    if (!file) return;
    withBusy(coverFile, "", async () => {
      try {
        coverHint.textContent = `正在上传封面：${file.name}`;
        const dataUrl = await readFileAsDataUrl(file);
        const result = await request("/api/uploads", {
          method: "POST",
          body: JSON.stringify({ filename: file.name, dataUrl })
        });
        setCover(result.url, `${file.name} 已上传`);
        renderImageLibrary(result.uploads || []);
        setNotice("封面上传成功，本地草稿已更新，请保存内容写入数据库。", "success");
      } catch (error) {
        coverHint.textContent = error.message;
        setNotice(error.message, "error");
      }
    });
  });

  contentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = contentForm.querySelector("button[type='submit']");
    withBusy(submitButton, "保存中...", async () => {
      try {
        saveDraft();
        const { endpoint, collectionKey, payload } = buildPayload();
        const result = await request(endpoint, { method: "POST", body: JSON.stringify(payload) });
        serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
        clearDraft();
        resetForm();
        renderList();
        setNotice(`保存成功：${payload.title || "未命名内容"}。`, "success");
      } catch (error) {
        saveDraft();
        setNotice(`${error.message}。当前编辑内容已保留在本地草稿。`, "error");
      }
    });
  });

  list.addEventListener("click", (event) => {
    const checkbox = event.target.closest("input[data-action='select']");
    if (checkbox) {
      if (checkbox.checked) selectedContent.add(checkbox.dataset.key);
      else selectedContent.delete(checkbox.dataset.key);
      updateBulkState(filteredItems());
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const type = button.dataset.type;
    const id = button.dataset.id;
    const collectionKey = type === "project" ? "projects" : "posts";
    const basePath = type === "project" ? "projects" : "posts";

    withBusy(button, "处理中...", async () => {
      try {
        if (button.dataset.action === "edit") {
          const item = serverContent[collectionKey].find((entry) => entry.id === id);
          if (item) applyItemToForm(type, item);
          return;
        }
        if (button.dataset.action === "delete") {
          if (!window.confirm("确认移入回收站吗？访客端将不再显示。")) return;
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}`, { method: "DELETE" });
          serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
          setNotice("内容已移入回收站。", "success");
        }
        if (button.dataset.action === "restore") {
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" });
          serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
          setNotice("内容已恢复。", "success");
        }
        if (button.dataset.action === "hard-delete") {
          if (!window.confirm("永久删除无法从回收站恢复，确认继续吗？")) return;
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/hard`, { method: "DELETE" });
          serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
          setNotice("内容已永久删除。", "success");
        }
        renderList();
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty) return;
    saveDraft();
    event.preventDefault();
    event.returnValue = "";
  });

  (async () => {
    loadSavedLogin();
    const session = await request("/api/session").catch(() => ({ user: null }));
    csrfToken = session.csrfToken || "";
    const loggedIn = Boolean(session.user);
    setLoggedIn(loggedIn);
    if (loggedIn) {
      await loadServerContent();
      await loadImages();
      await loadHealth().catch(() => {});
      restoreDraftIfNeeded();
    } else {
      updateDraftStatus();
    }
    updateTypeFields();
    updatePreview();
    renderList();
  })();
})();
