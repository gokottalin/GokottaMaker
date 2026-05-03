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
      .replace(/\b(const|let|var|for|if|else|return|void|uint16_t|uint32_t|define|include|HAL_ADC_Start_DMA)\b/g, '<span class="token-keyword">$1</span>')
      .replace(/(".*?"|'.*?')/g, '<span class="token-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\.\/[^)\s]+|\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\.\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function render(markdown) {
    const headings = [];
    const blocks = [];
    const lines = String(markdown || "").split(/\r?\n/);
    let paragraph = [];
    let list = [];
    let quote = [];
    let inCode = false;
    let codeLang = "";
    let code = [];

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

    function flushQuote() {
      if (!quote.length) return;
      blocks.push(`<blockquote>${quote.map((item) => `<p>${inline(item)}</p>`).join("")}</blockquote>`);
      quote = [];
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
          flushQuote();
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
        flushQuote();
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();
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
        flushQuote();
        list.push(listItem[1]);
        continue;
      }

      const quoteItem = line.match(/^>\s+(.+)$/);
      if (quoteItem) {
        flushParagraph();
        flushList();
        quote.push(quoteItem[1]);
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushQuote();
    return { html: blocks.join("\n"), headings };
  }

  window.GokottaMarkdown = { render, escapeHtml };
})();
