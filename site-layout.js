(function () {
  const pageKey = document.body.dataset.layoutPage;
  const container = document.querySelector("[data-layout-container]") || document.querySelector("#mainContent");
  let siteLayout = window.LARKIX_SERVER_CONTENT?.siteLayout || {};
  let layoutSignature = JSON.stringify(siteLayout);
  const focusFallback = {
    enabled: true,
    hideMiniappsFromPrimaryNav: true,
    hideAdminFromPublicNav: true
  };

  function publicFocusMode() {
    const value = window.LARKIX_SERVER_CONTENT?.publicFocusMode;
    if (!value || typeof value !== "object") return focusFallback;
    return { ...focusFallback, ...value };
  }

  function focusModeEnabled() {
    return publicFocusMode().enabled !== false;
  }

  function isCurrentHref(href) {
    const target = new URL(href, location.href);
    return target.pathname === location.pathname && target.search === location.search;
  }

  function applyFocusedNavigation() {
    if (!focusModeEnabled()) return;
    document.body.classList.add("public-focus-mode");
    document.querySelectorAll(".site-header .main-nav").forEach((nav) => {
      nav.classList.add("focus-mode-nav");
      const links = [
        { href: "./maker.html", label: "首页" },
        { href: "./category.html?category=power-electronics", label: "电力电子" },
        { href: "./derive.html", label: "公式推导" }
      ];
      nav.innerHTML = links
        .map((link) => `<a href="${link.href}"${isCurrentHref(link.href) ? ' aria-current="page"' : ""}>${link.label}</a>`)
        .join("");
    });
    if (publicFocusMode().hideAdminFromPublicNav) {
      document.querySelectorAll('.site-header .admin-link[href="./admin/index.html"], .site-header .admin-link[href$="/admin/index.html"]').forEach((link) => {
        link.hidden = true;
      });
    }
  }

  function applyPowerElectronicsPlaceholder() {
    if (!focusModeEnabled()) return;
    if (new URLSearchParams(location.search).get("category") !== "power-electronics") return;
    document.body.dataset.pageTheme = "analog";
    document.title = "电力电子 | LarkixMaker";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "围绕电力电子、开关电源和公式推导节点整理的 LarkixMaker 聚焦入口。");
    const titleNode = document.querySelector("#categoryTitle");
    const titleEnNode = document.querySelector("#categoryTitleEn");
    const summaryNode = document.querySelector("#categorySummary");
    const featureNode = document.querySelector("#categoryFeature");
    const listNode = document.querySelector("#categoryList");
    const syllabusNode = document.querySelector("#syllabusRail");
    const panelNode = document.querySelector("#resourcePanel");
    const searchLabelNode = document.querySelector(".category-search-box span");
    const searchNode = document.querySelector("#categorySearch");
    if (titleNode) titleNode.textContent = "电力电子";
    if (titleEnNode) titleEnNode.textContent = "Power Electronics";
    if (summaryNode) summaryNode.textContent = "从开关电源变量、公式推导和工程验证进入，当前先开放聚焦入口与公开推导节点。";
    if (searchLabelNode) searchLabelNode.textContent = "搜索电力电子";
    if (searchNode) {
      searchNode.placeholder = "搜索 Boost、Buck、占空比、纹波...";
      searchNode.value = "";
      searchNode.disabled = true;
    }
    if (featureNode) {
      featureNode.hidden = false;
      featureNode.innerHTML = `
        <div class="lesson-feature-copy">
          <div class="lesson-row-meta">
            <span class="category-pill">Power Electronics</span>
            <span>Focused Track</span>
          </div>
          <h2><a href="./derive.html">公式变量推导</a></h2>
          <p>围绕 Boost、Buck、占空比、电感纹波和开关频率等变量逐步补齐公开推导节点。</p>
          <div class="card-footer"><span>推导节点</span><a class="card-link" href="./derive.html">进入公式推导</a></div>
        </div>
        <a class="lesson-feature-media" href="./derive.html">${window.LarkixMedia.image("./assets/covers/analog-cover.png", "电力电子推导入口", { loading: "lazy", sizes: "(max-width: 760px) 100vw, 360px" })}</a>
      `;
    }
    if (listNode) {
      listNode.innerHTML = `
        <section class="empty-state empty-state-rich">
          <div class="empty-state-copy">
            <strong>电力电子课程正文正在接入中</strong>
            <p>当前先从公式推导节点和开关电源变量入口开始，旧分类内容仍保留在原路径中。</p>
            <div class="empty-state-actions">
              <a class="button primary" href="./derive.html">查看推导节点</a>
              <a class="button secondary" href="./maker.html">返回首页</a>
            </div>
          </div>
        </section>
      `;
    }
    if (syllabusNode) {
      syllabusNode.innerHTML = `
        <h2>聚焦路径</h2>
        <p>Power Electronics</p>
        <div class="syllabus-list">
          <a class="syllabus-chip is-active" href="./derive.html"><b>01</b>公式推导</a>
          <span class="syllabus-chip"><b>02</b>基础变换器</span>
          <span class="syllabus-chip"><b>03</b>工程验证</span>
        </div>
        <div class="syllabus-hint">当前先开放公式推导入口，后续会继续补齐课程正文与工程验证内容。</div>
      `;
    }
    if (panelNode) {
      panelNode.innerHTML = `
        <h2>推导入口</h2>
        <p>已发布的推导节点会在公式推导页集中呈现。</p>
        <div class="resource-link-list">
          <a href="./derive.html">公式推导节点</a>
          <a href="./maker.html">LarkixMaker 首页</a>
        </div>
      `;
    }
  }

  function rowsForPage() {
    return Array.isArray(siteLayout[pageKey]) ? siteLayout[pageKey] : [];
  }

  function applyLayout() {
    if (!pageKey || !container) return;
    const sections = [...container.children].filter((section) => section.dataset.layoutSection);
    if (!sections.length) return;
    const orderMap = new Map(rowsForPage().map((item) => [item.key, item]));
    sections
      .sort((a, b) => {
        const left = Number(orderMap.get(a.dataset.layoutSection)?.order ?? 99);
        const right = Number(orderMap.get(b.dataset.layoutSection)?.order ?? 99);
        return left - right;
      })
      .forEach((section) => {
        const config = orderMap.get(section.dataset.layoutSection);
        section.hidden = config?.visible === false;
        section.dataset.layoutSize = config?.size || "standard";
        container.appendChild(section);
      });
  }

  function startPolling() {
    if (!window.LARKIX_SERVER_CONTENT || !window.fetch) return;
    window.setInterval(async () => {
      try {
        const response = await fetch("./api/content", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const nextLayout = payload.siteLayout || {};
        const nextSignature = JSON.stringify(nextLayout);
        if (nextSignature === layoutSignature) return;
        siteLayout = nextLayout;
        layoutSignature = nextSignature;
        applyLayout();
      } catch {
        return;
      }
    }, 3000);
  }

  window.LarkixSiteLayout = { apply: applyLayout, applyFocusedNavigation };
  applyFocusedNavigation();
  applyPowerElectronicsPlaceholder();
  applyLayout();
  startPolling();
})();
