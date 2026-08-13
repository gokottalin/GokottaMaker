(function () {
  function focusModeEnabled() {
    return window.LARKIX_SERVER_CONTENT?.publicFocusMode?.enabled === true;
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
      { href: "./projects.html", label: "开源项目" }
    ];
    document.querySelectorAll(".site-header .main-nav").forEach((nav) => {
      nav.classList.add("focus-mode-nav");
      nav.innerHTML = links
        .map((link) => `<a href="${link.href}"${isCurrentHref(link.href) ? ' aria-current="page"' : ""}>${link.label}</a>`)
        .join("");
    });
  }

  function escapeHtml(value) {
    return window.LarkixMarkdown.escapeHtml(value);
  }

  function readingMinutesLabel(value) {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 9999 ? `${minutes} 分钟阅读` : "";
  }

  function primaryMeta(item) {
    return item.type === "post" ? readingMinutesLabel(item.readingMinutes) : item.license || "";
  }

  function optionalMeta(value) {
    return value ? `<span>${escapeHtml(value)}</span>` : "";
  }

  function formulaSymbolHtml(value) {
    const source = String(value || "");
    return source
      .split(/\s*\/\s*/)
      .map((part) => {
        const math = window.LarkixMarkdown.dottedSubscriptMath(part);
        return math === part ? escapeHtml(part) : window.LarkixMarkdown.inline(`$${math}$`);
      })
      .join(" / ");
  }

  function absoluteUrl(value) {
    return new URL(value || location.pathname, location.href).href;
  }

  function setHeadElement(selector, tagName, attributes) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement(tagName);
      document.head.appendChild(element);
    }
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function syncSeo(item) {
    const description = item.excerpt || item.summary || "LarkixMaker 技术内容。";
    const canonical =
      item.canonicalPath ||
      absoluteUrl(
        `${location.pathname}?${item.type === "formula_card" ? "formula" : item.type === "knowledge_node" ? "slug" : "id"}=${encodeURIComponent(
          item.slug || item.id
        )}`
      );
    const image = absoluteUrl(item.cover || "./assets/logo/larkix/rocket-bird-final/larkix-rocket-bird-final-icon.svg?v=transparent-20260524");
    const structuredType =
      item.type === "project" ? "CreativeWork" : ["knowledge_node", "formula_card"].includes(item.type) ? "LearningResource" : "TechArticle";

    document.title = `${item.title} | LarkixMaker`;
    setHeadElement('meta[name="description"]', "meta", { name: "description", content: description });
    setHeadElement('link[rel="canonical"]', "link", { rel: "canonical", href: canonical });
    setHeadElement('meta[property="og:title"]', "meta", { property: "og:title", content: `${item.title} | LarkixMaker` });
    setHeadElement('meta[property="og:description"]', "meta", { property: "og:description", content: description });
    setHeadElement('meta[property="og:type"]', "meta", { property: "og:type", content: "article" });
    setHeadElement('meta[property="og:url"]', "meta", { property: "og:url", content: canonical });
    setHeadElement('meta[property="og:image"]', "meta", { property: "og:image", content: image });

    const jsonLd = setHeadElement('script[type="application/ld+json"][data-larkix-seo]', "script", {
      type: "application/ld+json",
      "data-larkix-seo": "true"
    });
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": structuredType,
      headline: item.title,
      name: item.title,
      description,
      image,
      url: canonical,
      datePublished: item.date || item.publishedAt || undefined,
      dateModified: item.updatedAt || undefined,
      keywords: item.tags || undefined,
      license: item.license || undefined,
      author: {
        "@type": "Person",
        name: "LarkixMaker"
      },
      publisher: {
        "@type": "Organization",
        name: "LarkixMaker"
      }
    });
  }

  function titleEnglish(item) {
    if (item.type === "formula_card") return "Formula Card";
    if (item.type === "knowledge_node") return "Derivation Note";
    if (item.type === "knowledge_index") return "Derivation Index";
    if (item.type === "project") return "Open Hardware Project";
    const map = {
      "电子基础": "Electronics Basics",
      "电力电子": "Electronics Basics",
      "模拟电子": "Analog Electronics",
      STM32: "STM32 Lab",
      ESP32: "ESP32 Systems",
      "开源项目": "Open Projects"
    };
    return map[item.category] || "Technical Note";
  }

  function tagSet(item) {
    return new Set(
      String(item.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
  }

  function tagList(item) {
    return [...tagSet(item)];
  }

  function renderTagChips(item) {
    const tags = tagList(item);
    if (!tags.length) return "";
    return `
      <div class="tag-list" aria-label="内容标签">
        ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  }

  function itemUrl(item) {
    if (item.href) return item.href;
    if (item.type === "knowledge_node") return `./derive.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const page = item.type === "project" ? "project.html" : "post.html";
    return `./${page}?id=${encodeURIComponent(item.slug || item.id)}`;
  }

  function itemLabel(item) {
    return item.category || item.status || (item.type === "project" ? "开源项目" : "技术文章");
  }

  function relatedItems(current) {
    const currentTags = tagSet(current);
    const candidates = [...window.LarkixContent.getPosts(), ...window.LarkixContent.getProjects()].filter((item) => {
      if (!item || item.id === current.id) return false;
      if (item.type === "project" && item.statusKey !== "online") return false;
      return true;
    });

    return candidates
      .map((item) => {
        const tags = tagSet(item);
        let score = 0;
        tags.forEach((tag) => {
          if (currentTags.has(tag)) score += 4;
        });
        if (current.categoryKey && current.categoryKey === item.categoryKey) score += 3;
        if (current.type === item.type) score += 1;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item);
  }

  function renderRelated(current) {
    const items = relatedItems(current);
    if (!items.length) return "";
    return `
      <section class="related-content" aria-labelledby="relatedContentTitle">
        <div class="related-heading">
          <h2 id="relatedContentTitle">相关推荐</h2>
        </div>
        <div class="related-grid">
          ${items
            .map(
              (item) => `
                <article class="related-item">
                  <span class="category-pill">${escapeHtml(itemLabel(item))}</span>
                  <h3><a href="${itemUrl(item)}">${escapeHtml(item.title)}</a></h3>
                  <p>${escapeHtml(item.excerpt || item.summary || "")}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function enhanceReading(content, toc) {
    let progress = document.querySelector(".reading-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "reading-progress";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = '<span class="reading-progress-bar"></span>';
      document.body.prepend(progress);
    }

    const bar = progress.querySelector("span");
    const updateProgress = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    const tocLinks = toc ? [...toc.querySelectorAll("a")] : [];
    const headings = tocLinks
      .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
      .filter(Boolean);
    if ("IntersectionObserver" in window && headings.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          if (!visible) return;
          tocLinks.forEach((link) => link.classList.toggle("is-active", link.hash === `#${visible.target.id}`));
        },
        { rootMargin: "-18% 0px -72% 0px", threshold: 0.01 }
      );
      headings.forEach((heading) => observer.observe(heading));
    }

    content.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      const button = document.createElement("button");
      button.className = "code-copy";
      button.type = "button";
      button.textContent = "复制";
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
          button.textContent = "已复制";
          window.setTimeout(() => {
            button.textContent = "复制";
          }, 1400);
        } catch {
          button.textContent = "复制失败";
        }
      });
      pre.append(button);
    });

    let lightbox = document.querySelector(".image-lightbox");
    if (!lightbox) {
      lightbox = document.createElement("button");
      lightbox.type = "button";
      lightbox.className = "image-lightbox";
      lightbox.setAttribute("aria-label", "关闭图片预览");
      lightbox.innerHTML = '<img alt="" />';
      document.body.append(lightbox);
      lightbox.addEventListener("click", () => {
        lightbox.classList.remove("is-open");
        lightbox.querySelector("img")?.removeAttribute("src");
      });
    }
    const lightboxImg = lightbox.querySelector("img");
    content.querySelectorAll("img").forEach((img) => {
      img.classList.add("can-preview");
      img.addEventListener("click", () => {
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt || "文章图片预览";
        lightbox.classList.add("is-open");
      });
    });
  }

  const knowledgeSlugPattern = /^[a-z0-9][a-z0-9-]{1,79}$/;
  const fallbackDeriveCover = "./assets/hero/electronics-lab-hero.png";

  function statePanelHtml(title, message, actions = []) {
    return `
      <section class="empty-state empty-state-rich">
        <div class="empty-state-copy">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(message)}</p>
          ${
            actions.length
              ? `<div class="empty-state-actions">${actions
                  .map((action) => `<a class="button ${action.primary ? "primary" : "secondary"}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
                  .join("")}</div>`
              : ""
          }
        </div>
      </section>
    `;
  }

  function statusToTitle(status) {
    if (status === "loading") return "正在加载推导节点";
    if (status === "empty") return "还没有公开推导节点";
    if (status === "missing-slug") return "缺少推导节点标识";
    if (status === "invalid-slug") return "推导节点标识格式不正确";
    if (status === "not-found") return "推导节点未发布或不存在";
    return "暂时无法打开推导节点";
  }

  function renderDeriveState(hero, content, toc, status, message) {
    const title = statusToTitle(status);
    document.title = `${title} | LarkixMaker`;
    if (hero) {
      hero.innerHTML = `
        ${window.LarkixMedia.image(fallbackDeriveCover, "电子实验台背景", { loading: "eager", sizes: "100vw", fetchPriority: "high" })}
        <div class="post-hero-content derive-hero-content">
          <span class="category-pill">公式推导</span>
          <div class="section-title-block split-title post-title-block">
            <h1>${escapeHtml(title)}</h1>
            <span>Derivation Note</span>
          </div>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
    if (content) {
      content.innerHTML = statePanelHtml(title, message, [
        { href: "./maker.html", label: "返回首页", primary: true },
        { href: "./category.html?category=power-electronics", label: "电力电子入口" }
      ]);
    }
    if (toc) toc.innerHTML = "";
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.map((tag) => String(tag || "").trim()).filter(Boolean);
    return String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function formatNodeDate(node) {
    const source = node.publishedAt || node.updatedAt || node.createdAt || "";
    if (!source) return "";
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return String(source).slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  function normalizeKnowledgeNode(node) {
    return {
      ...node,
      id: node.id || node.slug,
      slug: node.slug || node.id,
      type: "knowledge_node",
      category: node.symbol || "公式推导",
      excerpt: node.summary || "",
      readTime: node.symbol || "Derivation",
      date: formatNodeDate(node),
      cover: node.cover || fallbackDeriveCover
    };
  }

  function renderKnowledgeNodeHero(hero, node) {
    if (!hero) return;
    hero.innerHTML = `
      ${window.LarkixMedia.image(node.cover || fallbackDeriveCover, `${node.title}封面`, { loading: "eager", sizes: "100vw", fetchPriority: "high" })}
      <div class="post-hero-content derive-hero-content derive-accent-${escapeHtml(node.accentColor || "purple")}">
        <span class="category-pill derive-symbol">${formulaSymbolHtml(node.symbol || "公式推导")}</span>
        <div class="section-title-block split-title post-title-block">
          <h1>${escapeHtml(node.title)}</h1>
          <span>${escapeHtml(titleEnglish(node))}</span>
        </div>
        <p>${escapeHtml(node.summary || "这个推导节点暂时没有摘要。")}</p>
        <div class="meta-row derive-meta-row">
          <span>${escapeHtml(node.visibilityStatus === "unlisted" ? "直接链接可见" : "公开发布")}</span>
          ${node.date ? `<span>${escapeHtml(node.date)}</span>` : ""}
          ${node.nodeType ? `<span>${escapeHtml(node.nodeType === "derivation" ? "公式推导" : node.nodeType)}</span>` : ""}
        </div>
        ${renderTagChips(node)}
      </div>
    `;
  }

  function renderDeriveLinkCard(link, kind) {
    const linkedNode = kind === "backlink" ? link.source : link.target;
    const slug = linkedNode?.slug || link.targetSlug || link.sourceSlug || "";
    const title = linkedNode?.title || link.label || slug;
    const symbol = linkedNode?.symbol || link.label || (kind === "backlink" ? "引用来源" : "推导目标");
    const resolved = Boolean(linkedNode) && link.resolved !== false;
    const color = link.colorToken || linkedNode?.accentColor || "purple";
    return `
      <article class="derive-link-card ${resolved ? "" : "is-unavailable"}">
        <span class="knowledge-color-dot knowledge-color-dot--${escapeHtml(color)}" aria-hidden="true"></span>
        <div>
          <span class="derive-link-kicker">${formulaSymbolHtml(symbol)}</span>
          <h3>
            ${
              resolved && slug
                ? `<a href="./derive.html?slug=${encodeURIComponent(slug)}">${escapeHtml(title)}</a>`
                : `<span>${escapeHtml(title || "待补齐推导节点")}</span>`
            }
          </h3>
          <p>${escapeHtml(resolved ? slug : `缺失或未公开：${slug || "unknown"}`)}</p>
        </div>
      </article>
    `;
  }

  function renderDeriveLinkPanels(node) {
    const links = Array.isArray(node.links) ? node.links : [];
    const backlinks = Array.isArray(node.backlinks) ? node.backlinks : [];
    if (!links.length && !backlinks.length) {
      return `
        <section class="derive-link-panel" aria-labelledby="deriveGraphTitle">
          <div class="related-heading">
            <h2 id="deriveGraphTitle">推导关联</h2>
          </div>
          ${statePanelHtml("暂无关联节点", "这个推导节点还没有公开出链或反向引用。")}
        </section>
      `;
    }
    return `
      <section class="derive-link-panel" aria-labelledby="deriveGraphTitle">
        <div class="related-heading">
          <h2 id="deriveGraphTitle">推导关联</h2>
        </div>
        ${
          links.length
            ? `<div class="derive-link-group"><strong>继续推导</strong><div class="derive-link-list">${links.map((link) => renderDeriveLinkCard(link, "link")).join("")}</div></div>`
            : ""
        }
        ${
          backlinks.length
            ? `<div class="derive-link-group"><strong>反向引用</strong><div class="derive-link-list">${backlinks.map((link) => renderDeriveLinkCard(link, "backlink")).join("")}</div></div>`
            : ""
        }
      </section>
    `;
  }

  function renderKnowledgeNodeCards(nodes) {
    return nodes
      .map((node) => {
        const item = normalizeKnowledgeNode(node);
        const tags = normalizeTags(item.tags)
          .slice(0, 4)
          .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
          .join("");
        return `
          <article class="derive-node-card derive-accent-${escapeHtml(item.accentColor || "purple")}">
            <span class="derive-node-symbol">${formulaSymbolHtml(item.symbol || "Derivation")}</span>
            <h3><a href="./derive.html?slug=${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></h3>
            <p>${escapeHtml(item.summary || "")}</p>
            ${tags ? `<div class="tag-list">${tags}</div>` : ""}
          </article>
        `;
      })
      .join("");
  }

  async function renderKnowledgeNodeIndex(options) {
    const hero = document.querySelector(`#${options.heroId}`);
    const content = document.querySelector(`#${options.contentId}`);
    const toc = document.querySelector(`#${options.tocId}`);
    const indexItem = {
      id: "derivations",
      slug: "derivations",
      type: "knowledge_index",
      title: "公式推导节点",
      summary: "围绕电力电子变量、公式和工程边界整理的公开推导节点。",
      cover: fallbackDeriveCover,
      canonicalPath: absoluteUrl(location.pathname)
    };
    syncSeo(indexItem);
    if (hero) {
      hero.innerHTML = `
        ${window.LarkixMedia.image(fallbackDeriveCover, "电子实验台背景", { loading: "eager", sizes: "100vw", fetchPriority: "high" })}
        <div class="post-hero-content derive-hero-content">
          <span class="category-pill">Derivations</span>
          <div class="section-title-block split-title post-title-block">
            <h1>公式推导节点</h1>
            <span>Derivation Index</span>
          </div>
          <p>围绕电力电子变量、公式和工程边界整理的公开推导节点。</p>
        </div>
      `;
    }
    if (toc) toc.innerHTML = "";
    if (!content) return;
    content.innerHTML = statePanelHtml("正在加载推导节点", "正在读取公开推导节点列表。");
    try {
      const response = await fetch("./api/knowledge-nodes", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      content.innerHTML = nodes.length
        ? `<section class="derive-node-list" aria-label="公开推导节点">${renderKnowledgeNodeCards(nodes)}</section>`
        : statePanelHtml("还没有公开推导节点", "公开推导节点发布后会显示在这里。", [{ href: "./category.html?category=power-electronics", label: "电力电子入口", primary: true }]);
    } catch {
      content.innerHTML = statePanelHtml("暂时无法读取推导节点", "请稍后重试，或返回电力电子入口继续浏览。", [
        { href: "./derive.html", label: "重新加载", primary: true },
        { href: "./category.html?category=power-electronics", label: "电力电子入口" }
      ]);
    }
  }

  function renderFormulaState(hero, content, toc, title, message) {
    document.title = `${title} | LarkixMaker`;
    if (hero) {
      hero.innerHTML = `
        ${window.LarkixMedia.image(fallbackDeriveCover, "电子实验台背景", { loading: "eager", sizes: "100vw", fetchPriority: "high" })}
        <div class="post-hero-content derive-hero-content">
          <span class="category-pill">公式卡</span>
          <div class="section-title-block split-title post-title-block">
            <h1>${escapeHtml(title)}</h1>
            <span>Formula Card</span>
          </div>
          <p>${escapeHtml(message)}</p>
        </div>`;
    }
    if (content) {
      content.innerHTML = statePanelHtml(title, message, [
        { href: "./category.html?category=power-electronics", label: "返回电力电子", primary: true }
      ]);
    }
    if (toc) toc.innerHTML = "";
  }

  function renderFormulaRelationItem(card, label) {
    if (!card) {
      return `<div class="formula-derivation-empty">${escapeHtml(label)}</div>`;
    }
    const available = card.available !== false && card.archiveState !== "archived";
    const inner = `
      <span>${escapeHtml(available ? "可继续访问" : "已归档 · 链路中断")}</span>
      <strong>${escapeHtml(card.displayName || card.formulaId)}</strong>
      <code>${escapeHtml(card.formulaId)}</code>`;
    return available
      ? `<a class="formula-derivation-link" href="./derive.html?formula=${encodeURIComponent(card.slug)}">${inner}</a>`
      : `<div class="formula-derivation-link is-unavailable" aria-label="${escapeHtml(
          `${card.displayName || card.formulaId} 已归档，推导链路中断`
        )}">${inner}</div>`;
  }

  function renderFormulaDerivationSection(card) {
    const derivation = card.derivation || { incoming: [], dependencies: [] };
    const incoming = derivation.incoming || [];
    const dependencies = derivation.dependencies || [];
    const unavailableDependencyCount = Number(derivation.unavailableDependencyCount || 0);
    return `
      <section class="formula-derivation-public" aria-labelledby="formulaDerivationTitle">
        <h2 id="formulaDerivationTitle">逐步推导</h2>
        <p>关系方向统一为“来源公式 → 依赖公式”；这里仅展示两端均已发布且未归档的修订。</p>
        <div class="formula-derivation-public-grid">
          <section aria-labelledby="formulaPreviousTitle">
            <h3 id="formulaPreviousTitle">引用本式的来源</h3>
            <div class="formula-derivation-public-list">
              ${
                incoming.length
                  ? incoming.map((source) => renderFormulaRelationItem(source, "")).join("")
                  : renderFormulaRelationItem(null, "暂无已发布公式引用本式。")
              }
            </div>
          </section>
          <section aria-labelledby="formulaNextStepTitle">
            <h3 id="formulaNextStepTitle">本式依赖</h3>
            <div class="formula-derivation-public-list">
              ${
                dependencies.length
                  ? dependencies.map((target) => renderFormulaRelationItem(target, "")).join("")
                  : renderFormulaRelationItem(null, "暂无可继续访问的已发布依赖。")
              }
              ${
                unavailableDependencyCount
                  ? `<div class="formula-derivation-empty">另有未公开或已归档依赖，游客端不继续遍历。</div>`
                  : ""
              }
            </div>
          </section>
        </div>
      </section>`;
  }

  function renderFormulaGraphSection(card) {
    const graph = card.graph || {};
    const nodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    return `
      <section class="formula-graph-public" aria-labelledby="formulaGraphTitle">
        <div class="formula-graph-heading">
          <div>
            <h2 id="formulaGraphTitle">推导网络</h2>
            <p>上方为引用本式的推导，当前公式居中，下方为本式依赖。</p>
          </div>
          <span>${escapeHtml(nodeCount)} 个关联节点</span>
        </div>
        <div id="publicFormulaGraph" class="formula-graph-host"></div>
      </section>`;
  }

  async function renderFormulaCardPage(options, slug) {
    const hero = document.querySelector(`#${options.heroId}`);
    const content = document.querySelector(`#${options.contentId}`);
    const toc = document.querySelector(`#${options.tocId}`);
    if (!knowledgeSlugPattern.test(slug)) {
      renderFormulaState(hero, content, toc, "公式卡标识无效", "链接中的公式卡 slug 格式不正确。");
      return;
    }
    renderFormulaState(hero, content, toc, "正在加载公式卡", "正在读取已发布公式修订。");
    try {
      const response = await fetch(`./api/formulas/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (response.status === 404) {
        renderFormulaState(hero, content, toc, "公式卡不可用", "此公式卡不存在、仍为草稿或已经归档。");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const card = payload.card;
      if (!card) {
        renderFormulaState(hero, content, toc, "公式卡不可用", "此公式卡不存在、仍为草稿或已经归档。");
        return;
      }
      const item = {
        ...card,
        id: card.slug,
        type: "formula_card",
        title: card.displayName,
        excerpt: card.purpose || `${card.moduleKey} / ${card.categoryPath}`,
        tags: card.tags || [],
        cover: fallbackDeriveCover,
        date: formatNodeDate(card)
      };
      syncSeo(item);
      if (hero) {
        hero.innerHTML = `
          ${window.LarkixMedia.image(fallbackDeriveCover, `${escapeHtml(card.displayName)}封面`, {
            loading: "eager",
            sizes: "100vw",
            fetchPriority: "high"
          })}
          <div class="post-hero-content derive-hero-content">
            <span class="category-pill">公式卡</span>
            <div class="section-title-block split-title post-title-block">
              <h1>${escapeHtml(card.displayName)}</h1>
              <span>Formula Card</span>
            </div>
            <p>${escapeHtml(card.purpose || "已发布公式修订。")}</p>
            <div class="meta-row derive-meta-row">
              <span>${escapeHtml(card.moduleKey)}</span>
              <span>${escapeHtml(card.categoryPath)}</span>
            </div>
            ${renderTagChips(item)}
          </div>`;
      }
      if (!content) return;
      const formulaRendered = window.LarkixMarkdown.renderFormulaCard(card);
      content.innerHTML = `
        ${renderFormulaGraphSection(card)}
        ${formulaRendered.html}
        <section aria-labelledby="formulaCardInfo">
          <h2 id="formulaCardInfo">公式信息</h2>
          <dl class="formula-card-public-meta">
            <div><dt>模块</dt><dd>${escapeHtml(card.moduleKey)}</dd></div>
            <div><dt>分类</dt><dd>${escapeHtml(card.categoryPath)}</dd></div>
            ${card.sourceBookId ? `<div><dt>来源计算书</dt><dd>${escapeHtml(card.sourceBookId)}</dd></div>` : ""}
            ${card.sourceFormulaId ? `<div><dt>来源公式</dt><dd>${escapeHtml(card.sourceFormulaId)}</dd></div>` : ""}
          </dl>
        </section>`;
      const graphHost = content.querySelector("#publicFormulaGraph");
      if (graphHost && window.LarkixFormulaGraph) {
        window.LarkixFormulaGraph.mount(graphHost, card.graph, {
          hrefPrefix: "./derive.html?formula="
        });
      }
      if (toc) {
        toc.innerHTML = `<a class="toc-level-2" data-level="2" href="#formulaGraphTitle">推导网络</a>
          ${(formulaRendered.headings || [])
          .map((heading) => {
            const level = Math.max(2, Math.min(Number(heading.level || 2), 3));
            return `<a class="toc-level-${level}" data-level="${level}" href="#${escapeHtml(heading.id)}">${escapeHtml(
              heading.text
            )}</a>`;
          })
          .join("")}
          <a class="toc-level-2" data-level="2" href="#formulaCardInfo">公式信息</a>`;
      }
      enhanceReading(content, toc);
    } catch {
      renderFormulaState(hero, content, toc, "公式卡暂时不可用", "网络或服务暂时不可用，请稍后重试。");
    }
  }

  window.renderKnowledgeNodePage = async function renderKnowledgeNodePage(options) {
    const searchParams = new URLSearchParams(location.search);
    const formulaSlug = searchParams.get("formula");
    const slug = searchParams.get("slug");
    const hero = document.querySelector(`#${options.heroId}`);
    const content = document.querySelector(`#${options.contentId}`);
    const toc = document.querySelector(`#${options.tocId}`);

    if (formulaSlug) {
      await renderFormulaCardPage(options, formulaSlug);
      return;
    }

    if (!slug) {
      await renderKnowledgeNodeIndex(options);
      return;
    }

    if (!knowledgeSlugPattern.test(slug)) {
      renderDeriveState(hero, content, toc, "invalid-slug", "推导节点链接格式不正确。");
      return;
    }

    renderDeriveState(hero, content, toc, "loading", "正在读取公开推导节点。");
    try {
      const response = await fetch(`./api/knowledge-nodes/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (response.status === 404) {
        renderDeriveState(hero, content, toc, "not-found", "这个推导节点未发布、不可公开访问，或已经不存在。");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload.node) {
        renderDeriveState(hero, content, toc, "not-found", "这个推导节点未发布、不可公开访问，或已经不存在。");
        return;
      }

      const node = normalizeKnowledgeNode(payload.node);
      syncSeo(node);
      renderKnowledgeNodeHero(hero, node);
      if (!content) return;
      if (!String(node.markdown || "").trim()) {
        content.innerHTML = `${statePanelHtml("推导正文待补齐", "这个推导节点已经公开，但正文还没有可展示内容。")}${renderDeriveLinkPanels(node)}`;
        if (toc) toc.innerHTML = "";
        return;
      }

      const parsed = window.LarkixMarkdown.render(node.markdown);
      content.innerHTML = `${parsed.html}${renderDeriveLinkPanels(node)}`;
      if (toc) {
        toc.innerHTML = parsed.headings
          .filter((heading) => heading.level > 1)
          .map((heading) => {
            const level = Math.min(4, Math.max(2, Number(heading.level) || 2));
            return `<a class="toc-level-${level}" data-level="${level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`;
          })
          .join("");
      }
      enhanceReading(content, toc);
    } catch {
      renderDeriveState(hero, content, toc, "error", "网络或服务暂时不可用，无法读取这个推导节点。");
    }
  };

  window.renderMarkdownPage = function renderMarkdownPage(options) {
    const id = new URLSearchParams(location.search).get(options.paramName || "id");
    const collection = options.collection || [];
    const item = id ? collection.find((entry) => entry.id === id || entry.slug === id) : collection[0];
    const hero = document.querySelector(`#${options.heroId}`);
    const content = document.querySelector(`#${options.contentId}`);
    const toc = document.querySelector(`#${options.tocId}`);

    if (!item) {
      if (hero) hero.innerHTML = "";
      content.innerHTML = `<div class="empty-state">没有找到内容。</div>`;
      if (toc) toc.innerHTML = "";
      return;
    }

    syncSeo(item);
    hero.innerHTML = `
      ${window.LarkixMedia.image(item.cover, `${item.title}封面`, { loading: "eager", sizes: "100vw", fetchPriority: "high", crop: item.coverCrop })}
      <div class="post-hero-content">
        <span class="category-pill">${escapeHtml(item.category || item.status)}</span>
        <div class="section-title-block split-title post-title-block">
          <h1>${escapeHtml(item.title)}</h1>
          <span>${escapeHtml(titleEnglish(item))}</span>
        </div>
        <p>${escapeHtml(item.excerpt || item.summary)}</p>
        <div class="meta-row">
          ${optionalMeta(primaryMeta(item))}
          <span>${escapeHtml(item.date || item.status)}</span>
        </div>
        ${renderTagChips(item)}
      </div>
    `;

    if (item.type === "project" && (item.repoUrl || item.bomUrl || item.docsUrl || item.version)) {
      hero.querySelector(".post-hero-content").insertAdjacentHTML(
        "beforeend",
        `<div class="meta-row">
          ${item.version ? `<span>${escapeHtml(item.version)}</span>` : ""}
          ${item.repoUrl ? `<a href="${escapeHtml(item.repoUrl)}" target="_blank" rel="noopener noreferrer">代码仓库</a>` : ""}
          ${item.bomUrl ? `<a href="${escapeHtml(item.bomUrl)}" target="_blank" rel="noopener noreferrer">BOM</a>` : ""}
          ${item.docsUrl ? `<a href="${escapeHtml(item.docsUrl)}" target="_blank" rel="noopener noreferrer">文档</a>` : ""}
        </div>`
      );
    }

    if (options.blocked && options.blocked(item)) {
      content.innerHTML = `<div class="empty-state">${escapeHtml(options.blockedMessage)}</div>`;
      toc.innerHTML = "";
      return;
    }

    const parsed = window.LarkixMarkdown.render(item.markdown, { formulaBindings: item.formulaBindings || [] });
    content.innerHTML = `${parsed.html}${renderRelated(item)}`;
    toc.innerHTML = parsed.headings
      .filter((heading) => heading.level > 1)
      .map((heading) => {
        const level = Math.min(4, Math.max(2, Number(heading.level) || 2));
        return `<a class="toc-level-${level}" data-level="${level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`;
      })
      .join("");
    enhanceReading(content, toc);
  };

  if (document.querySelector("#postContent")) {
    const renderPublicPost = () =>
      window.renderMarkdownPage({
        collection: window.LarkixContent.getPosts(),
        heroId: "postHero",
        contentId: "postContent",
        tocId: "tocList"
      });
    renderPublicPost();
    window.addEventListener("larkix:public-content-updated", renderPublicPost);
  }
  window.addEventListener("DOMContentLoaded", applyFocusedNavigation);
})();
