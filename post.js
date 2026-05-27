(function () {
  function escapeHtml(value) {
    return window.LarkixMarkdown.escapeHtml(value);
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
    const canonical = absoluteUrl(`${location.pathname}?id=${encodeURIComponent(item.slug || item.id)}`);
    const image = absoluteUrl(item.cover || "./assets/logo/larkix/rocket-bird-final/larkix-rocket-bird-final-icon.svg?v=transparent-20260524");
    const structuredType = item.type === "project" ? "CreativeWork" : "TechArticle";

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
      datePublished: item.date || undefined,
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
    if (item.type === "project") return "Open Hardware Project";
    const map = {
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

    const tocLinks = [...toc.querySelectorAll("a")];
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

  window.renderMarkdownPage = function renderMarkdownPage(options) {
    const id = new URLSearchParams(location.search).get("id");
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
      ${window.LarkixMedia.image(item.cover, `${item.title}封面`, { loading: "eager", sizes: "100vw", fetchPriority: "high" })}
      <div class="post-hero-content">
        <span class="category-pill">${escapeHtml(item.category || item.status)}</span>
        <div class="section-title-block split-title post-title-block">
          <h1>${escapeHtml(item.title)}</h1>
          <span>${escapeHtml(titleEnglish(item))}</span>
        </div>
        <p>${escapeHtml(item.excerpt || item.summary)}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.readTime || item.license)}</span>
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

    const parsed = window.LarkixMarkdown.render(item.markdown);
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
    window.renderMarkdownPage({
      collection: window.LarkixContent.getPosts(),
      heroId: "postHero",
      contentId: "postContent",
      tocId: "tocList"
    });
  }
})();
