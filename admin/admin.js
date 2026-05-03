(function () {
  const savedLoginKey = "gokottamaker_admin_saved_login";

  const loginPanel = document.querySelector("#loginPanel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#loginForm");
  const loginNotice = document.querySelector("#loginNotice");
  const logoutButton = document.querySelector("#logoutButton");
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
    serverContent = await request("/api/content");
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
    const escaped = escapeHtml(markdown || "");
    return (
      escaped
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^- (.*)$/gm, "<li>$1</li>")
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/^(.+)$/gm, "<p>$1</p>")
        .replace(/<p><h/g, "<h")
        .replace(/<\/h([1-3])><\/p>/g, "</h$1>")
        .replace(/<p><li>/g, "<ul><li>")
        .replace(/<\/li><\/p>/g, "</li></ul>") || "<p>Markdown 预览会显示在这里。</p>"
    );
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
          const meta = item.contentType === "project" ? `${item.status} / ${item.license || ""}` : `${item.category} / ${item.readTime || ""}`;
          return `
            <article class="admin-row">
              <img src="${adminSrc(item.cover)}" alt="${escapeHtml(item.title)}封面" />
              <div>
                <strong><span class="content-kind">${kind}</span>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(meta)} / ${escapeHtml(item.date || "暂无日期")}</p>
                <p>${escapeHtml(item.excerpt || item.summary)}</p>
              </div>
              <div class="row-actions">
                <button class="button secondary" data-action="edit" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
                <button class="button secondary" data-action="delete" data-type="${item.contentType}" data-id="${item.id}" type="button">删除</button>
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">当前还没有内容。</div>`;
  }

  function applyItemToForm(type, item) {
    editingType = type;
    editingId = item.id;
    contentForm.type.value = type;
    contentForm.title.value = item.title || "";
    contentForm.excerpt.value = item.excerpt || item.summary || "";
    contentForm.markdown.value = item.markdown || "";
    if (type === "post") {
      contentForm.category.value = item.category || "模拟电子";
    } else {
      contentForm.statusKey.value = item.statusKey || "planned";
    }
    setCover(item.cover, "当前封面，可重新从资源管理器选择");
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

  resetButton.addEventListener("click", resetForm);
  contentForm.markdown.addEventListener("input", updatePreview);
  contentForm.addEventListener("change", (event) => {
    if (event.target.name === "type") updateTypeFields();
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
      date: now
    };

    (async () => {
      try {
        if (type === "post") {
          const category = data.get("category");
          const post = {
            ...base,
            category,
            categoryKey: categoryKey(category),
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
            summary: data.get("excerpt"),
            license: "MIT License",
            stars: 0
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
    if (button.dataset.action === "delete") {
      if (!confirm("确认删除这条内容吗？当前版本会直接从数据库删除。")) return;
      (async () => {
        if (type === "project") {
          const result = await request(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
          serverContent = { ...serverContent, projects: result.projects };
        } else {
          const result = await request(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
          serverContent = { ...serverContent, posts: result.posts };
        }
        renderList();
      })().catch((error) => {
        loginNotice.textContent = error.message;
      });
      return;
    }

    const items = type === "project" ? serverContent.projects : serverContent.posts;
    const item = items.find((entry) => entry.id === id);
    if (item) applyItemToForm(type, item);
  });

  (async () => {
    loadSavedLogin();
    const session = await request("/api/session").catch(() => ({ user: null }));
    const loggedIn = Boolean(session.user);
    setLoggedIn(loggedIn);
    if (loggedIn) await loadServerContent();
    updateTypeFields();
    updatePreview();
    renderList();
  })();
})();
