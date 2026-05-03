(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function highlight(code) {
    return code
      .replace(/\b(const|let|var|for|if|return|void|uint16_t|uint32_t|define|include|HAL_ADC_Start_DMA)\b/g, '<span class="token-keyword">$1</span>')
      .replace(/(".*?"|'.*?')/g, '<span class="token-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
  }

  function parseMarkdown(markdown) {
    const headings = [];
    const blocks = [];
    const lines = String(markdown || "").split(/\r?\n/);
    let paragraph = [];
    let list = [];
    let inCode = false;
    let codeLang = "";
    let code = [];

    function inline(value) {
      return escapeHtml(value)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
    }

    function flushParagraph() {
      if (!paragraph.length) return;
      blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!list.length) return;
      blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      list = [];
    }

    for (const line of lines) {
      const codeFence = line.match(/^```(.*)$/);
      if (codeFence) {
        if (inCode) {
          blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(code.join("\n")))}</code></pre>`);
          inCode = false;
          code = [];
          codeLang = "";
        } else {
          flushParagraph();
          flushList();
          inCode = true;
          codeLang = codeFence[1].trim();
        }
        continue;
      }

      if (inCode) {
        code.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        const text = heading[2].trim();
        if (level === 1) continue;
        const id = slugify(text);
        headings.push({ id, text, level });
        blocks.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
        continue;
      }

      const listItem = line.match(/^-\s+(.+)$/);
      if (listItem) {
        flushParagraph();
        list.push(listItem[1]);
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    return { html: blocks.join("\n"), headings };
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

    if (options.blocked && options.blocked(item)) {
      content.innerHTML = `<div class="empty-state">${escapeHtml(options.blockedMessage)}</div>`;
      toc.innerHTML = "";
      return;
    }

    const parsed = parseMarkdown(item.markdown);
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
