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
          <img src="${post.cover}" alt="${safe(post.title)}封面" />
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
        <img src="${project.cover}" alt="${safe(project.title)}项目图片" />
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
    if (item.type === "project") return `./project.html?id=${item.id}`;
    return `./post.html?id=${item.id}`;
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
    const featured = featuredItems[index] || posts.find((post) => post.id === "stm32-adc-dma-precision") || posts[0];
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
      nextBg.src = featured.cover || "./assets/hero/electronics-lab-hero.png";
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
    heroTimer = window.setInterval(() => {
      activeHeroIndex = (activeHeroIndex + 1) % featuredItems.length;
      renderFeatured(activeHeroIndex);
    }, 10000);
  }

  featuredItems = [
    posts.find((post) => post.id === "stm32-adc-dma-precision") || posts[0],
    posts.find((post) => post.id === "analog-active-filter") || posts[1],
    posts.find((post) => post.id === "esp32-low-power-node") || posts[2],
    posts.find((post) => post.id === "opensource-power-amplifier") || posts[3]
  ].filter(Boolean);

  renderFeatured(0);
  renderArticles(posts);
  renderHeroCards();
  renderFeatured(0);
  restartHeroTimer();
  renderProjects(projects);

  if (search) {
    search.addEventListener("input", () => {
      const keyword = search.value.trim().toLowerCase();
      const filteredPosts = posts.filter((post) =>
        [post.title, post.category, post.excerpt, post.markdown].join(" ").toLowerCase().includes(keyword)
      );
      const filteredProjects = projects.filter((project) =>
        [project.title, project.status, project.summary, project.markdown].join(" ").toLowerCase().includes(keyword)
      );
      renderArticles(filteredPosts);
      renderProjects(filteredProjects);
    });
  }
})();
