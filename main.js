(function () {
  const posts = window.GokottaContent.getPosts();
  const projects = window.GokottaContent.getProjects();
  const list = document.querySelector("#articleList");
  const heroCards = document.querySelector("#heroCards");
  const projectList = document.querySelector("#projectList");
  const search = document.querySelector("#siteSearch");
  let featuredItems = [];
  let activeHeroIndex = 0;
  let activeBg = "A";
  let heroTimer = null;

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

  function renderFeatured(index = 0) {
    const featured = featuredItems[index] || posts[0];
    if (!featured) return;
    const copy = document.querySelector("#heroCopy");
    const bgA = document.querySelector("#heroBgA");
    const bgB = document.querySelector("#heroBgB");
    const nextBg = activeBg === "A" ? bgB : bgA;
    const currentBg = activeBg === "A" ? bgA : bgB;

    copy.classList.remove("is-active");
    window.setTimeout(() => {
      document.querySelector("#featuredTitle").textContent = featured.title;
      document.querySelector("#featuredExcerpt").textContent = itemSummary(featured);
      document.querySelector("#featuredCategory").textContent = itemLabel(featured);
      document.querySelector("#featuredReadTime").textContent = itemReadTime(featured);
      document.querySelector("#featuredDate").textContent = itemDate(featured);
      document.querySelector("#featuredLink").href = canOpen(featured) ? itemUrl(featured) : "#projectList";
      document.querySelector("#featuredLink").textContent = canOpen(featured) ? "阅读全文" : "查看项目概述";
      copy.classList.add("is-active");
    }, 240);

    if (nextBg && currentBg) {
      window.GokottaMedia.applyToImage(nextBg, featured.cover || "./assets/hero/electronics-lab-hero.png", { sizes: "100vw", fetchPriority: "high" });
      nextBg.classList.add("is-active");
      currentBg.classList.remove("is-active");
      activeBg = activeBg === "A" ? "B" : "A";
    }

    document.querySelectorAll(".pagination-dots span").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
    document.querySelectorAll(".hero-card").forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === index);
    });
  }

  function renderHeroCards() {
    if (!heroCards) return;
    const dots = document.querySelector(".pagination-dots");
    if (dots) dots.innerHTML = featuredItems.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("");
    const flowShapes = [
      {
        primary: "M -16 26 C 18 4 48 18 72 54 S 104 94 120 128",
        secondary: "M 10 -18 C 42 26 46 58 24 118"
      },
      {
        primary: "M 72 -20 C 52 16 70 42 98 62 S 116 98 82 126",
        secondary: "M -12 88 C 28 50 54 42 120 18"
      },
      {
        primary: "M 82 -18 C 38 14 30 42 42 66 S 82 90 62 126",
        secondary: "M 110 -14 C 74 34 70 74 10 118"
      },
      {
        primary: "M 62 -18 C 92 16 100 44 72 68 S 24 92 12 128",
        secondary: "M -18 34 C 30 18 70 48 118 110"
      }
    ];
    const flowLayer = (index) => {
      const flow = flowShapes[index % flowShapes.length];
      return `
        <svg class="flow-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path class="flow-line flow-line-primary" d="${flow.primary}" />
          <path class="flow-line flow-line-secondary" d="${flow.secondary}" />
        </svg>
        <span class="glass-caustic glass-caustic-a" aria-hidden="true"></span>
        <span class="glass-caustic glass-caustic-b" aria-hidden="true"></span>
      `;
    };
    heroCards.innerHTML = featuredItems
      .map(
        (item, index) => `
          <article class="hero-card hero-list-card" data-hero-index="${index}">
            ${flowLayer(index)}
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
        activeHeroIndex = Number(card.dataset.heroIndex || 0);
        renderFeatured(activeHeroIndex);
        restartHeroTimer();
      });
    });
  }

  function renderProjects(items) {
    if (!projectList) return;
    projectList.innerHTML = items.map(projectCard).join("");
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

  featuredItems = [...posts, ...projects]
    .filter((item) => item.featured)
    .sort((a, b) => Number(a.featuredOrder || 0) - Number(b.featuredOrder || 0))
    .slice(0, 6);
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
  restartHeroTimer();
  renderProjects(projects);

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
