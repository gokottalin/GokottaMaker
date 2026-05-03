(function () {
  const savedLoginKey = "gokottamaker_admin_saved_login";

  const loginPanel = document.querySelector("#loginPanel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#loginForm");
  const loginNotice = document.querySelector("#loginNotice");
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

  let editingType = null;
  let editingId = null;
  let currentCover = "";
  let serverContent = { posts: [], projects: [] };

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "请求失败");
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

  function updateTypeFields() {
    const type = getType();
    categoryField.hidden = type === "project";
    statusField.hidden = type !== "project";
    projectExtra.hidden = type !== "project";
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(contentForm.markdown.value);
  }

  function setCover(cover, label) {
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
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("图片读取失败")));
      reader.readAsDataURL(file);
    });
  }

  function resetForm() {
    editingType = null;
    editingId = null;
    contentForm.reset();
    contentForm.type.value = "post";
    contentForm.publishStatus.value = "draft";
    contentForm.featuredOrder.value = "0";
    setCover("");
    updateTypeFields();
    updatePreview();
  }

  function combinedItems() {
    return [
      ...serverContent.posts.map((item) => ({ ...item, contentType: "post" })),
      ...serverContent.projects.map((item) => ({ ...item, contentType: "project" }))
    ];
  }

  function renderList() {
    const items = combinedItems();
    list.innerHTML =
      items
        .map((item) => {
          const kind = item.contentType === "project" ? "项目" : "文章";
          const publish = item.contentType === "project" ? item.visibilityStatus : item.publishStatus;
          const meta = item.contentType === "project" ? `${item.status} / ${item.license || ""}` : `${item.category} / ${item.readTime || ""}`;
          const tags = item.tags ? ` / ${item.tags}` : "";
          const deleted = Boolean(item.deletedAt);
          return `
            <article class="admin-row ${deleted ? "is-deleted" : ""}">
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
        .join("") || `<div class="empty-state">当前还没有内容。</div>`;
  }

  function renderImageLibrary(images = []) {
    imageLibrary.innerHTML =
      images
        .map(
          (image) => `
            <button class="image-choice" type="button" data-cover="${image.url}">
              <img src="${adminSrc(image.url)}" alt="${escapeHtml(image.name)}" />
              <span>${escapeHtml(image.name)}</span>
            </button>
          `
        )
        .join("") || `<div class="empty-state">还没有上传图片。</div>`;
  }

  async function loadImages() {
    const result = await request("/api/uploads");
    renderImageLibrary(result.uploads || []);
  }

  function applyItemToForm(type, item) {
    editingType = type;
    editingId = item.id;
    contentForm.type.value = type;
    contentForm.title.value = item.title || "";
    contentForm.excerpt.value = item.excerpt || item.summary || "";
    contentForm.tags.value = item.tags || "";
    contentForm.markdown.value = item.markdown || "";
    contentForm.publishStatus.value = type === "post" ? item.publishStatus || "draft" : item.visibilityStatus || "draft";
    contentForm.featured.checked = Boolean(item.featured);
    contentForm.featuredOrder.value = item.featuredOrder || 0;
    if (type === "post") {
      contentForm.category.value = item.category || "模拟电子";
    } else {
      contentForm.statusKey.value = item.statusKey || "planned";
      contentForm.version.value = item.version || "";
      contentForm.progress.value = item.progress || 0;
      contentForm.repoUrl.value = item.repoUrl || "";
      contentForm.bomUrl.value = item.bomUrl || "";
      contentForm.docsUrl.value = item.docsUrl || "";
    }
    setCover(item.cover, "当前封面，可重新从资源管理器或图片库选择");
    updateTypeFields();
    updatePreview();
    window.location.hash = "editor";
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const username = data.get("username");
    const password = data.get("password");
    (async () => {
      try {
        await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
        await loadServerContent();
        await loadImages();
        loginNotice.textContent = "";
        saveLogin(username);
        setLoggedIn(true);
        renderList();
      } catch (error) {
        loginNotice.textContent = error.message;
      }
    })();
  });

  logoutButton.addEventListener("click", () => {
    (async () => {
      await request("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
      setLoggedIn(false);
    })();
  });

  exportButton.addEventListener("click", () => {
    (async () => {
      const data = await request("/api/admin/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gokottamaker-content-${data.site?.versionLabel || "export"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    })().catch((error) => {
      loginNotice.textContent = error.message;
    });
  });

  resetButton.addEventListener("click", resetForm);
  refreshImagesButton.addEventListener("click", () => loadImages().catch((error) => (loginNotice.textContent = error.message)));
  contentForm.markdown.addEventListener("input", updatePreview);
  contentForm.addEventListener("change", (event) => {
    if (event.target.name === "type") updateTypeFields();
  });

  imageLibrary.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cover]");
    if (!button) return;
    setCover(button.dataset.cover, "已从图片库选择封面");
  });

  markdownFile.addEventListener("change", async () => {
    const file = markdownFile.files[0];
    if (!file) return;
    contentForm.markdown.value = await file.text();
    if (!contentForm.title.value) contentForm.title.value = file.name.replace(/\.md$/i, "");
    updatePreview();
  });

  coverFile.addEventListener("change", () => {
    const file = coverFile.files[0];
    if (!file) return;
    (async () => {
      try {
        coverHint.textContent = "正在上传封面...";
        const dataUrl = await readFileAsDataUrl(file);
        const result = await request("/api/uploads", {
          method: "POST",
          body: JSON.stringify({ filename: file.name, dataUrl })
        });
        setCover(result.url, `${file.name} 已上传`);
        renderImageLibrary(result.uploads || []);
      } catch (error) {
        coverHint.textContent = error.message;
      }
    })();
  });

  contentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contentForm);
    const type = data.get("type");
    const now = new Date().toISOString().slice(0, 10);
    const base = {
      id: editingId || `${type}-${Date.now()}`,
      slug: editingId || `${type}-${Date.now()}`,
      type,
      title: data.get("title"),
      cover: currentCover || (type === "post" ? "./assets/covers/analog-cover.png" : "./assets/covers/project-cover.png"),
      markdown: data.get("markdown"),
      tags: data.get("tags"),
      date: now,
      featured: data.get("featured") === "on",
      featuredOrder: Number(data.get("featuredOrder") || 0)
    };

    (async () => {
      try {
        if (type === "post") {
          const category = data.get("category");
          const post = {
            ...base,
            category,
            categoryKey: categoryKey(category),
            publishStatus: data.get("publishStatus"),
            readTime: "10 分钟阅读",
            excerpt: data.get("excerpt")
          };
          const result = await request("/api/posts", { method: "POST", body: JSON.stringify(post) });
          serverContent = { ...serverContent, posts: result.posts };
        } else {
          const statusKey = data.get("statusKey");
          const project = {
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
          };
          const result = await request("/api/projects", { method: "POST", body: JSON.stringify(project) });
          serverContent = { ...serverContent, projects: result.projects };
        }
        resetForm();
        renderList();
        loginNotice.textContent = "保存成功";
      } catch (error) {
        loginNotice.textContent = error.message;
      }
    })();
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const type = button.dataset.type;
    const id = button.dataset.id;
    const collectionKey = type === "project" ? "projects" : "posts";
    const basePath = type === "project" ? "projects" : "posts";

    (async () => {
      if (button.dataset.action === "edit") {
        const item = serverContent[collectionKey].find((entry) => entry.id === id);
        if (item) applyItemToForm(type, item);
        return;
      }
      if (button.dataset.action === "delete") {
        if (!confirm("确认移入回收站吗？访客端将不再显示。")) return;
        const result = await request(`/api/${basePath}/${encodeURIComponent(id)}`, { method: "DELETE" });
        serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
      }
      if (button.dataset.action === "restore") {
        const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" });
        serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
      }
      if (button.dataset.action === "hard-delete") {
        if (!confirm("永久删除无法从回收站恢复，确认继续吗？")) return;
        const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/hard`, { method: "DELETE" });
        serverContent = { ...serverContent, [collectionKey]: result[collectionKey] };
      }
      renderList();
    })().catch((error) => {
      loginNotice.textContent = error.message;
    });
  });

  (async () => {
    loadSavedLogin();
    const session = await request("/api/session").catch(() => ({ user: null }));
    const loggedIn = Boolean(session.user);
    setLoggedIn(loggedIn);
    if (loggedIn) {
      await loadServerContent();
      await loadImages();
    }
    updateTypeFields();
    updatePreview();
    renderList();
  })();
})();
