(() => {
  const CATEGORY_MAP = {
    all: "全部教程",
    analog: "模拟电子",
    stm32: "STM32",
    esp32: "ESP32",
    projects: "开源项目"
  };

  const ENGLISH_MAP = {
    all: "All Tutorials",
    analog: "Analog Electronics",
    stm32: "STM32 Lab",
    esp32: "ESP32 Systems",
    projects: "Open Projects"
  };

  const DESCRIPTION_MAP = {
    all: "集中浏览 GokottaMaker 当前已发布的全部内容，覆盖模拟电子、STM32、ESP32 与开源项目。",
    analog: "整理运放、滤波器、ADC 前端、电源噪声、输入保护和测量调试相关内容，关注从电路指标到真实验证的工程过程。",
    stm32: "整理 STM32 ADC、DMA、定时器、通信接口、Bootloader 和调试实践，关注可复用的嵌入式工程方法。",
    esp32: "整理 ESP32 低功耗、Wi-Fi、MQTT、OTA、传感器节点和电池供电设计，关注联网设备的长期稳定运行。",
    projects: "记录 GokottaMaker 的开源硬件项目，包括 BOM、原理图、PCB、固件、外壳与调试记录。"
  };

  const ROUTE_PROJECT_HINTS = {
    analog: ["analog", "功放", "power", "amplifier", "supply", "滤波", "adc"],
    stm32: ["stm32", "adc", "dma", "logic", "analyzer", "power"],
    esp32: ["esp32", "smart", "iot", "node", "wifi", "传感器"]
  };

  const params = new URLSearchParams(location.search);
  const key = params.get("category") || "analog";
  const initialKeyword = params.get("q") || "";
  const category = CATEGORY_MAP[key] || CATEGORY_MAP.analog;
  const description = DESCRIPTION_MAP[key] || DESCRIPTION_MAP.analog;
  const courseMeta = window.GokottaCourseMeta || {};
  const meta = courseMeta[key] || courseMeta.all || {};
  const contentApi = window.GokottaContent;
  const allPosts = contentApi.getPosts();
  const allProjects = contentApi.getProjectDirectory();
  const postMap = new Map(allPosts.map((item) => [item.id, item]));
  const projectMap = new Map(allProjects.map((item) => [item.id, item]));
  const escapeHtml = window.GokottaMedia.escapeHtml;

  const titleNode = document.querySelector("#categoryTitle");
  const titleEnNode = document.querySelector("#categoryTitleEn");
  const summaryNode = document.querySelector("#categorySummary");
  const featureNode = document.querySelector("#categoryFeature");
  const listNode = document.querySelector("#categoryList");
  const syllabusNode = document.querySelector("#syllabusRail");
  const panelNode = document.querySelector("#resourcePanel");
  const searchNode = document.querySelector("#categorySearch");
  const searchLabelNode = document.querySelector(".category-search-box span");
  const returnLinkNode = document.querySelector(".category-heading-actions .return-link");

  const items = sortByRecommendation(key === "all" ? allPosts : allPosts.filter((post) => post.categoryKey === key || post.category === category));
  const routeProjects = buildRouteProjects();
  const recommended = buildRecommendedItems();

  function itemUrl(post) {
    return `./post.html?id=${encodeURIComponent(post.id)}`;
  }

  function projectUrl(project) {
    return `./project.html?id=${encodeURIComponent(project.id)}`;
  }

  function searchableText(item) {
    return [
      item.title,
      item.excerpt,
      item.summary,
      item.tags,
      item.markdown,
      item.category,
      item.status,
      item.license,
      item.date,
      item.id,
      item.slug
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function tokenize(keyword) {
    return String(keyword || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function scoreItem(item, tokens) {
    if (!tokens.length) return 1;
    return tokens.reduce((score, token) => {
      const title = String(item.title || "").toLowerCase();
      const tags = String(item.tags || "").toLowerCase();
      const categoryOrStatus = String(item.category || item.status || "").toLowerCase();
      const corpus = searchableText(item);
      if (title.includes(token)) score += 8;
      if (tags.includes(token)) score += 6;
      if (categoryOrStatus.includes(token)) score += 4;
      if (corpus.includes(token)) score += 2;
      return score;
    }, 0);
  }

  function recommendationPriority(item) {
    const priority = Number(item.recommendationPriority ?? 999);
    return Number.isFinite(priority) ? priority : 999;
  }

  function itemTimestamp(item) {
    const value = Date.parse(item.date || item.publishedAt || item.updatedAt || item.createdAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function sortByRecommendation(collection) {
    return collection
      .slice()
      .sort((a, b) => recommendationPriority(a) - recommendationPriority(b) || itemTimestamp(b) - itemTimestamp(a));
  }

  function searchItems(collection, tokens) {
    if (!tokens.length) return sortByRecommendation(collection);
    return collection
      .map((item) => ({ item, score: scoreItem(item, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }

  function uniqueById(collection) {
    const seen = new Set();
    return collection.filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function buildRecommendedItems() {
    return (meta.recommendedPosts || [])
      .map((id) => postMap.get(id) || projectMap.get(id))
      .filter(Boolean)
      .slice(0, 3);
  }

  function buildRouteProjects() {
    if (key === "all") return allProjects.slice();
    const relatedIds = new Set(meta.relatedProjects || []);
    const hints = ROUTE_PROJECT_HINTS[key] || [];
    const priority = allProjects.filter((project) => {
      if (relatedIds.has(project.id)) return true;
      const corpus = searchableText(project);
      return hints.some((hint) => corpus.includes(hint));
    });
    const remainder = allProjects.filter((project) => !priority.some((item) => item.id === project.id));
    return uniqueById([...priority, ...remainder]);
  }

  function matchMetaList(list, tokens) {
    if (!tokens.length) return [];
    return list.filter((item) => tokens.some((token) => String(item || "").toLowerCase().includes(token)));
  }

  function buildSearchState(keyword) {
    const tokens = tokenize(keyword);
    const matchedPosts = searchItems(items, tokens);
    const matchedProjects = searchItems(routeProjects, tokens);
    const matchedStages = matchMetaList(meta.stages || [], tokens);
    const matchedResources = matchMetaList(meta.resources || [], tokens);
    const matchedKeywords = matchMetaList(meta.keywords || [], tokens);
    const matchedRecommended = recommended.filter((item) => scoreItem(item, tokens) > 0);
    const matchedRelatedProjects = routeProjects.filter((item) => scoreItem(item, tokens) > 0);
    const metaMatched =
      matchedStages.length > 0 ||
      matchedResources.length > 0 ||
      matchedKeywords.length > 0 ||
      matchedRecommended.length > 0 ||
      matchedRelatedProjects.length > 0;

    return {
      keyword: String(keyword || "").trim(),
      tokens,
      matchedPosts,
      matchedProjects,
      matchedStages,
      matchedResources,
      matchedKeywords,
      matchedRecommended,
      matchedRelatedProjects,
      metaMatched
    };
  }

  function lessonRow(post) {
    return `
      <article class="lesson-row">
        <a href="${itemUrl(post)}">${window.GokottaMedia.image(post.cover, `${post.title}封面`, { loading: "lazy", sizes: "(max-width: 760px) 100vw, 180px" })}</a>
        <div>
          <div class="lesson-row-meta">
            <span class="category-pill">${escapeHtml(post.category)}</span>
            <span>${escapeHtml(post.date)}</span>
          </div>
          <h3><a href="${itemUrl(post)}">${escapeHtml(post.title)}</a></h3>
          <p>${escapeHtml(post.excerpt)}</p>
          <div class="card-footer"><span>${escapeHtml(post.readTime)}</span><a class="card-link" href="${itemUrl(post)}">进入课程</a></div>
        </div>
      </article>
    `;
  }

  function projectPanelCard(project) {
    const online = project.statusKey === "online";
    const titleMarkup = online ? `<a href="${projectUrl(project)}">${escapeHtml(project.title)}</a>` : escapeHtml(project.title);
    const actionMarkup = online
      ? `<a class="card-link" href="${projectUrl(project)}">查看详情</a>`
      : `<span class="card-note">内容持续补齐中</span>`;

    return `
      <article class="route-project-card ${online ? "" : "is-planned"}">
        ${window.GokottaMedia.image(project.cover, `${project.title}项目图片`, { loading: "lazy", sizes: "(max-width: 1100px) 100vw, 280px" })}
        <div class="route-project-copy">
          <span class="status">${escapeHtml(project.status)}</span>
          <h3>${titleMarkup}</h3>
          <p>${escapeHtml(project.summary)}</p>
          <div class="card-footer">
            <span>${escapeHtml(project.license)}</span>
            <span>★ ${escapeHtml(project.stars)}</span>
            ${actionMarkup}
          </div>
        </div>
      </article>
    `;
  }

  function buildEmptyState(state, featurePost) {
    const cta = featurePost ? `<a class="button secondary" href="${itemUrl(featurePost)}">先看学习起点</a>` : "";
    const visibleProjects = state.keyword ? state.matchedProjects : routeProjects;
    const visibleProjectCount = Math.min(visibleProjects.length, 3);
    const hasMoreProjects = visibleProjects.length > visibleProjectCount;
    const projectHint = visibleProjectCount
      ? `<span>右侧已展示 ${visibleProjectCount} 个相关开源项目${hasMoreProjects ? "，更多项目可进入开源项目页查看。" : "，可先从这些项目继续进入。"}</span>`
      : `<span>当前先保留课程结构，待内容接入后继续补齐正文。</span>`;

    if (!items.length) {
      return `
        <section class="empty-state empty-state-rich">
          <div class="empty-state-copy">
            <strong>本分类正文正在接入中</strong>
            <p>当前先展示课程骨架、推荐起点和相关项目，内容接入后会继续补齐到这一页。</p>
            <div class="empty-state-actions">
              ${projectHint}
            </div>
          </div>
        </section>
      `;
    }

    if (state.keyword && state.metaMatched) {
      const matchedBits = [
        state.matchedStages.length ? `阶段：${escapeHtml(state.matchedStages.join("、"))}` : "",
        state.matchedKeywords.length ? `关键词：${escapeHtml(state.matchedKeywords.join("、"))}` : "",
        state.matchedRecommended.length ? `推荐内容：${escapeHtml(state.matchedRecommended.map((item) => item.title).join("、"))}` : ""
      ]
        .filter(Boolean)
        .join("；");

      return `
        <section class="empty-state empty-state-rich">
          <div class="empty-state-copy">
            <strong>正文暂时没有与“${escapeHtml(state.keyword)}”直接匹配的更多条目</strong>
            <p>已为你保留匹配到的阶段、推荐内容和项目入口，当前可以先沿着这条路线继续进入。</p>
            <div class="empty-state-actions">
              ${cta}
              ${matchedBits ? `<span>${matchedBits}</span>` : projectHint}
            </div>
          </div>
        </section>
      `;
    }

    if (state.keyword) {
      return `
        <section class="empty-state empty-state-rich">
          <div class="empty-state-copy">
            <strong>没有找到与“${escapeHtml(state.keyword)}”匹配的更多正文</strong>
            <p>当前先保留推荐学习起点，后续课程正文会继续补齐；你也可以先从相关项目进入。</p>
            <div class="empty-state-actions">
              ${cta}
              ${projectHint}
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="empty-state empty-state-rich">
        <div class="empty-state-copy">
          <strong>当前先展示推荐学习起点</strong>
          <p>这个分类已经有起点文章，更多课程正文正在整理中，后续会继续补齐到列表里。</p>
          <div class="empty-state-actions">
            ${cta}
            ${projectHint}
          </div>
        </div>
      </section>
    `;
  }

  function renderFeature(post) {
    if (!post) {
      featureNode.innerHTML = "";
      featureNode.hidden = true;
      return;
    }

    featureNode.hidden = false;
    featureNode.innerHTML = `
      <div class="lesson-feature-copy">
        <div class="lesson-row-meta">
          <span class="category-pill">${escapeHtml(post.category)}</span>
          <span>推荐学习起点</span>
        </div>
        <h2><a href="${itemUrl(post)}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="card-footer"><span>${escapeHtml(post.readTime)}</span><span>${escapeHtml(post.date)}</span></div>
      </div>
      <a class="lesson-feature-media" href="${itemUrl(post)}">${window.GokottaMedia.image(post.cover, `${post.title}封面`, { loading: "lazy", sizes: "(max-width: 760px) 100vw, 360px" })}</a>
    `;
  }

  function renderSyllabus(state) {
    if (key === "all") {
      syllabusNode.innerHTML = `
        <h2>方向筛选</h2>
        <p>从全部教程进入，或者直接切换到某一条学习路线。</p>
        <div class="syllabus-list">
          ${(courseMeta.all?.routeFilters || [])
            .map((item) => `<a class="syllabus-chip ${item.key === key ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>`)
            .join("")}
        </div>
      `;
      return;
    }

    syllabusNode.innerHTML = `
      <h2>课程大纲</h2>
      <p>${escapeHtml(meta.english || "")}</p>
      <div class="syllabus-list">
        ${(meta.stages || [])
          .map((stage, index) => {
            const selected = state.keyword && String(stage).toLowerCase() === state.keyword.toLowerCase();
            const matched = state.keyword && state.matchedStages.includes(stage);
            const stateClass = selected ? "is-selected" : matched ? "is-active" : "";
            return `<button class="syllabus-chip ${stateClass}" type="button" data-stage="${escapeHtml(stage)}"><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(stage)}</button>`;
          })
          .join("")}
      </div>
      <div class="syllabus-hint">当前阶段先呈现课程骨架、推荐起点与开源项目；正文进入后会在这一页继续补齐。</div>
    `;
  }

  function renderPanel(state) {
    if (key === "all") {
      panelNode.innerHTML = `
        <h2>推荐路线</h2>
        <p>${escapeHtml(meta.resourcesSummary || meta.summary || "")}</p>
        <div class="resource-link-list">
          ${(courseMeta.all?.routeFilters || [])
            .filter((item) => item.key !== "all")
            .map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`)
            .join("")}
        </div>
      `;
      return;
    }

    const projectsToRender = state.keyword ? state.matchedProjects : routeProjects;
    const note = state.keyword && state.metaMatched
      ? [
          state.matchedResources.length ? `工具：${escapeHtml(state.matchedResources.join("、"))}` : "",
          state.matchedKeywords.length ? `关键词：${escapeHtml(state.matchedKeywords.join("、"))}` : "",
          state.matchedRecommended.length ? `推荐：${escapeHtml(state.matchedRecommended.map((item) => item.title).join("、"))}` : ""
        ]
          .filter(Boolean)
          .join("；")
      : "";

    panelNode.innerHTML = `
      <h2>相关开源项目</h2>
      <p>${
        state.keyword
          ? `已根据“${escapeHtml(state.keyword)}”筛选当前路线的课程与项目。${note ? ` ${note}` : ""}`
          : "这里不再放工具栏，直接按开源项目布局承接这一条路线；相关项目会排在前面，其余项目也会继续列出。"
      }</p>
      <div class="route-project-list">
        ${
          projectsToRender.length
            ? projectsToRender.slice(0, 3).map(projectPanelCard).join("")
            : `<div class="empty-state empty-state-panel"><strong>当前没有匹配项目</strong><p>可以先从左侧课程骨架和学习起点进入，项目会继续并行补齐。</p></div>`
        }
      </div>
      ${
        routeProjects.length > 3
          ? `<div class="resource-group route-reading-group"><strong>更多项目</strong><div class="resource-link-list"><a href="./projects.html">查看全部开源项目</a></div></div>`
          : ""
      }
      ${
        recommended.length
          ? `<div class="resource-group route-reading-group"><strong>推荐阅读</strong><div class="resource-link-list">${recommended
              .map((item) => {
                const href = item.type === "project" || item.status ? projectUrl(item) : itemUrl(item);
                const active = state.keyword && state.matchedRecommended.some((entry) => entry.id === item.id);
                return `<a href="${href}"${active ? ' class="is-active"' : ""}>${escapeHtml(item.title)}</a>`;
              })
              .join("")}</div></div>`
          : ""
      }
    `;
  }

  function renderPage(keyword = "") {
    const state = buildSearchState(keyword);
    const featurePost = state.matchedPosts[0] || items[0] || null;
    const visibleRows = state.matchedPosts.filter((post) => !featurePost || post.id !== featurePost.id);

    renderFeature(featurePost);
    renderSyllabus(state);
    listNode.innerHTML = visibleRows.length ? visibleRows.map(lessonRow).join("") : buildEmptyState(state, featurePost);
    renderPanel(state);
  }

  document.body.dataset.pageTheme = CATEGORY_MAP[key] ? key : "analog";
  document.title = `${category} | GokottaMaker`;
  document.querySelector('meta[name="description"]').setAttribute("content", description);
  titleNode.textContent = category;
  titleEnNode.textContent = ENGLISH_MAP[key] || ENGLISH_MAP.analog;
  summaryNode.textContent = `${description} 当前共 ${items.length} 篇内容。`;

  if (searchLabelNode) searchLabelNode.textContent = "\u641c\u7d22\u672c\u5206\u7c7b";
  if (searchNode) searchNode.placeholder = "\u641c\u7d22\u8bfe\u7a0b\u3001\u9879\u76ee\u3001\u5173\u952e\u8bcd...";
  if (returnLinkNode) returnLinkNode.textContent = "\u8fd4\u56de\u9996\u9875";

  if (searchNode && initialKeyword) searchNode.value = initialKeyword;
  renderPage(initialKeyword);

  if (searchNode) {
    searchNode.addEventListener("input", () => {
      renderPage(searchNode.value.trim());
    });
  }

  syllabusNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage]");
    if (!button || !searchNode) return;
    const stage = button.dataset.stage || "";
    const nextValue = searchNode.value.trim().toLowerCase() === stage.toLowerCase() ? "" : stage;
    searchNode.value = nextValue;
    renderPage(nextValue);
  });
})();
