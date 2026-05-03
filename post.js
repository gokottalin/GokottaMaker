(function () {
  function escapeHtml(value) {
    return window.GokottaMarkdown.escapeHtml(value);
  }

  window.renderMarkdownPage = function renderMarkdownPage(options) {
    const id = new URLSearchParams(location.search).get("id");
    const collection = options.collection || [];
    const item = collection.find((entry) => entry.id === id || entry.slug === id) || collection[0];
    const hero = document.querySelector(`#${options.heroId}`);
    const content = document.querySelector(`#${options.contentId}`);
    const toc = document.querySelector(`#${options.tocId}`);

    if (!item) {
      content.innerHTML = `<div class="empty-state">没有找到内容。</div>`;
      return;
    }

    document.title = `${item.title} | GokottaMaker`;
    hero.innerHTML = `
      <img src="${item.cover}" alt="${escapeHtml(item.title)}封面" />
      <div class="post-hero-content">
        <span class="category-pill">${escapeHtml(item.category || item.status)}</span>
        <h1>${escapeHtml(item.title)}</h1>
        <p>${escapeHtml(item.excerpt || item.summary)}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.readTime || item.license)}</span>
          <span>${escapeHtml(item.date || item.status)}</span>
        </div>
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

    const parsed = window.GokottaMarkdown.render(item.markdown);
    content.innerHTML = parsed.html;
    toc.innerHTML = parsed.headings
      .filter((heading) => heading.level > 1)
      .map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
      .join("");
  };

  if (document.querySelector("#postContent")) {
    window.renderMarkdownPage({
      collection: window.GokottaContent.getPosts(),
      heroId: "postHero",
      contentId: "postContent",
      tocId: "tocList"
    });
  }
})();
