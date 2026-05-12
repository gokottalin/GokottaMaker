(function () {
  const posts = window.GokottaContent.getPosts();
  const publicProjects = window.GokottaContent.getProjects();
  const projects = window.GokottaContent.getProjectDirectory();
  const list = document.querySelector("#articleList");
  const hero = document.querySelector(".hero");
  const heroCards = document.querySelector("#heroCards");
  const projectList = document.querySelector("#projectList");
  const miniappUpdateList = document.querySelector("#miniappUpdateList");
  const search = document.querySelector("#siteSearch");
  const miniapps = window.GOKOTTA_MINIAPPS || [];
  let featuredItems = [];
  let activeHeroIndex = 0;
  let activeBg = "A";
  let heroTimer = null;
  let heroCopyTimer = null;

  function safe(value) {
    return String(value || "");
  }

  function articleCard(post) {
    return `
      <article class="article-card">
        <a href="./post.html?id=${post.id}" aria-label="${safe(post.title)}">
          ${window.GokottaMedia.image(post.cover, `${safe(post.title)}封面`, { loading: "lazy", sizes: "(max-width: 760px) 100vw, 180px" })}
        </a>
        <div>
          <span class="category-pill">${safe(post.category)}</span>
          <h3><a href="./post.html?id=${post.id}">${safe(post.title)}</a></h3>
          <p>${safe(post.excerpt)}</p>
          <div class="card-footer">
            <span>${safe(post.readTime)}</span>
            <span>${safe(post.date)}</span>
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
        ${window.GokottaMedia.image(project.cover, `${safe(project.title)}项目图片`, { loading: "lazy", sizes: "(max-width: 760px) 100vw, 160px" })}
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
    return `
      <article class="miniapp-card home-miniapp-card">
        <img class="miniapp-icon" src="${safe(app.icon)}" alt="" loading="lazy" />
        <div class="miniapp-card-body">
          <div class="miniapp-card-kicker">
            <span>${safe(app.category)}</span>
            <span>${safe(app.version)}</span>
          </div>
          <h3><a href="${safe(app.href)}">${safe(app.name || app.title)}</a></h3>
          <p>${safe(app.summary)}</p>
          <div class="miniapp-capabilities">
            ${(app.capabilities || []).map((item) => `<span>${safe(item)}</span>`).join("")}
          </div>
          <div class="miniapp-card-footer">
            <span>${safe(app.status)}</span>
            <a class="card-link" href="${safe(app.href)}">打开工具</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderArticles(items) {
    if (!list) return;
    list.innerHTML = items.map(articleCard).join("") || `<div class="empty-state">没有找到匹配的文章。</div>`;
  }

  function itemUrl(item) {
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
    return item.readTime || item.license || item.status || "";
  }

  function canOpen(item) {
    return item.type !== "project" || item.statusKey === "online";
  }

  function normalizeHeroIndex(index) {
    if (!featuredItems.length) return 0;
    return (Number(index) + featuredItems.length) % featuredItems.length;
  }

  function renderFeatured(index = 0) {
    index = normalizeHeroIndex(index);
    const featured = featuredItems[index] || posts[0];
    if (!featured) return;
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
      document.querySelector("#featuredReadTime").textContent = itemReadTime(featured);
      document.querySelector("#featuredDate").textContent = itemDate(featured);
      document.querySelector("#featuredLink").href = canOpen(featured) ? itemUrl(featured) : "#projectList";
      document.querySelector("#featuredLink").textContent = canOpen(featured) ? "阅读全文" : "查看项目概述";
      copy.classList.add("is-active");
      heroCopyTimer = null;
    }, 240);

    if (nextBg && currentBg) {
      window.GokottaMedia.applyToImage(nextBg, featured.cover || "./assets/hero/electronics-lab-hero.png", { sizes: "100vw", fetchPriority: "high" });
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

  featuredItems = [...posts, ...publicProjects]
    .filter((item) => item.featured)
    .sort((a, b) => Number(a.featuredOrder || 0) - Number(b.featuredOrder || 0))
    .slice(0, 4);
  if (!featuredItems.length) {
    featuredItems = [
      posts.find((post) => post.id === "stm32-adc-dma-precision") || posts[0],
      posts.find((post) => post.id === "analog-active-filter") || posts[1],
      posts.find((post) => post.id === "esp32-low-power-node") || posts[2],
      posts.find((post) => post.id === "opensource-power-amplifier") || posts[3]
    ].filter(Boolean);
  }

  renderArticles(posts);
  renderHeroCards();
  renderFeatured(0);
  bindHeroSwipe();
  restartHeroTimer();
  renderProjects(projects);
  renderMiniappUpdates(miniapps);

  if (search) {
    search.addEventListener("input", () => {
      const keyword = search.value.trim().toLowerCase();
      const filteredPosts = searchItems(posts, keyword);
      const filteredProjects = searchItems(projects, keyword);
      renderArticles(filteredPosts);
      renderProjects(filteredProjects);
    });
  }
})();
