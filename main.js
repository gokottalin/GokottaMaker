(function () {
  let posts = window.LarkixContent.getPosts();
  let publicProjects = window.LarkixContent.getProjects();
  let projects = window.LarkixContent.getProjectDirectory();
  const list = document.querySelector("#articleList");
  const hero = document.querySelector(".hero");
  const heroCards = document.querySelector("#heroCards");
  const projectList = document.querySelector("#projectList");
  const miniappUpdateList = document.querySelector("#miniappUpdateList");
  const coursePathList = document.querySelector("#coursePathList");
  const recentLessonFeature = document.querySelector("#recentLessonFeature");
  const search = document.querySelector("#siteSearch");
  const miniapps = Array.isArray(window.LARKIX_PUBLIC_MINIAPPS) ? window.LARKIX_PUBLIC_MINIAPPS : [];
  const courseMeta = window.LarkixCourseMeta || {};
  let siteLayout = window.LARKIX_SERVER_CONTENT?.siteLayout || {};
  let siteLayoutSignature = JSON.stringify(siteLayout);
  let featuredItems = [];
  let activeHeroIndex = 0;
  let activeBg = "A";
  let heroTimer = null;
  let heroCopyTimer = null;

  function safe(value) {
    return String(value || "");
  }

  function readingMinutesLabel(value) {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 9999 ? `${minutes} 分钟阅读` : "";
  }

  function optionalMeta(value) {
    return value ? `<span>${safe(value)}</span>` : "";
  }

  function compactViewCount(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    if (count < 10000) return String(count);
    const scaled = Math.round((count / 10000) * 10) / 10;
    return `${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}万`;
  }

  function compactDuration(value) {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1) return "";
    if (minutes < 60) return `${minutes}分`;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}时${String(minutes % 60).padStart(2, "0")}分`;
  }

  function cardViewMeta(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    return `<span class="public-card-view" title="精确浏览量：${count}" aria-label="浏览量 ${count} 次"><span aria-hidden="true">◉</span> ${compactViewCount(count)}</span>`;
  }

  function safePublicRoute(value, fallback = "./maker.html") {
    const route = String(value || "");
    if (!route || /^(?:javascript|data):/i.test(route)) return fallback;
    try {
      const target = new URL(route, location.href);
      return target.origin === location.origin ? `${target.pathname}${target.search}${target.hash}` : fallback;
    } catch {
      return fallback;
    }
  }

  function html(value) {
    if (window.LarkixMedia?.escapeHtml) return window.LarkixMedia.escapeHtml(value);
    return safe(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formulaSymbolHtml(value) {
    const source = safe(value);
    return source
      .split(/\s*\/\s*/)
      .map((part) => {
        const math = window.LarkixMarkdown?.dottedSubscriptMath?.(part) || part;
        return math === part ? html(part) : window.LarkixMarkdown.inline(`$${math}$`);
      })
      .join(" / ");
  }

  function safeToken(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizePublicFocusMode(value) {
    const fallback = {
      enabled: true,
      hideMiniappsFromPrimaryNav: false
    };
    if (!value || typeof value !== "object") return fallback;
    return { ...fallback, ...value };
  }

  let focusMode = normalizePublicFocusMode(window.LARKIX_SERVER_CONTENT?.publicFocusMode);

  function focusModeEnabled() {
    return focusMode.enabled !== false;
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
        { href: "./category.html?category=electronics-basics", label: "电子基础" },
        { href: "./derive.html", label: "公式推导" },
        { href: "./projects.html", label: "开源项目" },
        { href: "./miniapps.html", label: "MD2File" }
      ];
      nav.innerHTML = links
        .map((link) => `<a href="${link.href}"${isCurrentHref(link.href) ? ' aria-current="page"' : ""}>${link.label}</a>`)
        .join("");
    });
  }

  function focusCorpus(item) {
    return [item.categoryKey, item.category, item.title, item.excerpt, item.summary, item.tags, item.markdown, item.id, item.slug]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function isPowerElectronicsItem(item) {
    if (item.type === "project" || item.statusKey || item.license) return true;
    const categoryKey = String(item.categoryKey || "").toLowerCase();
    const tags = String(item.tags || "").toLowerCase();
    if (["electronics-basics", "power-electronics", "projects", "derivations"].includes(categoryKey)) return true;
    if (["电子基础", "电力电子", "开源项目"].includes(String(item.category || ""))) return true;
    if (/(?:^|[\s,，、])module:(?:electronics-basics|power-electronics|projects|derivations)(?:$|[\s,，、])/.test(tags)) return true;
    if (String(item.tags || "").split(/[,，、]/).some((tag) => tag.trim().startsWith("公式"))) return true;
    return /\{\{(?:formula|derive):/.test(String(item.markdown || ""));
  }

  function articleCard(post) {
    return `
      <article class="article-card">
        <a class="focused-card-media focused-card-media--article" data-focused-card-media="article" href="./post.html?id=${post.id}" aria-label="${safe(post.title)}">
          ${window.LarkixMedia.image(post.cover, `${safe(post.title)}封面`, { className: "focused-card-media__image", loading: "lazy", sizes: "(max-width: 760px) 100vw, 180px", crop: post.coverCrop })}
        </a>
        <div>
          <span class="category-pill">${safe(post.category)}</span>
          <h3><a href="./post.html?id=${post.id}">${safe(post.title)}</a></h3>
          <p>${safe(post.excerpt)}</p>
          <div class="card-footer">
            ${optionalMeta(readingMinutesLabel(post.readingMinutes))}
            <span>${safe(post.date)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function lessonFeatureCard(post) {
    if (!post) return `<div class="empty-state">还没有可展示的课程更新。</div>`;
    return `
      <div class="lesson-feature-copy">
        <div class="lesson-row-meta">
          <span class="category-pill">${safe(post.category)}</span>
          <span>推荐学习起点</span>
        </div>
        <h3><a href="./post.html?id=${post.id}">${safe(post.title)}</a></h3>
        <p>${safe(post.excerpt)}</p>
        <div class="card-footer">
          ${optionalMeta(readingMinutesLabel(post.readingMinutes))}
          <span>${safe(post.date)}</span>
        </div>
      </div>
      <a class="lesson-feature-media focused-card-media focused-card-media--feature" data-focused-card-media="feature" href="./post.html?id=${post.id}" aria-label="${safe(post.title)}">
        ${window.LarkixMedia.image(post.cover, `${safe(post.title)}封面`, { className: "focused-card-media__image", loading: "lazy", sizes: "(max-width: 760px) 100vw, 360px", crop: post.coverCrop })}
      </a>
    `;
  }

  function lessonListCard(post) {
    return `
      <article class="lesson-row">
        <a class="focused-card-media focused-card-media--row" data-focused-card-media="row" href="./post.html?id=${post.id}" aria-label="${safe(post.title)}">
          ${window.LarkixMedia.image(post.cover, `${safe(post.title)}封面`, { className: "focused-card-media__image", loading: "lazy", sizes: "(max-width: 760px) 100vw, 180px", crop: post.coverCrop })}
        </a>
        <div>
          <div class="lesson-row-meta">
            <span class="category-pill">${safe(post.category)}</span>
            <span>${safe(post.date)}</span>
          </div>
          <h3><a href="./post.html?id=${post.id}">${safe(post.title)}</a></h3>
          <p>${safe(post.excerpt)}</p>
          <div class="card-footer">
            ${optionalMeta(readingMinutesLabel(post.readingMinutes))}
            <a class="card-link" href="./post.html?id=${post.id}">进入课程</a>
          </div>
        </div>
      </article>
    `;
  }

  function projectCard(project) {
    const online = project.statusKey === "online";
    const title = online ? `<a href="./project.html?id=${project.id}">${safe(project.title)}</a>` : safe(project.title);
    const action = online ? `<a class="card-link" href="./project.html?id=${project.id}">查看详情</a>` : "";
    return `
      <article class="project-card ${online ? "" : "is-planned"}">
        ${window.LarkixMedia.image(project.cover, `${safe(project.title)}项目图片`, { loading: "lazy", sizes: "(max-width: 760px) 100vw, 160px" })}
        <div>
          <span class="status">${safe(project.status)}</span>
          <h3>${title}</h3>
          <p>${safe(project.summary)}</p>
          <div class="card-footer">
            <span>${safe(project.license)}</span>
            <span>★ ${safe(project.stars)}</span>
            ${action}
          </div>
        </div>
      </article>
    `;
  }

  function miniappUpdateCard(app) {
    const appToken = safeToken(app.id || app.name);
    return `
      <article class="miniapp-card home-miniapp-card miniapp-card-${appToken}" data-public-miniapp-card="${appToken}">
        <img class="miniapp-icon miniapp-icon-${appToken}" src="${safe(app.icon)}" alt="" loading="lazy" />
        <div class="miniapp-card-body">
          <div class="miniapp-card-kicker">
            <span>${safe(app.category)}</span>
            <span>${safe(app.version)}</span>
          </div>
          <h3><a href="${safe(app.href)}">${safe(app.name || app.title)}</a></h3>
          <p>${safe(app.summary)}</p>
          <div class="miniapp-card-footer">
            <a class="card-link" href="${safe(app.href)}">打开工具</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderArticles(items) {
    if (!list) return;
    if (recentLessonFeature) {
      const [lead, ...rest] = items;
      recentLessonFeature.innerHTML = lessonFeatureCard(lead);
      list.innerHTML = rest.map(lessonListCard).join("") || `<div class="empty-state">没有找到更多匹配的文章。</div>`;
      window.LarkixMedia.hydrateFocusedMedia?.(recentLessonFeature);
      window.LarkixMedia.hydrateFocusedMedia?.(list);
      return;
    }
    list.innerHTML = items.map(articleCard).join("") || `<div class="empty-state">没有找到匹配的文章。</div>`;
    window.LarkixMedia.hydrateFocusedMedia?.(list);
  }

  function itemUrl(item) {
    if (item.href) return item.href;
    return item.type === "project" ? `./project.html?id=${item.id}` : `./post.html?id=${item.id}`;
  }

  function itemLabel(item) {
    return item.category || item.status || "精选内容";
  }

  function itemSummary(item) {
    return item.excerpt || item.summary || "";
  }

  function itemDate(item) {
    return item.date || "项目档案";
  }

  function itemReadTime(item) {
    if (item.type === "post") return readingMinutesLabel(item.readingMinutes);
    return item.readTime || item.license || item.status || "";
  }

  function recommendationPriority(item) {
    const priority = Number(item.recommendationPriority ?? 999);
    return Number.isFinite(priority) ? priority : 999;
  }

  function itemTimestamp(item) {
    const value = Date.parse(item.date || item.publishedAt || item.updatedAt || item.createdAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function sortByRecommendation(items) {
    return items
      .slice()
      .sort((a, b) => recommendationPriority(a) - recommendationPriority(b) || itemTimestamp(b) - itemTimestamp(a));
  }

  function canOpen(item) {
    if (item.href) return true;
    return item.type !== "project" || item.statusKey === "online";
  }

  function normalizeHeroIndex(index) {
    if (!featuredItems.length) return 0;
    return (Number(index) + featuredItems.length) % featuredItems.length;
  }

  function renderFeatured(index = 0) {
    index = normalizeHeroIndex(index);
    const featured = featuredItems[index];
    if (!featured) {
      if (hero) hero.hidden = true;
      return;
    }
    if (hero) hero.hidden = false;
    const copy = document.querySelector("#heroCopy");
    const bgA = document.querySelector("#heroBgA");
    const bgB = document.querySelector("#heroBgB");
    const nextBg = activeBg === "A" ? bgB : bgA;
    const currentBg = activeBg === "A" ? bgA : bgB;

    if (hero) hero.dataset.heroIndex = String(index);
    if (heroCopyTimer) window.clearTimeout(heroCopyTimer);
    copy.classList.remove("is-active");
    heroCopyTimer = window.setTimeout(() => {
      document.querySelector("#featuredTitle").textContent = featured.title;
      document.querySelector("#featuredExcerpt").textContent = itemSummary(featured);
      document.querySelector("#featuredCategory").textContent = itemLabel(featured);
      const featuredReadTime = document.querySelector("#featuredReadTime");
      const readTime = itemReadTime(featured);
      featuredReadTime.textContent = readTime;
      featuredReadTime.hidden = !readTime;
      document.querySelector("#featuredDate").textContent = itemDate(featured);
      document.querySelector("#featuredLink").href = canOpen(featured) ? itemUrl(featured) : "#projectList";
      document.querySelector("#featuredLink").textContent = canOpen(featured) ? "阅读全文" : "查看项目概述";
      copy.classList.add("is-active");
      heroCopyTimer = null;
    }, 240);

    if (nextBg && currentBg) {
      window.LarkixMedia.applyToImage(nextBg, featured.cover || "./assets/hero/electronics-lab-hero.png", {
        sizes: "100vw",
        fetchPriority: "high",
        crop: featured.coverCrop
      });
      nextBg.classList.add("is-active");
      currentBg.classList.remove("is-active");
      activeBg = activeBg === "A" ? "B" : "A";
    }

    document.querySelectorAll(".pagination-dots span, .pagination-dots button").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
      if (dot.tagName === "BUTTON") dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });
    document.querySelectorAll(".hero-card").forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === index);
    });
  }

  function activateHero(index, { restart = true } = {}) {
    activeHeroIndex = normalizeHeroIndex(index);
    renderFeatured(activeHeroIndex);
    if (restart) restartHeroTimer();
  }

  function renderHeroCards() {
    if (!heroCards) return;
    const dots = document.querySelector(".pagination-dots");
    if (dots) {
      dots.removeAttribute("aria-hidden");
      dots.setAttribute("aria-label", "精选内容切换");
      dots.innerHTML = featuredItems
        .map(
          (_, index) =>
            `<button type="button" class="${index === 0 ? "active" : ""}" aria-label="切换到第 ${index + 1} 项精选内容" aria-current="${index === 0 ? "true" : "false"}"></button>`
        )
        .join("");
      dots.querySelectorAll("button").forEach((button, index) => {
        button.addEventListener("click", () => activateHero(index));
      });
    }
    heroCards.innerHTML = featuredItems
      .map(
        (item, index) => `
          <article class="hero-card hero-list-card" data-hero-index="${index}">
            <span class="hero-card-index">${String(index + 1).padStart(2, "0")}</span>
            <div class="hero-card-body">
              <span class="category-pill">${safe(itemLabel(item))}</span>
              <h3><a href="${canOpen(item) ? itemUrl(item) : "#projectList"}">${safe(item.title)}</a></h3>
            </div>
          </article>
        `
      )
      .join("");

    heroCards.querySelectorAll(".hero-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        activateHero(Number(card.dataset.heroIndex || 0));
      });
    });
  }

  function bindHeroSwipe() {
    if (!hero || featuredItems.length < 2) return;
    let startX = 0;
    let startY = 0;
    let pointerId = null;
    let tracking = false;
    let lockedHorizontal = false;

    function resetSwipeState() {
      tracking = false;
      lockedHorizontal = false;
      pointerId = null;
      hero.classList.remove("is-swipe-active");
    }

    hero.addEventListener("pointerdown", (event) => {
      if (event.button && event.button !== 0) return;
      if (event.target.closest("a, button, input, textarea, select, label")) return;
      startX = event.clientX;
      startY = event.clientY;
      pointerId = event.pointerId;
      tracking = true;
      lockedHorizontal = false;
    });

    hero.addEventListener(
      "pointermove",
      (event) => {
        if (!tracking || event.pointerId !== pointerId) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (!lockedHorizontal && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
          lockedHorizontal = true;
          hero.classList.add("is-swipe-active");
        }
        if (lockedHorizontal) event.preventDefault();
      },
      { passive: false }
    );

    hero.addEventListener("pointerup", (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const threshold = Math.max(44, Math.min(72, hero.clientWidth * 0.14));
      if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.18) {
        activateHero(activeHeroIndex + (deltaX < 0 ? 1 : -1));
      }
      resetSwipeState();
    });

    hero.addEventListener("pointercancel", resetSwipeState);
    hero.addEventListener("pointerleave", (event) => {
      if (tracking && event.pointerType === "mouse") resetSwipeState();
    });
  }

  function renderProjects(items) {
    if (!projectList) return;
    projectList.innerHTML = items.map(projectCard).join("");
  }

  function renderMiniappUpdates(items) {
    if (!miniappUpdateList) return;
    miniappUpdateList.innerHTML = items.map(miniappUpdateCard).join("") || `<div class="empty-state">当前还没有可用小程序。</div>`;
  }

  function applySiteLayout() {
    const main = document.querySelector("#mainContent");
    const sections = [...document.querySelectorAll("[data-layout-section]")];
    if (!main || !sections.length) return;
    const orderMap = new Map((siteLayout.home || []).map((item) => [item.key, item]));
    sections
      .sort((a, b) => {
        const left = orderMap.get(a.dataset.layoutSection)?.order ?? 99;
        const right = orderMap.get(b.dataset.layoutSection)?.order ?? 99;
        return Number(left) - Number(right);
      })
      .forEach((section) => {
        const config = orderMap.get(section.dataset.layoutSection);
        section.hidden = section.dataset.layoutSection === "miniapps" ? false : config?.visible === false;
        section.dataset.layoutSize = config?.size || "standard";
        main.appendChild(section);
      });
  }

  function focusNodeCard(node) {
    const slug = node.slug || node.id || "";
    const symbol = node.symbol || "Derivation";
    const color = ["purple", "blue", "green", "amber", "red", "neutral"].includes(node.accentColor) ? node.accentColor : "purple";
    return `
      <article class="derive-node-card derive-accent-${html(color)}">
        <span class="derive-node-symbol">${formulaSymbolHtml(symbol)}</span>
        <h3><a href="./derive.html?slug=${encodeURIComponent(slug)}">${html(node.title || slug)}</a></h3>
        <p>${html(node.summary || "")}</p>
      </article>
    `;
  }

  async function renderFocusDerivations(section) {
    const target = section.querySelector("#focusDerivationList");
    if (!target || target.dataset.loaded === "true") return;
    target.dataset.loaded = "true";
    target.innerHTML = `<div class="empty-state">正在读取公开推导节点。</div>`;
    try {
      const response = await fetch("./api/knowledge-nodes", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const nodes = Array.isArray(payload.nodes) ? payload.nodes.slice(0, 4) : [];
      target.innerHTML = nodes.length
        ? nodes.map(focusNodeCard).join("")
        : `<div class="empty-state">公开推导节点发布后会显示在这里。</div>`;
    } catch {
      target.innerHTML = `<div class="empty-state">暂时无法读取公开推导节点。</div>`;
    }
  }

  function ensureFocusSection() {
    const main = document.querySelector("#mainContent");
    if (!main || document.querySelector("#homeFocus")) return document.querySelector("#homeFocus");
    const section = document.createElement("section");
    section.className = "site-shell section-row focus-entry-section";
    section.id = "homeFocus";
    section.dataset.layoutSection = "focus";
    section.innerHTML = `
      <div class="section-heading">
        <div class="section-title-block split-title">
          <h2>电子基础</h2>
          <span>Electronics Basics</span>
        </div>
        <a href="./category.html?category=electronics-basics">进入聚焦路径</a>
      </div>
      <div class="focus-entry-grid">
        <article class="focus-entry-card focus-entry-primary">
          <span class="category-pill">Focused Track</span>
          <h3><a href="./category.html?category=electronics-basics">电子基础学习路径</a></h3>
          <p>从电路变量、基础公式和可复现工程验证开始整理公开内容。</p>
          <a class="card-link" href="./category.html?category=electronics-basics">打开路径</a>
        </article>
        <article class="focus-entry-card">
          <span class="category-pill">Derivations</span>
          <h3><a href="./derive.html">公式推导节点</a></h3>
          <p>文章中的公式变量会打开对应推导页，节点内容可继续串联到更多变量。</p>
          <a class="card-link" href="./derive.html">查看节点</a>
        </article>
        <article class="focus-entry-card">
          <span class="category-pill">Projects</span>
          <h3><a href="./projects.html">开源项目</a></h3>
          <p>查看原理图、PCB、BOM、固件与调试记录，按项目复现完整工程过程。</p>
          <a class="card-link" href="./projects.html">查看项目</a>
        </article>
      </div>
    `;
    const anchor = document.querySelector("#homeRecommended") || document.querySelector("#homeProjects");
    main.insertBefore(section, anchor || null);
    return section;
  }

  function applyFocusedHome() {
    if (!focusModeEnabled()) return;
    ensureFocusSection();
    if (projectList?.closest("[data-layout-section]")) projectList.closest("[data-layout-section]").hidden = true;
    if (miniappUpdateList?.closest("[data-layout-section]")) miniappUpdateList.closest("[data-layout-section]").hidden = false;
    const recommendedTitle = document.querySelector("#homeRecommended h2");
    const recommendedTitleEn = document.querySelector("#homeRecommended .section-title-block span");
    if (recommendedTitle) recommendedTitle.textContent = "聚焦内容";
    if (recommendedTitleEn) recommendedTitleEn.textContent = "Focused Picks";
  }

  function publicFormulaHtml(item) {
    const source = safe(item.latex).trim();
    const result = source && window.LarkixMath?.render?.(source, { displayMode: true });
    const output = result?.valid && !result.blocking ? result.html : `<span class="public-formula-fallback">${html(source || item.name || "公式")}</span>`;
    return `<div class="public-formula-fit"><div class="formula-card-latex">${output}</div></div>`;
  }

  function fitHomeFormulas(root) {
    root?.querySelectorAll(".public-formula-fit").forEach((frame) => {
      const math = frame.firstElementChild;
      if (!math) return;
      math.style.setProperty("--formula-fit-scale", "1");
      const width = Math.max(math.scrollWidth, math.getBoundingClientRect().width);
      const height = Math.max(math.scrollHeight, math.getBoundingClientRect().height);
      const availableWidth = Math.max(1, frame.clientWidth - 24);
      const availableHeight = Math.max(1, frame.clientHeight - 24);
      math.style.setProperty("--formula-fit-scale", String(Math.min(1, availableWidth / width, availableHeight / height)));
    });
    window.LarkixMath?.adaptiveLayout?.refresh?.(root);
  }

  function formulaDiscoveryCard(item) {
    const route = safePublicRoute(item.route, `/formula/${encodeURIComponent(item.slug || "")}`);
    return `<article class="public-media-card public-media-card--formula">
      <a class="public-card-cover" href="${html(route)}" aria-label="打开${html(item.name)}">
        ${publicFormulaHtml(item)}
        <span class="public-card-overlays"><span></span>${cardViewMeta(item.viewCount)}</span>
      </a>
      <div class="public-card-copy"><h3><a href="${html(route)}">${html(item.name)}</a></h3><p>${html(item.module || item.category || "公式")}</p></div>
    </article>`;
  }

  function focusedArticleCard(slot, article) {
    const duration = compactDuration(article.readingMinutes);
    const route = safePublicRoute(slot.route, `./post.html?id=${encodeURIComponent(article.id)}`);
    return `<article class="home-focus-card home-focus-card--${html(slot.slot)}">
      <a class="public-card-cover" href="${html(route)}" aria-label="打开${html(slot.title)}">
        ${window.LarkixMedia.image(slot.cover, `${safe(slot.title)}封面`, { loading: "lazy", sizes: slot.slot === "large" ? "(max-width: 760px) 100vw, 50vw" : "(max-width: 760px) 100vw, 26vw", crop: article.coverCrop })}
        <span class="public-card-overlays">${duration ? `<span class="public-card-duration"><span aria-hidden="true">◷</span> ${duration}</span>` : "<span></span>"}${cardViewMeta(article.viewCount)}</span>
      </a>
      <div class="public-card-copy"><h3><a href="${html(route)}">${html(slot.title)}</a></h3><p>${html(slot.category || article.category || "文章")}</p></div>
    </article>`;
  }

  function ensureDiscoverySection(id, title, english, href) {
    let section = document.querySelector(`#${id}`);
    if (section) return section;
    section = document.createElement("section");
    section.className = "site-shell section-row";
    section.id = id;
    section.innerHTML = `<div class="section-heading"><div class="section-title-block split-title"><h2>${title}</h2><span>${english}</span></div><a href="${href}">查看全部</a></div><div class="public-media-grid"></div>`;
    return section;
  }

  let homeDiscoveryRequest = 0;

  async function loadS65HomeDiscovery() {
    if (!focusModeEnabled()) return;
    const request = ++homeDiscoveryRequest;
    const main = document.querySelector("#mainContent");
    const recommended = document.querySelector("#homeRecommended");
    const electronics = ensureFocusSection();
    const miniappsSection = document.querySelector("#homeMiniapps");
    if (!main || !recommended || !electronics) return;
    const derivations = ensureDiscoverySection("homeDerivations", "公开推导节点", "Public Derivations", "./derive.html");
    const formulas = ensureDiscoverySection("homeLatestFormulas", "最新公式", "Latest Formulas", "./search.html?type=formula");
    const anchor = miniappsSection || null;
    [derivations, formulas, recommended, electronics].forEach((section) => main.insertBefore(section, anchor));
    const initialFocusLayout = recommended.querySelector(".home-lesson-layout");
    if (initialFocusLayout) {
      initialFocusLayout.className = "home-focus-layout";
      initialFocusLayout.innerHTML = "";
    }
    try {
      const [homeResponse, derivationResponse] = await Promise.all([
        fetch("./api/public/home-discovery", { cache: "no-store" }),
        fetch("./api/knowledge-nodes", { cache: "no-store" })
      ]);
      if (!homeResponse.ok || !derivationResponse.ok) throw new Error("home discovery unavailable");
      const home = await homeResponse.json();
      const derivationPayload = await derivationResponse.json();
      if (request !== homeDiscoveryRequest) return;
      const nodes = Array.isArray(derivationPayload.nodes) ? derivationPayload.nodes.slice(0, 4) : [];
      derivations.querySelector(".public-media-grid").innerHTML = nodes.length ? nodes.map(focusNodeCard).join("") : '<div class="empty-state">公开推导节点发布后会显示在这里。</div>';
      const latest = Array.isArray(home.latestFormulas) ? home.latestFormulas.slice(0, 8) : [];
      formulas.querySelector(".public-media-grid").innerHTML = latest.length ? latest.map(formulaDiscoveryCard).join("") : '<div class="empty-state">公开公式发布后会显示在这里。</div>';
      const focusSlots = Array.isArray(home.focusedArticles) ? home.focusedArticles : [];
      const articleMap = new Map(posts.map((item) => [item.id, item]));
      const focusLayout = recommended.querySelector(".home-focus-layout");
      focusLayout.innerHTML = focusSlots.map((slot) => {
        const article = articleMap.get(slot.postId);
        return article ? focusedArticleCard(slot, article) : "";
      }).join("");
      focusLayout.className = "home-focus-layout";
      window.LarkixMedia.hydrateFocusedMedia?.(focusLayout);
      fitHomeFormulas(formulas);
    } catch {
      if (request !== homeDiscoveryRequest) return;
      derivations.querySelector(".public-media-grid").innerHTML = '<div class="empty-state">暂时无法读取公开推导节点。</div>';
      formulas.querySelector(".public-media-grid").innerHTML = '<div class="empty-state">暂时无法读取最新公式。</div>';
      const focusLayout = recommended.querySelector(".home-focus-layout");
      if (focusLayout) focusLayout.innerHTML = "";
    }
  }

  function bindHomepageSearchRoute() {
    if (!search || search.dataset.searchRouteBound === "true") return;
    search.dataset.searchRouteBound = "true";
    const box = search.closest(".search-box");
    const form = document.createElement("form");
    form.className = "home-search-route";
    form.setAttribute("role", "search");
    box.replaceWith(form);
    form.appendChild(box);
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "搜索";
    button.setAttribute("aria-label", "提交公开搜索");
    form.appendChild(button);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = search.value.trim();
      location.href = `./search.html${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    });
  }

  function resolveRecommended(ids) {
    return ids
      .map((id) => posts.find((item) => item.id === id) || projects.find((item) => item.id === id) || publicProjects.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 3);
  }

  function renderCoursePaths() {
    if (!coursePathList) return;
    const orderedKeys = ["analog", "stm32", "esp32"];
    coursePathList.innerHTML = orderedKeys
      .map((key) => {
        const meta = courseMeta[key];
        if (!meta) return "";
        const recommended = resolveRecommended(meta.recommendedPosts || []);
        return `
          <article class="course-path-card">
            <a class="course-path-media" href="${safe(meta.href)}" aria-hidden="true" tabindex="-1">
              ${window.LarkixMedia.image(meta.cover, safe(meta.coverAlt || `${meta.title}课程路线配图`), { loading: "lazy", sizes: "(max-width: 1100px) 100vw, 320px" })}
            </a>
            <div class="course-path-copy">
              <div class="section-title-line course-path-title-line">
                <h3>${safe(meta.title)}</h3>
                <span>${safe(meta.english)}</span>
              </div>
              <p>${safe(meta.summary)}</p>
              <div class="course-steps">
                ${(meta.stages || []).map((step, index) => `<span class="course-step"><b>${String(index + 1).padStart(2, "0")}</b>${safe(step)}</span>`).join("")}
              </div>
            </div>
            <div class="course-path-side">
              <strong>推荐内容</strong>
              <div class="course-path-links">
                ${recommended
                  .map((item) => {
                    const href = item.type === "project" || item.status ? `./project.html?id=${item.id}` : `./post.html?id=${item.id}`;
                    return `<a href="${href}">${safe(item.title)}</a>`;
                  })
                  .join("")}
              </div>
              <a class="button secondary course-path-cta" href="${safe(meta.href)}">${safe(meta.cta)}</a>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function restartHeroTimer() {
    if (heroTimer) window.clearInterval(heroTimer);
    if (!featuredItems.length) return;
    heroTimer = window.setInterval(() => {
      activeHeroIndex = (activeHeroIndex + 1) % featuredItems.length;
      renderFeatured(activeHeroIndex);
    }, 10000);
  }

  function scoreItem(item, keyword) {
    if (!keyword) return 1;
    const tokens = keyword.split(/\s+/).filter(Boolean);
    return tokens.reduce((score, token) => {
      const title = String(item.title || "").toLowerCase();
      const tags = String(item.tags || "").toLowerCase();
      const category = String(item.category || item.status || "").toLowerCase();
      const summary = String(item.excerpt || item.summary || "").toLowerCase();
      const markdown = String(item.markdown || "").toLowerCase();
      if (title.includes(token)) score += 8;
      if (tags.includes(token)) score += 6;
      if (category.includes(token)) score += 4;
      if (summary.includes(token)) score += 3;
      if (markdown.includes(token)) score += 1;
      return score;
    }, 0);
  }

  function searchItems(items, keyword) {
    if (!keyword) return items;
    return items
      .map((item) => ({ item, score: scoreItem(item, keyword) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }

  let focusPosts = focusModeEnabled() ? sortByRecommendation(posts.filter(isPowerElectronicsItem)) : posts;
  let focusProjects = focusModeEnabled() ? sortByRecommendation(publicProjects.filter(isPowerElectronicsItem)) : publicProjects;
  featuredItems = window.LarkixContent.getHeroCarousel();

  renderArticles(sortByRecommendation(focusModeEnabled() ? focusPosts : posts));
  renderCoursePaths();
  renderHeroCards();
  renderFeatured(0);
  bindHeroSwipe();
  restartHeroTimer();
  renderProjects(focusModeEnabled() ? [] : projects);
  renderMiniappUpdates(miniapps);
  applyFocusedNavigation();
  applySiteLayout();
  applyFocusedHome();
  bindHomepageSearchRoute();
  loadS65HomeDiscovery();

  window.addEventListener("larkix:public-content-updated", () => {
    posts = window.LarkixContent.getPosts();
    publicProjects = window.LarkixContent.getProjects();
    projects = window.LarkixContent.getProjectDirectory();
    focusMode = normalizePublicFocusMode(window.LARKIX_SERVER_CONTENT?.publicFocusMode);
    siteLayout = window.LARKIX_SERVER_CONTENT?.siteLayout || {};
    siteLayoutSignature = JSON.stringify(siteLayout);
    focusPosts = focusModeEnabled() ? sortByRecommendation(posts.filter(isPowerElectronicsItem)) : posts;
    focusProjects = focusModeEnabled() ? sortByRecommendation(publicProjects.filter(isPowerElectronicsItem)) : publicProjects;
    featuredItems = window.LarkixContent.getHeroCarousel();
    activeHeroIndex = Math.min(activeHeroIndex, Math.max(0, featuredItems.length - 1));
    renderArticles(sortByRecommendation(focusPosts));
    renderCoursePaths();
    renderHeroCards();
    renderFeatured(activeHeroIndex);
    restartHeroTimer();
    renderProjects(focusModeEnabled() ? [] : projects);
    applyFocusedNavigation();
    applySiteLayout();
    applyFocusedHome();
    loadS65HomeDiscovery();
  });
})();
