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

  const mathSymbols = {
    alpha: "\u03b1",
    beta: "\u03b2",
    gamma: "\u03b3",
    Gamma: "\u0393",
    delta: "\u03b4",
    Delta: "\u0394",
    epsilon: "\u03b5",
    varepsilon: "\u03f5",
    zeta: "\u03b6",
    eta: "\u03b7",
    theta: "\u03b8",
    vartheta: "\u03d1",
    Theta: "\u0398",
    iota: "\u03b9",
    kappa: "\u03ba",
    lambda: "\u03bb",
    Lambda: "\u039b",
    mu: "\u03bc",
    nu: "\u03bd",
    xi: "\u03be",
    Xi: "\u039e",
    pi: "\u03c0",
    Pi: "\u03a0",
    rho: "\u03c1",
    sigma: "\u03c3",
    Sigma: "\u03a3",
    tau: "\u03c4",
    upsilon: "\u03c5",
    phi: "\u03c6",
    varphi: "\u03d5",
    Phi: "\u03a6",
    chi: "\u03c7",
    psi: "\u03c8",
    Psi: "\u03a8",
    omega: "\u03c9",
    Omega: "\u03a9",
    nabla: "\u2207",
    partial: "\u2202",
    infty: "\u221e",
    int: "\u222b",
    iint: "\u222c",
    iiint: "\u222d",
    oint: "\u222e",
    oiint: "\u222f",
    sum: "\u2211",
    prod: "\u220f",
    cdot: "\u00b7",
    times: "\u00d7",
    div: "\u00f7",
    pm: "\u00b1",
    mp: "\u2213",
    le: "\u2264",
    leq: "\u2264",
    ge: "\u2265",
    geq: "\u2265",
    neq: "\u2260",
    ne: "\u2260",
    approx: "\u2248",
    sim: "\u223c",
    simeq: "\u2243",
    equiv: "\u2261",
    propto: "\u221d",
    to: "\u2192",
    rightarrow: "\u2192",
    leftarrow: "\u2190",
    leftrightarrow: "\u2194",
    Rightarrow: "\u21d2",
    Leftarrow: "\u21d0",
    degree: "\u00b0",
    angle: "\u2220",
    perp: "\u22a5",
    parallel: "\u2225",
    in: "\u2208",
    notin: "\u2209",
    subset: "\u2282",
    subseteq: "\u2286",
    cup: "\u222a",
    cap: "\u2229",
    emptyset: "\u2205",
    forall: "\u2200",
    exists: "\u2203",
    land: "\u2227",
    lor: "\u2228",
    neg: "\u00ac",
    ldots: "\u2026",
    dots: "\u2026",
    ellipsis: "\u2026"
  };

  const mathOperators = new Set([
    "sin",
    "cos",
    "tan",
    "cot",
    "sec",
    "csc",
    "arcsin",
    "arccos",
    "arctan",
    "sinh",
    "cosh",
    "tanh",
    "lim",
    "log",
    "ln",
    "exp",
    "min",
    "max",
    "det",
    "arg",
    "Re",
    "Im"
  ]);

  const mathLimitOperators = new Set(["int", "iint", "iiint", "oint", "oiint", "sum", "prod", "lim"]);

  const superscriptChars = {
    "0": "\u2070",
    "1": "\u00b9",
    "2": "\u00b2",
    "3": "\u00b3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
    "+": "\u207a",
    "-": "\u207b",
    "=": "\u207c",
    "(": "\u207d",
    ")": "\u207e",
    n: "\u207f",
    i: "\u2071"
  };

  const subscriptChars = {
    "0": "\u2080",
    "1": "\u2081",
    "2": "\u2082",
    "3": "\u2083",
    "4": "\u2084",
    "5": "\u2085",
    "6": "\u2086",
    "7": "\u2087",
    "8": "\u2088",
    "9": "\u2089",
    "+": "\u208a",
    "-": "\u208b",
    "=": "\u208c",
    "(": "\u208d",
    ")": "\u208e",
    a: "\u2090",
    e: "\u2091",
    h: "\u2095",
    i: "\u1d62",
    j: "\u2c7c",
    k: "\u2096",
    l: "\u2097",
    m: "\u2098",
    n: "\u2099",
    o: "\u2092",
    p: "\u209a",
    r: "\u1d63",
    s: "\u209b",
    t: "\u209c",
    u: "\u1d64",
    v: "\u1d65",
    x: "\u2093"
  };

  function normalizeMathSource(value) {
    return String(value || "")
      .trim()
      .replace(/\\begin\{(?:equation|equation\*|align|align\*|aligned|gather|gather\*|split|multline|multline\*|cases)\}/g, "")
      .replace(/\\end\{(?:equation|equation\*|align|align\*|aligned|gather|gather\*|split|multline|multline\*|cases)\}/g, "")
      .replace(/\\left|\\right/g, "")
      .replace(/\\(?:quad|qquad|,|;|:|!)/g, " ")
      .replace(/\\\\/g, "\n")
      .replace(/&/g, " ");
  }

  function decodeMathEntities(value) {
    return String(value || "")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#039;", "'");
  }

  function readBalanced(source, index, open, close) {
    let start = index;
    while (source[start] === " ") start += 1;
    if (source[start] !== open) {
      return { value: source[start] || "", end: start + (source[start] ? 1 : 0), grouped: false };
    }
    let depth = 0;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "\\" && cursor + 1 < source.length) {
        cursor += 1;
        continue;
      }
      if (char === open) depth += 1;
      if (char === close) depth -= 1;
      if (depth === 0) {
        return { value: source.slice(start + 1, cursor), end: cursor + 1, grouped: true };
      }
    }
    return { value: source.slice(start + 1), end: source.length, grouped: true };
  }

  function readCommand(source, index) {
    if (source[index] !== "\\") return null;
    const alpha = source.slice(index + 1).match(/^[A-Za-z]+/);
    if (alpha) return { name: alpha[0], end: index + 1 + alpha[0].length };
    return { name: source[index + 1] || "", end: Math.min(source.length, index + 2) };
  }

  function readMathScript(source, index, mark) {
    if (source[index] !== mark) return null;
    const group = readBalanced(source, index + 1, "{", "}");
    return { value: group.value, end: group.end };
  }

  function readScriptPair(source, index) {
    let cursor = index;
    let lower = null;
    let upper = null;
    for (let step = 0; step < 2; step += 1) {
      while (source[cursor] === " ") cursor += 1;
      const lowerScript = readMathScript(source, cursor, "_");
      if (lowerScript) {
        lower = lowerScript;
        cursor = lowerScript.end;
        continue;
      }
      const upperScript = readMathScript(source, cursor, "^");
      if (upperScript) {
        upper = upperScript;
        cursor = upperScript.end;
        continue;
      }
      break;
    }
    return { lower, upper, end: cursor };
  }

  function renderLimitOperator(commandName, source, index) {
    const scripts = readScriptPair(source, index);
    const symbol = mathSymbols[commandName] || commandName;
    if (!scripts.lower && !scripts.upper) {
      return { html: `<span class="math-symbol">${escapeHtml(symbol)}</span>`, end: scripts.end };
    }
    const upper = scripts.upper ? mathGroupHtml(scripts.upper.value) : "";
    const lower = scripts.lower ? mathGroupHtml(scripts.lower.value) : "";
    return {
      html: `<span class="math-limit-op"><span class="math-limit-upper">${upper}</span><span class="math-limit-symbol">${escapeHtml(symbol)}</span><span class="math-limit-lower">${lower}</span></span>`,
      end: scripts.end
    };
  }

  function scriptText(value, map, fallbackMark) {
    const text = mathToText(value).replace(/\s+/g, "");
    if (text && [...text].every((char) => map[char])) return [...text].map((char) => map[char]).join("");
    return `${fallbackMark}{${mathToText(value)}}`;
  }

  function mathToText(value) {
    const source = normalizeMathSource(value);
    let output = "";
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === "\n") {
        output += "\n";
        index += 1;
        continue;
      }
      if (char === "^" || char === "_") {
        const group = readBalanced(source, index + 1, "{", "}");
        output += scriptText(group.value, char === "^" ? superscriptChars : subscriptChars, char);
        index = group.end;
        continue;
      }
      if (char === "{") {
        const group = readBalanced(source, index, "{", "}");
        output += mathToText(group.value);
        index = group.end;
        continue;
      }
      if (char === "}") {
        index += 1;
        continue;
      }
      if (char === "\\") {
        const command = readCommand(source, index);
        if (!command || !command.name) {
          index += 1;
          continue;
        }
        index = command.end;
        if (["frac", "dfrac", "tfrac"].includes(command.name)) {
          const numerator = readBalanced(source, index, "{", "}");
          const denominator = readBalanced(source, numerator.end, "{", "}");
          output += `(${mathToText(numerator.value)})/(${mathToText(denominator.value)})`;
          index = denominator.end;
          continue;
        }
        if (command.name === "sqrt") {
          const degree = source[index] === "[" ? readBalanced(source, index, "[", "]") : null;
          const radicand = readBalanced(source, degree ? degree.end : index, "{", "}");
          output += degree ? `${mathToText(degree.value)}√(${mathToText(radicand.value)})` : `√(${mathToText(radicand.value)})`;
          index = radicand.end;
          continue;
        }
        if (["vec", "overrightarrow"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += `${mathToText(group.value)}\u20d7`;
          index = group.end;
          continue;
        }
        if (["hat", "bar", "dot", "ddot"].includes(command.name)) {
          const accent = { hat: "\u0302", bar: "\u0304", dot: "\u0307", ddot: "\u0308" }[command.name];
          const group = readBalanced(source, index, "{", "}");
          output += `${mathToText(group.value)}${accent}`;
          index = group.end;
          continue;
        }
        if (["mathbf", "boldsymbol", "mathrm", "mathit", "mathcal", "text", "operatorname"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += mathToText(group.value);
          index = group.end;
          continue;
        }
        if (mathSymbols[command.name]) {
          output += mathSymbols[command.name];
          continue;
        }
        if (mathOperators.has(command.name)) {
          output += command.name;
          continue;
        }
        output += command.name.length === 1 ? command.name : ` ${command.name} `;
        continue;
      }
      output += char;
      index += 1;
    }
    return output.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
  }

  function mathGroupHtml(value) {
    return renderLatexHtml(value);
  }

  function renderLatexHtml(value) {
    const source = normalizeMathSource(value);
    let output = "";
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === "\n") {
        output += "<br />";
        index += 1;
        continue;
      }
      if (char === "^" || char === "_") {
        const group = readBalanced(source, index + 1, "{", "}");
        const tag = char === "^" ? "sup" : "sub";
        output += `<${tag}>${mathGroupHtml(group.value)}</${tag}>`;
        index = group.end;
        continue;
      }
      if (char === "{") {
        const group = readBalanced(source, index, "{", "}");
        output += mathGroupHtml(group.value);
        index = group.end;
        continue;
      }
      if (char === "}") {
        index += 1;
        continue;
      }
      if (char === "\\") {
        const command = readCommand(source, index);
        if (!command || !command.name) {
          index += 1;
          continue;
        }
        index = command.end;
        if (mathLimitOperators.has(command.name)) {
          const limitOperator = renderLimitOperator(command.name, source, index);
          output += limitOperator.html;
          index = limitOperator.end;
          continue;
        }
        if (["frac", "dfrac", "tfrac"].includes(command.name)) {
          const numerator = readBalanced(source, index, "{", "}");
          const denominator = readBalanced(source, numerator.end, "{", "}");
          output += `<span class="math-frac"><span class="math-num">${mathGroupHtml(numerator.value)}</span><span class="math-den">${mathGroupHtml(denominator.value)}</span></span>`;
          index = denominator.end;
          continue;
        }
        if (command.name === "sqrt") {
          const degree = source[index] === "[" ? readBalanced(source, index, "[", "]") : null;
          const radicand = readBalanced(source, degree ? degree.end : index, "{", "}");
          const degreeHtml = degree ? `<sup class="math-root-degree">${mathGroupHtml(degree.value)}</sup>` : "";
          output += `<span class="math-root">${degreeHtml}<span class="math-radical">√</span><span class="math-radicand">${mathGroupHtml(radicand.value)}</span></span>`;
          index = radicand.end;
          continue;
        }
        if (["vec", "overrightarrow"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += `<span class="math-accent math-vector">${mathGroupHtml(group.value)}</span>`;
          index = group.end;
          continue;
        }
        if (["hat", "bar", "dot", "ddot"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += `<span class="math-accent math-${command.name}">${mathGroupHtml(group.value)}</span>`;
          index = group.end;
          continue;
        }
        if (["mathbf", "boldsymbol"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += `<strong>${mathGroupHtml(group.value)}</strong>`;
          index = group.end;
          continue;
        }
        if (["mathrm", "mathit", "mathcal", "text", "operatorname"].includes(command.name)) {
          const group = readBalanced(source, index, "{", "}");
          output += `<span class="math-text">${mathGroupHtml(group.value)}</span>`;
          index = group.end;
          continue;
        }
        if (mathSymbols[command.name]) {
          output += `<span class="math-symbol">${escapeHtml(mathSymbols[command.name])}</span>`;
          continue;
        }
        if (mathOperators.has(command.name)) {
          output += `<span class="math-op">${escapeHtml(command.name)}</span>`;
          continue;
        }
        output += escapeHtml(command.name.length === 1 ? command.name : command.name);
        continue;
      }
      output += escapeHtml(char);
      index += 1;
    }
    return output.replace(/[ \t]{2,}/g, " ");
  }

  function renderInlineMath(latex) {
    const source = decodeMathEntities(latex);
    const normalized = mathToText(source);
    return `<span class="markdown-math markdown-math-inline" data-latex="${escapeHtml(source)}">${escapeHtml(normalized)}</span>`;
  }

  function renderDisplayMath(latex) {
    return `<div class="markdown-math markdown-math-display" data-latex="${escapeHtml(latex)}">${renderLatexHtml(latex)}</div>`;
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
      return '<span class="markdown-local-image">图片地址无效或不支持。</span>';
    }
    if (isLocalFilePath(normalized)) {
      return `<span class="markdown-local-image">本地图片路径无法直接预览：<code>${escapeHtml(normalized)}</code></span>`;
    }
    return `<img src="${escapeHtml(normalized)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  }

  function inline(value) {
    const codeSpans = [];
    const mathSpans = [];
    let text = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => {
      const token = `@@GOKOTTACODE${codeSpans.length}@@`;
      codeSpans.push(`<code>${code}</code>`);
      return token;
    });

    text = text
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => {
        const token = `@@GOKOTTAMATH${mathSpans.length}@@`;
        mathSpans.push(renderInlineMath(latex));
        return token;
      })
      .replace(/(^|[^\\$])\$((?:\\.|[^\n$\\])+?)\$(?!\$)/g, (_, prefix, latex) => {
        const token = `@@GOKOTTAMATH${mathSpans.length}@@`;
        mathSpans.push(renderInlineMath(latex));
        return `${prefix}${token}`;
      });

    text = text
      .replace(/!\[([^\]]*)\]\(((?:\\.|[^()\\\n]|\([^()\n]*\))+?)\)/g, (_, alt, src) => renderImage(alt, src))
      .replace(/\[([^\]]+)\]\(((?:\\.|[^()\\\n]|\([^()\n]*\))+?)\)/g, (_, label, href) => {
        const normalized = normalizeUrl(href);
        if (isLocalFilePath(normalized)) {
          return `<span class="markdown-local-image">当前图片路径无法直接访问：<code>${escapeHtml(normalized)}</code></span>`;
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
    mathSpans.forEach((html, index) => {
      text = text.replaceAll(`@@GOKOTTAMATH${index}@@`, html);
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

  function render(markdown, options = {}) {
    const includeH1 = Boolean(options && options.includeH1);
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
    let codeFenceMarker = "";
    let code = [];
    let inMath = false;
    let mathDelimiter = "";
    let math = [];

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

    function closeMathBlock() {
      blocks.push(renderDisplayMath(math.join("\n")));
      inMath = false;
      mathDelimiter = "";
      math = [];
    }

    function readMathStart(line) {
      const trimmed = line.trim();
      if (trimmed.startsWith("$$")) {
        const rest = trimmed.slice(2);
        const end = rest.lastIndexOf("$$");
        if (end >= 0) return { closed: true, delimiter: "$$", content: rest.slice(0, end).trim() };
        return { closed: false, delimiter: "$$", content: rest.trim() };
      }
      if (trimmed.startsWith("\\[")) {
        const rest = trimmed.slice(2);
        const end = rest.lastIndexOf("\\]");
        if (end >= 0) return { closed: true, delimiter: "\\]", content: rest.slice(0, end).trim() };
        return { closed: false, delimiter: "\\]", content: rest.trim() };
      }
      const env = trimmed.match(/^\\begin\{(equation\*?|align\*?|aligned|gather\*?|split|multline\*?|cases)\}([\s\S]*)$/);
      if (!env) return null;
      const endPattern = new RegExp(`\\\\end\\{${env[1].replace("*", "\\*")}\\}`);
      if (endPattern.test(env[2])) {
        return { closed: true, delimiter: `\\end{${env[1]}}`, content: trimmed };
      }
      return { closed: false, delimiter: `\\end{${env[1]}}`, content: trimmed };
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
      const codeFence = line.match(/^(```|~~~)(.*)$/);
      if (codeFence) {
        if (inCode) {
          if (codeFence[1] === codeFenceMarker) {
            blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(code.join("\n")))}</code></pre>`);
            inCode = false;
            code = [];
            codeLang = "";
            codeFenceMarker = "";
          } else {
            code.push(line);
          }
        } else {
          flushLooseBlocks();
          inCode = true;
          codeFenceMarker = codeFence[1];
          codeLang = codeFence[2].trim();
        }
        continue;
      }

      if (inCode) {
        code.push(line);
        continue;
      }

      if (inMath) {
        if ((mathDelimiter === "$$" && line.trim().endsWith("$$")) || (mathDelimiter !== "$$" && line.includes(mathDelimiter))) {
          const endIndex = mathDelimiter === "$$" ? line.lastIndexOf("$$") : line.indexOf(mathDelimiter);
          math.push(line.slice(0, endIndex));
          closeMathBlock();
        } else {
          math.push(line);
        }
        continue;
      }

      if (!line.trim()) {
        flushLooseBlocks();
        continue;
      }

      const mathStart = readMathStart(line);
      if (mathStart) {
        flushLooseBlocks();
        if (mathStart.closed) {
          blocks.push(renderDisplayMath(mathStart.content));
        } else {
          inMath = true;
          mathDelimiter = mathStart.delimiter;
          math = mathStart.content ? [mathStart.content] : [];
        }
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
        if (level === 1 && !includeH1) continue;
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
    if (inMath) closeMathBlock();
    flushLooseBlocks();
    return { html: blocks.join("\n"), headings };
  }

  window.GokottaMarkdown = { render, escapeHtml, inline, mathToText, renderDisplayMath };
})();
