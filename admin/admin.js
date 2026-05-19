(function () {
  const savedLoginKey = "larkixmaker_admin_saved_login";
  const draftKey = "larkixmaker_admin_autodraft_v1";
  const sidebarStateKey = "larkixmaker_admin_sidebar_collapsed";
  const editorDockStateKey = "larkixmaker_admin_editor_dock_collapsed";
  const autosaveDelay = 900;

  const loginPanel = document.querySelector("#loginPanel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#loginForm");
  const loginNotice = document.querySelector("#loginNotice");
  const passwordToggle = document.querySelector("#passwordToggle");
  const sidebarToggle = document.querySelector("#sidebarToggle");
  const editorDock = document.querySelector("#editor");
  const editorDockToggle = document.querySelector("#editorDockToggle");
  const editorDockHandle = document.querySelector("#editorDockHandle");
  const editorDockState = document.querySelector("#editorDockState");
  const adminNotice = document.querySelector("#adminNotice");
  const logoutButton = document.querySelector("#logoutButton");
  const exportButton = document.querySelector("#exportButton");
  const contentForm = document.querySelector("#contentForm");
  const preview = document.querySelector("#markdownPreview");
  const markdownFile = document.querySelector("#markdownFile");
  const markdownHint = document.querySelector("#markdownHint");
  const coverFile = document.querySelector("#coverFile");
  const coverPreview = document.querySelector("#coverPreview");
  const coverHint = document.querySelector("#coverHint");
  const coverCropModal = document.querySelector("#coverCropModal");
  const coverCropCanvas = document.querySelector("#coverCropCanvas");
  const coverCropZoom = document.querySelector("#coverCropZoom");
  const coverCropX = document.querySelector("#coverCropX");
  const coverCropY = document.querySelector("#coverCropY");
  const coverCropApply = document.querySelector("#coverCropApply");
  const coverCropCancel = document.querySelector("#coverCropCancel");
  const resetButton = document.querySelector("#resetButton");
  const list = document.querySelector("#adminContentList");
  const categoryField = document.querySelector("#categoryField");
  const recommendationPriorityField = document.querySelector("#recommendationPriorityField");
  const statusField = document.querySelector("#statusField");
  const projectExtra = document.querySelector("#projectExtra");
  const visibilityHint = document.querySelector("#visibilityHint");
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
  const recentContentList = document.querySelector("#recentContentList");
  const featuredSlots = document.querySelector("#featuredSlots");
  const adminViews = [...document.querySelectorAll("[data-admin-view]")];
  const adminNavLinks = [...document.querySelectorAll("[data-admin-nav]")];
  const bulkPublishButton = document.querySelector("#bulkPublishButton");
  const bulkDraftButton = document.querySelector("#bulkDraftButton");
  const bulkDeleteButton = document.querySelector("#bulkDeleteButton");
  const bulkRestoreButton = document.querySelector("#bulkRestoreButton");
  const refreshHealthButton = document.querySelector("#refreshHealthButton");
  const healthPanel = document.querySelector("#healthPanel");
  const layoutPanel = document.querySelector("#layoutPanel");

  let editingType = null;
  let editingId = null;
  let currentCover = "";
  let csrfToken = "";
  let serverContent = { posts: [], projects: [], siteLayout: { home: [] } };
  let isDirty = false;
  let isRestoringForm = false;
  let autosaveTimer = 0;
  let lastDraftSavedAt = "";
  let cropState = null;
  let layoutDragState = null;
  const selectedContent = new Set();
  const filters = { search: "", type: "all", status: "all" };
  const featuredLimit = 4;
  const defaultLayoutPages = [
    {
      key: "home",
      label: "首页",
      sections: [
        { key: "hero", label: "首页首屏", description: "首页第一屏大海报与轮播内容。", order: 1, visible: true, size: "hero", preview: "hero" },
        { key: "recommended", label: "推荐内容", description: "按文章主分类与推荐优先级生成的推荐海报和列表。", order: 2, visible: true, size: "wide", preview: "recommended" },
        { key: "projects", label: "开源项目", description: "游客端首页的开源项目区。", order: 3, visible: true, size: "wide", preview: "cards" },
        { key: "miniapps", label: "网页小程序", description: "MD2File、LarkixElec 等工具入口，默认排在页面底部。", order: 4, visible: true, size: "wide", preview: "miniapps" }
      ]
    },
    {
      key: "category",
      label: "分类课程页",
      sections: [
        { key: "categoryHeader", label: "标题与搜索", description: "分类页顶部标题、摘要、搜索和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "courseContent", label: "课程内容与推荐", description: "课程大纲、推荐起点、文章列表和相关项目。", order: 2, visible: true, size: "hero", preview: "course" }
      ]
    },
    {
      key: "projectsPage",
      label: "开源项目页",
      sections: [
        { key: "projectsHeader", label: "项目页标题", description: "开源项目页顶部标题、摘要和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "projectList", label: "项目列表", description: "公开项目卡片列表。", order: 2, visible: true, size: "hero", preview: "cards" }
      ]
    },
    {
      key: "miniappsPage",
      label: "小程序中心",
      sections: [
        { key: "miniappsHeader", label: "小程序页标题", description: "小程序中心顶部标题、摘要和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "miniappRegistry", label: "小程序列表", description: "网页小程序卡片列表。", order: 2, visible: true, size: "hero", preview: "miniapps" }
      ]
    },
    {
      key: "postPage",
      label: "文章详情页",
      sections: [
        { key: "postHero", label: "文章详情头图", description: "文章详情页顶部封面、分类和标题区。", order: 1, visible: true, size: "wide", preview: "hero" },
        { key: "postBody", label: "文章正文与目录", description: "文章目录和 Markdown 正文区域。", order: 2, visible: true, size: "hero", preview: "article" }
      ]
    },
    {
      key: "projectDetailPage",
      label: "项目详情页",
      sections: [
        { key: "projectHero", label: "项目详情头图", description: "项目详情页顶部封面、状态和标题区。", order: 1, visible: true, size: "wide", preview: "hero" },
        { key: "projectBody", label: "项目正文与目录", description: "项目目录和 Markdown 正文区域。", order: 2, visible: true, size: "hero", preview: "article" }
      ]
    }
  ];

  function storedBool(key) {
    return localStorage.getItem(key) === "true";
  }

  function setSidebarCollapsed(value) {
    dashboard.classList.toggle("is-sidebar-collapsed", value);
    sidebarToggle.setAttribute("aria-pressed", String(value));
    sidebarToggle.setAttribute("aria-label", value ? "展开侧栏" : "收缩侧栏");
    sidebarToggle.textContent = value ? "›" : "‹";
    localStorage.setItem(sidebarStateKey, String(value));
  }

  function setEditorDockCollapsed(value) {
    editorDock.classList.toggle("is-collapsed", value);
    editorDockToggle.textContent = value ? "展开" : "收起";
    editorDockHandle.setAttribute("aria-expanded", String(!value));
    editorDockState.textContent = value ? "已收起" : "展开";
    localStorage.setItem(editorDockStateKey, String(value));
  }

  function updatePasswordActive() {
    const password = loginForm.password;
    loginPanel.classList.toggle("is-password-active", document.activeElement === password || Boolean(password.value));
  }

  function setPasswordVisible(value) {
    loginForm.password.type = value ? "text" : "password";
    passwordToggle.textContent = value ? "隐藏" : "显示";
    passwordToggle.setAttribute("aria-label", value ? "隐藏密码" : "显示密码");
    passwordToggle.setAttribute("aria-pressed", String(value));
  }

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
    if (window.LarkixMarkdown) return window.LarkixMarkdown.render(markdown).html;
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

  function fallbackCover(item) {
    if (item.cover) return item.cover;
    if (item.contentType === "project") return "./assets/covers/project-cover.png";
    const key = categoryKey(item.category || "");
    if (key === "stm32") return "./assets/covers/stm32-cover.png";
    if (key === "esp32") return "./assets/covers/esp32-cover.png";
    if (key === "projects") return "./assets/covers/project-cover.png";
    return "./assets/covers/analog-cover.png";
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

  function featuredOrderValue(value) {
    const order = Number(value);
    if (!Number.isFinite(order)) return 0;
    return Math.min(featuredLimit - 1, Math.max(0, Math.trunc(order)));
  }

  function featuredSlotLabel(value) {
    return ["第一张", "第二张", "第三张", "第四张"][featuredOrderValue(value)] || "第一张";
  }

  function recommendationPriorityValue(value) {
    const priority = Number(value);
    if (!Number.isFinite(priority)) return 100;
    return Math.min(999, Math.max(1, Math.trunc(priority)));
  }

  function layoutOrderValue(value) {
    const order = Number(value);
    if (!Number.isFinite(order)) return 1;
    return Math.min(99, Math.max(1, Math.trunc(order)));
  }

  function layoutSizeValue(value) {
    return ["compact", "standard", "wide", "hero"].includes(value) ? value : "standard";
  }

  function layoutSizeLabel(value) {
    return { compact: "紧凑", standard: "标准", wide: "宽版", hero: "大块" }[layoutSizeValue(value)];
  }

  function layoutNextSize(value) {
    const sizes = ["compact", "standard", "wide", "hero"];
    const index = sizes.indexOf(layoutSizeValue(value));
    return sizes[(index + 1) % sizes.length];
  }

  function sortedLayoutSections(sections = []) {
    return sections
      .slice()
      .sort((a, b) => layoutOrderValue(a.order) - layoutOrderValue(b.order) || String(a.key).localeCompare(String(b.key)));
  }

  function featuredItems() {
    return combinedItems()
      .filter((item) => item.featured && !item.deletedAt)
      .sort((a, b) => featuredOrderValue(a.featuredOrder) - featuredOrderValue(b.featuredOrder) || itemTimestamp(b) - itemTimestamp(a));
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
    recommendationPriorityField.hidden = type === "project";
    statusField.hidden = type !== "project";
    projectExtra.hidden = type !== "project";
    updateVisibilityHint();
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(contentForm.markdown.value);
  }

  function visibilityMessage(snapshot = currentSnapshot()) {
    const isProject = snapshot.type === "project";
    const isPublished = snapshot.publishStatus === "published";
    if (!isPublished) {
      return { tone: "warning", text: "草稿不会进入访客端、RSS 或 sitemap；当前预览仅用于编辑校对。" };
    }
    if (isProject && snapshot.statusKey !== "online") {
      return { tone: "warning", text: "规划中或开发中的项目保存后不会公开正文；访客直链只显示“尚未上线”提示。" };
    }
    if (snapshot.featured) {
      return { tone: "success", text: `保存后将公开展示，并进入首页轮播${featuredSlotLabel(snapshot.featuredOrder)}。` };
    }
    return { tone: "success", text: "保存后将作为公开内容展示；如需进入首页首屏，请选择对应的轮播位置。" };
  }

  function updateVisibilityHint() {
    if (!visibilityHint) return;
    const message = visibilityMessage();
    visibilityHint.textContent = message.text;
    visibilityHint.classList.toggle("is-warning", message.tone === "warning");
    visibilityHint.classList.toggle("is-success", message.tone === "success");
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
      featuredOrder: String(featuredOrderValue(data.get("featuredOrder") || "0")),
      recommendationPriority: String(recommendationPriorityValue(data.get("recommendationPriority") || "100")),
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

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", () => reject(new Error("图片解析失败，请换一张常见格式图片。")));
      image.src = dataUrl;
    });
  }

  function drawCoverCrop() {
    if (!cropState || !coverCropCanvas) return;
    const canvas = coverCropCanvas;
    const context = canvas.getContext("2d");
    const image = cropState.image;
    const zoom = Number(coverCropZoom.value || 1);
    const offsetX = Number(coverCropX.value || 0) / 100;
    const offsetY = Number(coverCropY.value || 0) / 100;
    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const maxX = Math.max(0, (width - canvas.width) / 2);
    const maxY = Math.max(0, (height - canvas.height) / 2);
    const x = (canvas.width - width) / 2 - maxX * offsetX;
    const y = (canvas.height - height) / 2 - maxY * offsetY;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f4f8fe";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, x, y, width, height);
  }

  async function openCoverCrop(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    cropState = { file, image };
    coverCropZoom.value = "1";
    coverCropX.value = "0";
    coverCropY.value = "0";
    drawCoverCrop();
    coverCropModal.hidden = false;
    coverCropZoom.focus();
  }

  function closeCoverCrop() {
    coverCropModal.hidden = true;
    cropState = null;
    coverFile.value = "";
  }

  async function uploadCroppedCover() {
    if (!cropState) return;
    const originalName = cropState.file.name.replace(/\.[^.]+$/, "") || "cover";
    const dataUrl = coverCropCanvas.toDataURL("image/jpeg", 0.9);
    const result = await request("/api/uploads", {
      method: "POST",
      body: JSON.stringify({ filename: `${originalName}-cover.jpg`, dataUrl })
    });
    setCover(result.url, `${originalName}-cover.jpg 已上传`);
    renderImageLibrary(result.uploads || []);
    setNotice("封面裁剪并上传成功，本地草稿已更新，请保存内容写入数据库。", "success");
    closeCoverCrop();
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
    contentForm.recommendationPriority.value = "100";
    setCover("", "", { dirty: false });
    updateTypeFields();
    updatePreview();
    updateVisibilityHint();
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

  function itemTimestamp(item) {
    return Date.parse(item.updatedAt || item.createdAt || item.date || "") || 0;
  }

  function recentItems(limit = 4) {
    return combinedItems()
      .filter((item) => !item.deletedAt)
      .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
      .slice(0, limit);
  }

  function renderRecentContent() {
    if (!recentContentList) return;
    recentContentList.innerHTML =
      recentItems()
        .map((item) => {
          const kind = item.contentType === "project" ? "项目" : "文章";
          const publish = publishValue(item) === "published" ? "已发布" : "草稿";
          const meta = item.contentType === "project" ? item.status || "项目" : item.category || "文章";
          const cover = fallbackCover(item);
          return `
            <article class="admin-recommendation-card">
              <img src="${adminSrc(cover)}" alt="${escapeHtml(item.title || "未命名内容")}封面" />
              <div class="admin-recommendation-body">
                <span>${kind} / ${escapeHtml(publish)} / ${escapeHtml(meta)}</span>
                <strong>${escapeHtml(item.title || "未命名内容")}</strong>
                <p>${escapeHtml(item.date || "暂无日期")}</p>
                <button class="button secondary" data-action="edit" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">暂无可推荐内容。</div>`;
  }

  function renderFeaturedSlots() {
    if (!featuredSlots) return;
    const byOrder = new Map();
    featuredItems().forEach((item) => {
      const order = featuredOrderValue(item.featuredOrder);
      if (!byOrder.has(order)) byOrder.set(order, item);
    });
    const current = currentSnapshot();
    const canAssignCurrent = snapshotHasContent(current);
    featuredSlots.innerHTML = Array.from({ length: featuredLimit }, (_, order) => {
      const item = byOrder.get(order);
      if (!item) {
        return `
          <article class="featured-slot is-empty" data-slot="${order}">
            <div class="featured-slot-head">
              <span>${featuredSlotLabel(order)}</span>
              <small>空槽位</small>
            </div>
            <div class="featured-slot-empty-mark">待安排</div>
            <button class="button secondary" data-action="assign-featured-slot" data-slot="${order}" type="button" ${canAssignCurrent ? "" : "disabled"}>填入当前内容</button>
          </article>
        `;
      }
      const kind = item.contentType === "project" ? "项目" : "文章";
      const publish = publishValue(item) === "published" ? "已发布" : "草稿";
      const meta = item.contentType === "project" ? item.status || "项目" : item.category || "文章";
      const cover = fallbackCover(item);
      return `
        <article class="featured-slot is-filled" data-slot="${order}">
          <div class="featured-slot-head">
            <span>${featuredSlotLabel(order)}</span>
            <small>${kind} · ${escapeHtml(publish)}</small>
          </div>
          <img src="${adminSrc(cover)}" alt="${escapeHtml(item.title || "未命名内容")}封面" />
          <strong>${escapeHtml(item.title || "未命名内容")}</strong>
          <small>${escapeHtml(meta)}</small>
          <div class="featured-slot-actions">
            <button class="button secondary" data-action="edit-featured" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
            <button class="button secondary" data-action="replace-featured-slot" data-slot="${order}" data-type="${item.contentType}" data-id="${item.id}" type="button" ${canAssignCurrent ? "" : "disabled"}>替换</button>
            <button class="button secondary danger" data-action="clear-featured-slot" data-type="${item.contentType}" data-id="${item.id}" type="button">取消</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function currentSiteLayout() {
    const saved = serverContent.siteLayout || {};
    return Object.fromEntries(
      defaultLayoutPages.map((page) => {
        const savedRows = Array.isArray(saved[page.key]) ? saved[page.key] : [];
        const savedMap = new Map(savedRows.map((item) => [item.key, item]));
        return [
          page.key,
          page.sections.map((base) => {
            const item = savedMap.get(base.key) || {};
            return {
              ...base,
              order: Number(item.order || base.order),
              visible: item.visible !== false,
              size: layoutSizeValue(item.size || base.size),
              preview: base.preview || item.preview || "block"
            };
          })
        ];
      })
    );
  }

  function renderLayoutPanel() {
    if (!layoutPanel) return;
    const layout = currentSiteLayout();
    layoutPanel.innerHTML = `
      ${defaultLayoutPages
        .map((page) => {
          const sections = sortedLayoutSections(layout[page.key] || []);
          return `
            <section class="layout-page-group" data-layout-page-group="${page.key}">
              <div class="layout-page-head">
                <h3>${escapeHtml(page.label)}</h3>
                <span>拖动模块调整位置，点右下角调整大小</span>
              </div>
              <div class="layout-page-frame">
                <div class="layout-browser-bar"><span></span><span></span><span></span><strong>${escapeHtml(page.label)}</strong></div>
                <div class="layout-page-board" data-layout-page-board="${page.key}" aria-label="${escapeHtml(page.label)} 页面快照">
                ${sections
                  .map(
                    (section, index) => `
                      <article class="layout-snapshot-tile layout-preview-${escapeHtml(section.preview || "block")} size-${layoutSizeValue(section.size)} ${section.visible === false ? "is-hidden" : ""}" draggable="true" data-layout-page="${page.key}" data-layout-key="${section.key}" tabindex="0">
                        <div class="layout-tile-meta">
                          <span>${index + 1}</span>
                          <small>${section.visible === false ? "已隐藏" : layoutSizeLabel(section.size)}</small>
                        </div>
                        <strong>${escapeHtml(section.label)}</strong>
                        <button class="layout-resize-handle" data-layout-resize type="button" title="切换模块大小" aria-label="调整 ${escapeHtml(section.label)} 大小"></button>
                      </article>
                    `
                  )
                  .join("")}
                </div>
              </div>
              <div class="layout-page-fields">
                ${sections
                  .map(
                    (section) => `
                      <article class="layout-row" data-layout-page="${page.key}" data-layout-key="${section.key}">
                        <div>
                          <strong>${escapeHtml(section.label)}</strong>
                          <p>${escapeHtml(section.description || "")}</p>
                        </div>
                        <div class="layout-row-controls">
                          <label>
                            显示顺序
                            <input name="layoutOrder" type="number" min="1" max="99" step="1" value="${Number(section.order || 1)}" />
                          </label>
                          <label>
                            模块大小
                            <select name="layoutSize">
                              <option value="compact" ${layoutSizeValue(section.size) === "compact" ? "selected" : ""}>紧凑</option>
                              <option value="standard" ${layoutSizeValue(section.size) === "standard" ? "selected" : ""}>标准</option>
                              <option value="wide" ${layoutSizeValue(section.size) === "wide" ? "selected" : ""}>宽版</option>
                              <option value="hero" ${layoutSizeValue(section.size) === "hero" ? "selected" : ""}>大块</option>
                            </select>
                          </label>
                          <div class="layout-move-buttons" aria-label="调整 ${escapeHtml(section.label)} 顺序">
                            <button class="button secondary" data-layout-move="-1" type="button" title="向前移动">↑</button>
                            <button class="button secondary" data-layout-move="1" type="button" title="向后移动">↓</button>
                          </div>
                          <label class="checkbox-field">
                            <input name="layoutVisible" type="checkbox" ${section.visible !== false ? "checked" : ""} />
                            显示
                          </label>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")}
      <div class="layout-actions">
        <button class="button secondary" id="layoutResetButton" type="button">恢复默认排布</button>
        <button class="button primary" id="layoutSaveButton" type="button">保存排布</button>
      </div>
    `;
  }

  function readLayoutPanel() {
    const rows = [...layoutPanel.querySelectorAll(".layout-row[data-layout-key]")];
    return rows.reduce((result, row) => {
      const page = row.dataset.layoutPage || "home";
      if (!result[page]) result[page] = [];
      result[page].push({
        key: row.dataset.layoutKey,
        order: layoutOrderValue(row.querySelector("[name='layoutOrder']").value),
        visible: row.querySelector("[name='layoutVisible']").checked,
        size: layoutSizeValue(row.querySelector("[name='layoutSize']").value)
      });
      return result;
    }, {});
  }

  function writeLayoutPanel(layout) {
    Object.entries(layout).forEach(([, rows]) => {
      sortedLayoutSections(rows).forEach((row, index) => {
        row.order = index + 1;
      });
    });
    serverContent.siteLayout = layout;
    renderLayoutPanel();
  }

  function moveLayoutSection(pageKey, sectionKey, direction) {
    const layout = readLayoutPanel();
    const rows = sortedLayoutSections(layout[pageKey] || []);
    const from = rows.findIndex((row) => row.key === sectionKey);
    const to = from + Number(direction);
    if (from < 0 || to < 0 || to >= rows.length) return;
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    layout[pageKey] = rows;
    writeLayoutPanel(layout);
  }

  function reorderLayoutSection(pageKey, sectionKey, targetKey) {
    if (!pageKey || !sectionKey || !targetKey || sectionKey === targetKey) return;
    const layout = readLayoutPanel();
    const rows = sortedLayoutSections(layout[pageKey] || []);
    const from = rows.findIndex((row) => row.key === sectionKey);
    const to = rows.findIndex((row) => row.key === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    layout[pageKey] = rows;
    writeLayoutPanel(layout);
  }

  function resizeLayoutSection(pageKey, sectionKey) {
    const layout = readLayoutPanel();
    const rows = layout[pageKey] || [];
    const row = rows.find((item) => item.key === sectionKey);
    if (!row) return;
    row.size = layoutNextSize(row.size);
    writeLayoutPanel(layout);
  }

  async function saveLayoutPanel(button) {
    if (!layoutPanel) return;
    await withBusy(button, "保存中...", async () => {
      const result = await request("/api/admin/site-layout", {
        method: "POST",
        body: JSON.stringify({ siteLayout: readLayoutPanel() })
      });
      serverContent.siteLayout = result.siteLayout;
      renderLayoutPanel();
      setNotice("游客端页面排布已保存，已打开的访客页面会自动同步新顺序。", "success");
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
          const meta = item.contentType === "project" ? `${item.status || ""} / ${item.license || ""}` : `${item.category || ""} / ${item.readTime || ""}`;
          const tags = item.tags ? ` / ${item.tags}` : "";
          const deleted = Boolean(item.deletedAt);
          const slot = item.featured ? ` / 轮播${featuredSlotLabel(item.featuredOrder)}` : "";
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
                <p>${escapeHtml(meta)}${escapeHtml(tags)} / ${escapeHtml(item.date || "暂无日期")}${escapeHtml(slot)}</p>
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
    renderRecentContent();
    renderFeaturedSlots();
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
    contentForm.featuredOrder.value = String(featuredOrderValue(snapshot.featuredOrder || 0));
    contentForm.recommendationPriority.value = String(recommendationPriorityValue(snapshot.recommendationPriority || 100));
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
    updateVisibilityHint();
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
        featuredOrder: featuredOrderValue(item.featuredOrder || 0),
        recommendationPriority: recommendationPriorityValue(item.recommendationPriority || 100),
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
      featuredOrder: featuredOrderValue(data.get("featuredOrder") || 0),
      recommendationPriority: recommendationPriorityValue(data.get("recommendationPriority") || 100)
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

  function validateFeaturedPayload(payload) {
    if (!payload.featured) return;
    const order = featuredOrderValue(payload.featuredOrder);
    const sameItem = (item) => item.contentType === payload.type && item.id === payload.id;
    const existing = featuredItems().filter((item) => !sameItem(item));
    if (existing.length >= featuredLimit) {
      throw new Error("首页轮播最多只能设置 4 个内容，请先取消一个已有轮播项");
    }
    const conflict = existing.find((item) => featuredOrderValue(item.featuredOrder) === order);
    if (conflict) {
      throw new Error(`首页轮播${featuredSlotLabel(order)}已被《${conflict.title || "未命名内容"}》使用，请选择空着的位置`);
    }
  }

  async function saveItemFeatured(item, featured, order = item.featuredOrder) {
    if (item.contentType === "post") {
      const payload = { ...item, type: "post", featured: Boolean(featured), featuredOrder: featuredOrderValue(order) };
      const result = await request("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      serverContent = { ...serverContent, posts: result.posts };
      return;
    }

    const payload = { ...item, type: "project", featured: Boolean(featured), featuredOrder: featuredOrderValue(order) };
    const result = await request("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    serverContent = { ...serverContent, projects: result.projects };
  }

  function assignCurrentToFeaturedSlot(order) {
    contentForm.featured.checked = true;
    contentForm.featuredOrder.value = String(featuredOrderValue(order));
    updateVisibilityHint();
    markDirty();
    renderFeaturedSlots();
    setNotice(`已把当前编辑内容安排到首页轮播${featuredSlotLabel(order)}，保存后生效。`, "warning");
  }

  async function replaceFeaturedSlot(order, occupiedItem) {
    const current = currentSnapshot();
    if (!snapshotHasContent(current)) {
      setNotice("请先在编辑器中填写要替换到轮播的内容。", "warning");
      return;
    }
    const currentName = current.title.trim() || "当前编辑内容";
    const occupiedName = occupiedItem.title || "未命名内容";
    if (!window.confirm(`确认用《${currentName}》替换首页轮播${featuredSlotLabel(order)}的《${occupiedName}》吗？旧内容会先取消首页轮播，当前内容仍需点击保存。`)) return;
    await saveItemFeatured(occupiedItem, false, occupiedItem.featuredOrder);
    assignCurrentToFeaturedSlot(order);
    renderList();
    renderRecentContent();
    renderFeaturedSlots();
    setNotice(`首页轮播${featuredSlotLabel(order)}已腾出。请保存《${currentName}》完成替换。`, "warning");
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
      renderList(); renderRecentContent();
      setNotice(`批量操作完成：${items.length} 项。`, "success");
    });
    updateBulkState();
  }
  function currentAdminView() {
    const view = (window.location.hash || "#editor").replace("#", "");
    return ["editor", "library", "carousel", "layout", "health"].includes(view) ? view : "editor";
  }

  function setAdminView(view = currentAdminView()) {
    adminViews.forEach((section) => {
      section.hidden = section.dataset.adminView !== view;
    });
    adminNavLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.adminNav === view);
    });
    if (view === "health") loadHealth().catch(() => renderHealth(null));
    if (view === "editor") renderRecentContent();
    if (view === "carousel") renderFeaturedSlots();
    if (view === "layout") renderLayoutPanel();
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
        renderList(); renderRecentContent();
        setAdminView();
        restoreDraftIfNeeded();
      } catch (error) {
        loginNotice.textContent = error.message;
      }
    });
  });

  loginForm.password.addEventListener("focus", updatePasswordActive);
  loginForm.password.addEventListener("blur", updatePasswordActive);
  loginForm.password.addEventListener("input", updatePasswordActive);

  passwordToggle.addEventListener("click", () => {
    setPasswordVisible(loginForm.password.type === "password");
    loginForm.password.focus();
    updatePasswordActive();
  });

  sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(!dashboard.classList.contains("is-sidebar-collapsed"));
  });

  editorDockToggle.addEventListener("click", () => {
    setEditorDockCollapsed(!editorDock.classList.contains("is-collapsed"));
  });

  editorDockHandle.addEventListener("click", () => {
    setEditorDockCollapsed(!editorDock.classList.contains("is-collapsed"));
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
        link.download = `larkixmaker-content-${data.site?.versionLabel || "export"}.json`;
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
    renderList(); renderRecentContent();
  });

  typeFilter.addEventListener("change", () => {
    filters.type = typeFilter.value;
    renderList(); renderRecentContent();
  });

  statusFilter.addEventListener("change", () => {
    filters.status = statusFilter.value;
    renderList(); renderRecentContent();
  });

  clearFiltersButton.addEventListener("click", () => {
    filters.search = "";
    filters.type = "all";
    filters.status = "all";
    contentSearch.value = "";
    typeFilter.value = "all";
    statusFilter.value = "all";
    renderList(); renderRecentContent();
  });

  selectAllContent.addEventListener("change", () => {
    const items = filteredItems();
    if (selectAllContent.checked) {
      items.forEach((item) => selectedContent.add(itemKey(item)));
    } else {
      items.forEach((item) => selectedContent.delete(itemKey(item)));
    }
    renderList(); renderRecentContent();
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

  recentContentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='edit']");
    if (!button) return;
    const item = combinedItems().find((entry) => entry.contentType === button.dataset.type && entry.id === button.dataset.id);
    if (item) applyItemToForm(button.dataset.type, item);
  });

  featuredSlots?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const item = combinedItems().find((entry) => entry.contentType === button.dataset.type && entry.id === button.dataset.id);
    if (action === "edit-featured" && item) {
      applyItemToForm(button.dataset.type, item);
      return;
    }
    if (action === "assign-featured-slot") {
      assignCurrentToFeaturedSlot(button.dataset.slot);
      return;
    }
    if (action === "replace-featured-slot" && item) {
      withBusy(button, "替换中...", () => replaceFeaturedSlot(button.dataset.slot, item)).catch((error) => setNotice(error.message, "error"));
      return;
    }
    if (action === "clear-featured-slot" && item) {
      if (!window.confirm(`确认将《${item.title || "未命名内容"}》移出首页轮播吗？`)) return;
      withBusy(button, "取消中...", async () => {
        await saveItemFeatured(item, false, item.featuredOrder);
        renderList();
        renderRecentContent();
        renderFeaturedSlots();
        setNotice("已取消该位置的首页轮播。", "success");
      }).catch((error) => setNotice(error.message, "error"));
    }
  });

  layoutPanel?.addEventListener("click", (event) => {
    const resizeButton = event.target.closest("[data-layout-resize]");
    if (resizeButton) {
      event.preventDefault();
      const tile = resizeButton.closest(".layout-snapshot-tile");
      resizeLayoutSection(tile?.dataset.layoutPage, tile?.dataset.layoutKey);
      setNotice("模块大小已调整，点击保存后写入网站状态。", "warning");
      return;
    }
    const moveButton = event.target.closest("[data-layout-move]");
    if (moveButton) {
      const row = moveButton.closest("[data-layout-page][data-layout-key]");
      moveLayoutSection(row?.dataset.layoutPage, row?.dataset.layoutKey, Number(moveButton.dataset.layoutMove));
      setNotice("排布顺序已调整，点击保存后写入网站状态。", "warning");
      return;
    }
    const saveButton = event.target.closest("#layoutSaveButton");
    if (saveButton) {
      saveLayoutPanel(saveButton).catch((error) => setNotice(error.message, "error"));
      return;
    }
    const resetButton = event.target.closest("#layoutResetButton");
    if (resetButton) {
      serverContent.siteLayout = Object.fromEntries(defaultLayoutPages.map((page) => [page.key, page.sections.map((item) => ({ ...item }))]));
      renderLayoutPanel();
      setNotice("已恢复默认排布，保存后会写入网站状态。", "info");
    }
  });

  layoutPanel?.addEventListener("change", (event) => {
    if (!event.target.matches("[name='layoutOrder'], [name='layoutVisible'], [name='layoutSize']")) return;
    const layout = readLayoutPanel();
    Object.entries(layout).forEach(([pageKey, rows]) => {
      layout[pageKey] = sortedLayoutSections(rows).map((row, index) => ({ ...row, order: index + 1 }));
    });
    serverContent.siteLayout = layout;
    renderLayoutPanel();
    setNotice("页面快照已更新，点击保存后写入网站状态。", "warning");
  });

  layoutPanel?.addEventListener("dragstart", (event) => {
    if (event.target.closest("[data-layout-resize]")) {
      event.preventDefault();
      return;
    }
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile) return;
    layoutDragState = { page: tile.dataset.layoutPage, key: tile.dataset.layoutKey };
    tile.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${layoutDragState.page}:${layoutDragState.key}`);
  });

  layoutPanel?.addEventListener("dragover", (event) => {
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile || !layoutDragState || tile.dataset.layoutPage !== layoutDragState.page) return;
    event.preventDefault();
    tile.classList.add("is-drag-over");
  });

  layoutPanel?.addEventListener("dragleave", (event) => {
    event.target.closest(".layout-snapshot-tile")?.classList.remove("is-drag-over");
  });

  layoutPanel?.addEventListener("drop", (event) => {
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile || !layoutDragState || tile.dataset.layoutPage !== layoutDragState.page) return;
    event.preventDefault();
    reorderLayoutSection(layoutDragState.page, layoutDragState.key, tile.dataset.layoutKey);
    layoutDragState = null;
    setNotice("快照顺序已调整，点击保存后写入网站状态。", "warning");
  });

  layoutPanel?.addEventListener("dragend", () => {
    layoutDragState = null;
    layoutPanel.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => item.classList.remove("is-dragging", "is-drag-over"));
  });

  window.addEventListener("hashchange", () => setAdminView());

  contentForm.addEventListener("input", () => {
    markDirty();
    updatePreview();
    updateVisibilityHint();
    renderFeaturedSlots();
  });

  contentForm.addEventListener("change", (event) => {
    if (event.target.name === "type") updateTypeFields();
    if (event.target.name === "featuredOrder") {
      event.target.value = String(featuredOrderValue(event.target.value));
    }
    if (event.target.name === "recommendationPriority") {
      event.target.value = String(recommendationPriorityValue(event.target.value));
    }
    markDirty();
    updateVisibilityHint();
    renderFeaturedSlots();
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
    if (markdownHint) markdownHint.textContent = `已导入：${file.name}`;
    updatePreview();
    markDirty();
  });

  coverFile.addEventListener("change", () => {
    const file = coverFile.files[0];
    if (!file) return;
    withBusy(coverFile, "", async () => {
      try {
        coverHint.textContent = `准备裁剪封面：${file.name}`;
        await openCoverCrop(file);
      } catch (error) {
        coverHint.textContent = error.message;
        setNotice(error.message, "error");
      }
    });
  });

  [coverCropZoom, coverCropX, coverCropY].forEach((input) => {
    input?.addEventListener("input", drawCoverCrop);
  });

  coverCropCancel?.addEventListener("click", closeCoverCrop);

  coverCropModal?.addEventListener("click", (event) => {
    if (event.target === coverCropModal) closeCoverCrop();
  });

  coverCropApply?.addEventListener("click", () => {
    withBusy(coverCropApply, "上传中...", uploadCroppedCover).catch((error) => {
      setNotice(error.message, "error");
    });
  });

  contentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = contentForm.querySelector("button[type='submit']");
    withBusy(submitButton, "保存中...", async () => {
      try {
        saveDraft();
        const { endpoint, collectionKey, payload } = buildPayload();
        validateFeaturedPayload(payload);
        const result = await request(endpoint, { method: "POST", body: JSON.stringify(payload) });
        serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
        clearDraft();
        resetForm();
        renderList(); renderRecentContent(); renderFeaturedSlots();
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
        renderList(); renderRecentContent();
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
    setSidebarCollapsed(storedBool(sidebarStateKey));
    setEditorDockCollapsed(storedBool(editorDockStateKey));
    setPasswordVisible(false);
    updatePasswordActive();
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
    renderList(); renderRecentContent();
    setAdminView();
  })();
})();
