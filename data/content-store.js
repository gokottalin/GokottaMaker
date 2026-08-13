(function () {
  const publicContentRefreshMs = 5000;
  let publicContentRequest = null;
  let publicContentRequestSequence = 0;
  let publicContentAppliedSequence = 0;
  let publicContentLastAttempt = 0;
  let publicContentSignature = JSON.stringify(window.LARKIX_SERVER_CONTENT || {});

  function focusMode() {
    const value = window.LARKIX_SERVER_CONTENT?.publicFocusMode;
    return value && typeof value === "object" ? { enabled: true, ...value } : { enabled: true };
  }

  function focusModeEnabled() {
    return focusMode().enabled === true;
  }

  function getPosts() {
    return Array.isArray(window.LARKIX_SERVER_CONTENT?.posts) ? window.LARKIX_SERVER_CONTENT.posts : [];
  }

  function getProjects() {
    return Array.isArray(window.LARKIX_SERVER_CONTENT?.projects) ? window.LARKIX_SERVER_CONTENT.projects : [];
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
    return Array.isArray(window.LARKIX_SERVER_CONTENT?.projectDirectory)
      ? window.LARKIX_SERVER_CONTENT.projectDirectory.map(sanitizeProjectPreview)
      : [];
  }

  function getHeroCarousel() {
    const slots = window.LARKIX_SERVER_CONTENT?.heroCarousel;
    if (!Array.isArray(slots)) return [];
    return slots
      .slice()
      .sort((a, b) => Number(a.slot ?? a.featuredOrder ?? 0) - Number(b.slot ?? b.featuredOrder ?? 0))
      .slice(0, 4);
  }

  function applyPublicContent(payload, sequence) {
    if (!payload || typeof payload !== "object" || sequence < publicContentAppliedSequence) return false;
    publicContentAppliedSequence = sequence;
    const nextSignature = JSON.stringify(payload);
    if (nextSignature === publicContentSignature) return false;
    publicContentSignature = nextSignature;
    window.LARKIX_SERVER_CONTENT = payload;
    window.dispatchEvent(
      new CustomEvent("larkix:public-content-updated", {
        detail: { sequence, signature: nextSignature }
      })
    );
    return true;
  }

  async function revalidatePublicContent(options = {}) {
    if (!window.fetch) return false;
    if (publicContentRequest) return publicContentRequest;
    const now = Date.now();
    if (!options.force && now - publicContentLastAttempt < publicContentRefreshMs) return false;
    publicContentLastAttempt = now;
    const sequence = ++publicContentRequestSequence;
    publicContentRequest = window.fetch("./api/content", {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => applyPublicContent(payload, sequence))
      .catch(() => false)
      .finally(() => {
        publicContentRequest = null;
      });
    return publicContentRequest;
  }

  function startPublicContentRevalidation() {
    revalidatePublicContent({ force: true });
    window.setInterval(() => {
      if (document.visibilityState === "visible") revalidatePublicContent({ force: true });
    }, publicContentRefreshMs);
    window.addEventListener("focus", () => revalidatePublicContent({ force: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") revalidatePublicContent({ force: true });
    });
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
      { href: "./projects.html", label: "开源项目" },
      { href: "./miniapps.html", label: "MD2File" }
    ];
    document.querySelectorAll(".site-header .main-nav").forEach((nav) => {
      nav.classList.add("focus-mode-nav");
      nav.innerHTML = links
        .map((link) => `<a href="${link.href}"${isCurrentHref(link.href) ? ' aria-current="page"' : ""}>${link.label}</a>`)
        .join("");
    });
  }

  window.LarkixContent = {
    getPosts,
    getProjects,
    getProjectDirectory,
    getHeroCarousel,
    revalidatePublicContent
  };

  window.addEventListener("DOMContentLoaded", applyFocusedNavigation);
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startPublicContentRevalidation, { once: true });
  } else {
    startPublicContentRevalidation();
  }
})();
