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
    const source = String(code || "");
    const keywordPattern =
      /\b(const|let|var|for|if|else|return|void|uint16_t|uint32_t|define|include|HAL_ADC_Start_DMA)\b/y;
    const numberPattern = /\b\d+\b/y;
    const stringPattern = /(&quot;.*?&quot;|&#039;.*?&#039;)/y;
    let output = "";
    let index = 0;

    while (index < source.length) {
      stringPattern.lastIndex = index;
      keywordPattern.lastIndex = index;
      numberPattern.lastIndex = index;

      const stringMatch = stringPattern.exec(source);
      if (stringMatch) {
        output += `<span class="token-string">${stringMatch[0]}</span>`;
        index += stringMatch[0].length;
        continue;
      }

      const keywordMatch = keywordPattern.exec(source);
      if (keywordMatch) {
        output += `<span class="token-keyword">${keywordMatch[0]}</span>`;
        index += keywordMatch[0].length;
        continue;
      }

      const numberMatch = numberPattern.exec(source);
      if (numberMatch) {
        output += `<span class="token-number">${numberMatch[0]}</span>`;
        index += numberMatch[0].length;
        continue;
      }

      output += source[index];
      index += 1;
    }

    return output;
  }

  function isLocalFilePath(value) {
    return /^[a-z]:[\\/]/i.test(String(value || "").replaceAll("&amp;", "&"));
  }

  function normalizeUrl(value) {
    const decoded = String(value || "")
      .trim()
      .replace(/^&quot;|&quot;$/g, "")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#039;", "'");
    if (!decoded) return "#";
    if (isLocalFilePath(decoded)) return decoded;
    if (/^(javascript|data|vbscript|file):/i.test(decoded)) return "#";
    if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) && !/^(https?|mailto|tel):/i.test(decoded)) return "#";
    return decoded;
  }

  function renderImage(alt, src) {
    const normalized = normalizeUrl(src);
    if (normalized === "#") {
      return '<span class="markdown-local-image">图片链接无效或不受支持。</span>';
    }
    if (isLocalFilePath(normalized)) {
      return `<span class="markdown-local-image">本地图片路径无法直接预览：<code>${escapeHtml(normalized)}</code></span>`;
    }
    return `<img src="${escapeHtml(normalized)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  }

  function inline(value) {
    const codeSpans = [];
    let text = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => {
      const token = `@@GOKOTTACODE${codeSpans.length}@@`;
      codeSpans.push(`<code>${code}</code>`);
      return token;
    });

    text = text
      .replace(/!\[([^\]]*)\]\(((?:\\.|[^()\\\n]|\([^()\n]*\))+?)\)/g, (_, alt, src) => renderImage(alt, src))
      .replace(/\[([^\]]+)\]\(((?:\\.|[^()\\\n]|\([^()\n]*\))+?)\)/g, (_, label, href) => {
        const normalized = normalizeUrl(href);
        if (isLocalFilePath(normalized)) {
          return `<span class="markdown-local-image">本地链接路径无法直接访问：<code>${escapeHtml(normalized)}</code></span>`;
        }
        const external = /^(https?:)?\/\//i.test(normalized);
        const target = external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(normalized)}"${target}>${label}</a>`;
      })
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

    codeSpans.forEach((html, index) => {
      text = text.replaceAll(`@@GOKOTTACODE${index}@@`, html);
    });
    return text;
  }

  function isTableRow(line) {
    return /^\s*\|.*\|\s*$/.test(line);
  }

  function isTableDivider(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function tableAlign(cell) {
    const value = cell.trim();
    if (value.startsWith(":") && value.endsWith(":")) return "center";
    if (value.endsWith(":")) return "right";
    return "left";
  }

  function renderTable(headerLine, dividerLine, bodyLines) {
    const headers = splitTableRow(headerLine);
    const aligns = splitTableRow(dividerLine).map(tableAlign);
    const header = headers
      .map((cell, index) => `<th style="text-align:${aligns[index] || "left"}">${inline(cell)}</th>`)
      .join("");
    const body = bodyLines
      .map((row) => {
        const cells = splitTableRow(row);
        return `<tr>${cells.map((cell, index) => `<td style="text-align:${aligns[index] || "left"}">${inline(cell)}</td>`).join("")}</tr>`;
      })
      .join("");
    return `<div class="markdown-table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function render(markdown) {
    const headings = [];
    const blocks = [];
    const lines = String(markdown || "").split(/\r?\n/);
    const usedSlugs = new Map();
    let paragraph = [];
    let list = [];
    let listType = "ul";
    let quote = [];
    let inCode = false;
    let codeLang = "";
    let code = [];

    function uniqueId(text) {
      const base = slugify(text) || "section";
      const count = usedSlugs.get(base) || 0;
      usedSlugs.set(base, count + 1);
      return count ? `${base}-${count + 1}` : base;
    }

    function flushParagraph() {
      if (!paragraph.length) return;
      blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!list.length) return;
      blocks.push(`<${listType}>${list.join("")}</${listType}>`);
      list = [];
      listType = "ul";
    }

    function flushQuote() {
      if (!quote.length) return;
      blocks.push(`<blockquote>${quote.map((item) => `<p>${inline(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    }

    function flushLooseBlocks() {
      flushParagraph();
      flushList();
      flushQuote();
    }

    function pushListItem(type, value) {
      if (list.length && listType !== type) flushList();
      listType = type;
      const task = value.match(/^\[([ xX])\]\s+(.+)$/);
      if (task) {
        const checked = task[1].toLowerCase() === "x" ? " checked" : "";
        list.push(`<li class="task-list-item"><input type="checkbox" disabled${checked} /> <span>${inline(task[2])}</span></li>`);
        return;
      }
      list.push(`<li>${inline(value)}</li>`);
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const codeFence = line.match(/^```(.*)$/);
      if (codeFence) {
        if (inCode) {
          blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(code.join("\n")))}</code></pre>`);
          inCode = false;
          code = [];
          codeLang = "";
        } else {
          flushLooseBlocks();
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
        flushLooseBlocks();
        continue;
      }

      if (isTableRow(line) && isTableDivider(lines[index + 1] || "")) {
        flushLooseBlocks();
        const divider = lines[index + 1];
        const bodyRows = [];
        index += 2;
        while (index < lines.length && isTableRow(lines[index])) {
          bodyRows.push(lines[index]);
          index += 1;
        }
        index -= 1;
        blocks.push(renderTable(line, divider, bodyRows));
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
      if (heading) {
        flushLooseBlocks();
        const level = heading[1].length;
        const text = heading[2].trim();
        if (level === 1) continue;
        const id = uniqueId(text);
        headings.push({ id, text, level });
        blocks.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
        continue;
      }

      if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushLooseBlocks();
        blocks.push("<hr />");
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      if (unordered) {
        flushParagraph();
        flushQuote();
        pushListItem("ul", unordered[1]);
        continue;
      }

      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        flushQuote();
        pushListItem("ol", ordered[1]);
        continue;
      }

      const quoteItem = line.match(/^>\s?(.+)$/);
      if (quoteItem) {
        flushParagraph();
        flushList();
        quote.push(quoteItem[1]);
        continue;
      }

      paragraph.push(line.trim());
    }

    if (inCode) {
      blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(code.join("\n")))}</code></pre>`);
    }
    flushLooseBlocks();
    return { html: blocks.join("\n"), headings };
  }

  window.GokottaMarkdown = { render, escapeHtml, inline };
})();
