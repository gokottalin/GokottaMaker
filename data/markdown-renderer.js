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
    const group = readScriptValue(source, index + 1);
    return { value: group.value, end: group.end };
  }

  function readScriptValue(source, index) {
    const group = readBalanced(source, index, "{", "}");
    if (group.grouped) return group;
    const token = source.slice(index).match(/^[A-Za-z0-9]+/);
    if (token) return { value: token[0], end: index + token[0].length, grouped: false };
    return group;
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
    const operatorClass = `math-limit-${commandName}`;
    return {
      html: `<span class="math-limit-op ${operatorClass}"><span class="math-limit-upper">${upper}</span><span class="math-limit-symbol">${escapeHtml(symbol)}</span><span class="math-limit-lower">${lower}</span></span>`,
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
        const group = readScriptValue(source, index + 1);
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

  const plainMathWords = new Set(["ADC", "CPU", "DMA", "GPIO", "HAL", "LSB", "MCU", "MOS", "PDF", "ST", "TVS"]);

  function dottedSubscriptMath(value) {
    return String(value || "").replace(/[\p{L}][\p{L}\p{N}]*(?:\.[\p{L}][\p{L}\p{N}]*)+/gu, (token) => {
      const [base, ...subscripts] = token.split(".");
      return `${base}_{${subscripts.join(".")}}`;
    });
  }

  function identifierHtml(token) {
    if (!token || plainMathWords.has(token)) return escapeHtml(token);
    let match = token.match(/^([VRTCI])([A-Z][A-Z0-9]+)(\+?)$/);
    if (match) return `${escapeHtml(match[1])}<sub>${escapeHtml(match[2])}</sub>${escapeHtml(match[3])}`;
    match = token.match(/^([VRTCI])([a-z][A-Za-z0-9]+)$/);
    if (match) return `${escapeHtml(match[1])}<sub>${escapeHtml(match[2])}</sub>`;
    match = token.match(/^([VRTCI])([0-9]+)$/);
    if (match) return `${escapeHtml(match[1])}<sub>${escapeHtml(match[2])}</sub>`;
    return escapeHtml(token);
  }

  function isTopLevelFormulaOperator(char) {
    return (
      char === "=" ||
      char === "≈" ||
      char === "≥" ||
      char === "≤" ||
      char === ">" ||
      char === "<" ||
      char === "+" ||
      char === "-" ||
      char === "×" ||
      char === "÷" ||
      char === "*" ||
      char === "\n"
    );
  }

  function splitTopLevelFraction(source) {
    let depth = 0;
    let slashIndex = -1;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === "\\" && index + 1 < source.length) {
        index += 1;
        continue;
      }
      if (char === "(" || char === "[" || char === "{") depth += 1;
      if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
      if (char === "/" && depth === 0 && source[index - 1] !== "/" && source[index + 1] !== "/") {
        slashIndex = index;
        break;
      }
    }
    if (slashIndex < 0) return null;

    let leftStart = slashIndex - 1;
    depth = 0;
    while (leftStart >= 0) {
      const char = source[leftStart];
      if (char === ")" || char === "]" || char === "}") depth += 1;
      if (char === "(" || char === "[" || char === "{") depth = Math.max(0, depth - 1);
      if (depth === 0 && isTopLevelFormulaOperator(char)) {
        leftStart += 1;
        break;
      }
      leftStart -= 1;
    }
    leftStart = Math.max(0, leftStart);

    let rightEnd = slashIndex + 1;
    depth = 0;
    while (rightEnd < source.length) {
      const char = source[rightEnd];
      if (char === "(" || char === "[" || char === "{") depth += 1;
      if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
      if (depth === 0 && isTopLevelFormulaOperator(char)) break;
      rightEnd += 1;
    }

    const left = source.slice(leftStart, slashIndex).trim();
    const right = source.slice(slashIndex + 1, rightEnd).trim();
    if (!left || !right) return null;
    return {
      prefix: source.slice(0, leftStart),
      left,
      right,
      suffix: source.slice(rightEnd)
    };
  }

  function renderLatexHtml(value) {
    const source = normalizeMathSource(value);
    const fraction = splitTopLevelFraction(source);
    if (fraction) {
      return `${renderLatexHtml(fraction.prefix)}<span class="math-frac"><span class="math-num">${renderLatexHtml(fraction.left)}</span><span class="math-den">${renderLatexHtml(fraction.right)}</span></span>${renderLatexHtml(fraction.suffix)}`;
    }
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
        const group = readScriptValue(source, index + 1);
        const tag = char === "^" ? "sup" : "sub";
        output += `<${tag}>${mathGroupHtml(group.value)}</${tag}>`;
        index = group.end;
        continue;
      }
      if (char === "(") {
        const group = readBalanced(source, index, "(", ")");
        output += `(${mathGroupHtml(group.value)})`;
        index = group.end;
        continue;
      }
      if (char === "[") {
        const group = readBalanced(source, index, "[", "]");
        output += `[${mathGroupHtml(group.value)}]`;
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
      const word = source.slice(index).match(/^[A-Za-z][A-Za-z0-9]*/);
      if (word) {
        output += identifierHtml(word[0]);
        index += word[0].length;
        continue;
      }
      output += escapeHtml(char);
      index += 1;
    }
    return output.replace(/[ \t]{2,}/g, " ");
  }

  let activeMathDiagnostics = null;

  function mathErrorMarkup(displayMode) {
    const tag = displayMode ? "div" : "span";
    const mode = displayMode ? "display" : "inline";
    return `<${tag} class="markdown-math-error markdown-math-error--${mode}" role="status" aria-label="公式渲染失败">公式暂不可用</${tag}>`;
  }

  function recordMathDiagnostics(result, source, displayMode) {
    if (!activeMathDiagnostics || !result || !Array.isArray(result.diagnostics)) return;
    result.diagnostics.forEach((item) => {
      activeMathDiagnostics.push({
        ...item,
        formula: {
          index: activeMathDiagnostics.length + 1,
          displayMode,
          source: String(source || "")
        }
      });
    });
  }

  function recordDelimiterDiagnostic(delimiter, line) {
    if (!activeMathDiagnostics) return;
    activeMathDiagnostics.push({
      code: "math.delimiter.unclosed",
      severity: "error",
      blocking: true,
      message: `数学块缺少结束定界符 ${delimiter}。`,
      range: {
        offset: 0,
        length: delimiter.length,
        line,
        column: 1,
        endLine: line,
        endColumn: delimiter.length + 1
      }
    });
  }

  function mathEngineResult(source, displayMode) {
    if (!window.LarkixMath || typeof window.LarkixMath.render !== "function") {
      if (typeof document === "undefined") {
        return {
          valid: true,
          blocking: false,
          diagnostics: [],
          html: renderLatexHtml(source)
        };
      }
      const result = {
        valid: false,
        blocking: true,
        diagnostics: [
          {
            code: "math.engine.unavailable",
            severity: "error",
            blocking: true,
            message: "共享数学引擎未加载，已阻止数学内容输出。",
            range: {
              offset: 0,
              length: 0,
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: 1
            }
          }
        ],
        html: ""
      };
      recordMathDiagnostics(result, source, displayMode);
      return result;
    }
    const result = window.LarkixMath.render(source, { displayMode });
    recordMathDiagnostics(result, source, displayMode);
    return result;
  }

  function inlineMathProfile(source, html) {
    const structureCounts = {
      fraction: (html.match(/\bmfrac\b/g) || []).length,
      integral: (source.match(/\\(?:i{1,3}nt|oi{1,2}nt)(?![A-Za-z])/g) || []).length,
      root: (html.match(/\bsqrt\b/g) || []).length,
      script: (html.match(/\bmsupsub\b/g) || []).length
    };
    const structures = Object.entries(structureCounts)
      .filter(([, count]) => count > 0)
      .map(([name]) => name);
    const complex =
      structureCounts.fraction > 0 ||
      structureCounts.integral > 0 ||
      structureCounts.root > 0 ||
      structureCounts.script > 1;
    const scrollable = complex || Array.from(source).length > 36;
    return {
      classes: [
        complex ? "is-complex" : "",
        scrollable ? "is-scrollable" : ""
      ].filter(Boolean),
      structures: structures.length ? structures.join(" ") : "plain"
    };
  }

  function renderInlineMath(latex) {
    const source = decodeMathEntities(latex);
    const result = mathEngineResult(source, false);
    if (!result.valid) return mathErrorMarkup(false);
    const profile = inlineMathProfile(source, result.html);
    const classes = ["markdown-math", "markdown-math-inline", ...profile.classes].join(" ");
    return `<span class="${classes}" data-math-layout="inline-flow" data-math-structures="${profile.structures}" data-latex="${escapeHtml(source)}"><span class="math-inline-frame">${result.html}</span></span>`;
  }

  function renderDisplayMath(latex) {
    const source = decodeMathEntities(latex);
    const result = mathEngineResult(source, true);
    if (!result.valid) return mathErrorMarkup(true);
    const boxed = /\\boxed\s*\{/.test(source) ? " is-boxed" : "";
    return `<div class="markdown-math markdown-math-display${boxed}" data-latex="${escapeHtml(source)}">${result.html}</div>`;
  }

  function looksLikeFormulaText(value) {
    const source = String(value || "").trim();
    if (!source || source.length > 240) return false;
    if (/;|#include|\b(return|if|for|while|static|const|void|uint\d+_t)\b/.test(source)) return false;
    if (/[=≈≥≤<>×÷/^]|\|\||\b(?:sqrt|frac|sum|int|ln|exp|round)\b/.test(source)) return true;
    return /^(?:V(?:IN|REF|DDA|SSA|0)|R(?:AIN|ADC|th|source|[12])|C(?:ADC|IN|input)|T(?:SMPL)|I(?:divider)?|N)$/.test(source);
  }

  function looksLikeFormulaBlock(lang, value) {
    const normalizedLang = String(lang || "").trim().toLowerCase();
    if (["math", "formula", "latex", "tex"].includes(normalizedLang)) return true;
    if (normalizedLang && normalizedLang !== "text") return false;
    const lines = String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length || lines.some((line) => /----|\+\s*-{2,}|#include|;/.test(line))) return false;
    return lines.some((line) => looksLikeFormulaText(line));
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

  const deriveSlugPattern = /^[a-z0-9][a-z0-9-]{1,79}$/;
  const deriveColorTokens = new Set(["purple", "blue", "green", "amber", "red", "neutral"]);
  const formulaReferencePattern =
    /\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}/g;
  const formulaReferenceOnlyPattern =
    /^\s*\{\{formula:([a-z0-9][a-z0-9._-]{1,95})\|([a-z0-9][a-z0-9._-]{1,127})\|([a-z0-9][a-z0-9._-]{1,95})\|(inline|display)\}\}\s*$/;
  const formulaDependencyPattern =
    /\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g;
  let activeFormulaBindings = new Map();
  let activeFormulaDependencies = new Map();
  let formulaDependencyMode = "public";
  let formulaDependencyHref = "./derive.html?formula=";

  function normalizeDeriveColor(value) {
    const token = String(value || "purple").trim().toLowerCase();
    return deriveColorTokens.has(token) ? token : "purple";
  }

  function renderDeriveShortcode(shortcode, slugValue, labelValue, colorValue) {
    const slug = String(slugValue || "").trim().toLowerCase();
    const label = String(labelValue || "").trim();
    const decodedLabel = decodeMathEntities(label).trim();
    if (!deriveSlugPattern.test(slug) || !decodedLabel || decodedLabel.length > 80) return shortcode;
    const color = normalizeDeriveColor(colorValue);
    const title = escapeHtml(`${decodedLabel}详细推导`);
    return `<a class="derivation-link derivation-link--${color} formula-jump-sup" href="./derive.html?slug=${encodeURIComponent(slug)}" data-derive-slug="${escapeHtml(slug)}" data-derive-label="${label}" data-derive-color="${color}" title="${title}" aria-label="查看 ${title}"><span class="derive-jump-icon" aria-hidden="true">↵</span><span class="derive-jump-label">${label}</span></a>`;
  }

  function setFormulaBindings(bindings) {
    activeFormulaBindings = new Map(
      (Array.isArray(bindings) ? bindings : [])
        .filter((binding) => binding && binding.bindingId)
        .map((binding) => [String(binding.bindingId), binding])
    );
  }

  function setFormulaDependencies(dependencies, options = {}) {
    activeFormulaDependencies = new Map(
      (Array.isArray(dependencies) ? dependencies : [])
        .map((dependency) => ({
          dependency,
          referenceKey: dependency?.referenceKey || dependency?.formulaId || dependency?.slug
        }))
        .filter((entry) => entry.dependency && entry.referenceKey)
        .map((entry) => [String(entry.referenceKey), entry.dependency])
    );
    formulaDependencyMode = options.formulaDependencyMode === "admin" ? "admin" : "public";
    formulaDependencyHref =
      String(options.formulaDependencyHref || "./derive.html?formula=");
  }

  function renderFormulaDependency(referenceKey) {
    const dependency = activeFormulaDependencies.get(referenceKey);
    if (!dependency || !dependency.slug || dependency.available === false) {
      const label =
        formulaDependencyMode === "admin"
          ? `未解析的公式依赖：${referenceKey}`
          : "依赖公式暂不可用";
      return `<span class="formula-dependency-ref is-unavailable" role="note">${escapeHtml(label)}</span>`;
    }
    const label = String(dependency.displayName || "依赖公式");
    const latex = String(dependency.latex || "").trim();
    return `<a class="formula-dependency-ref" href="${escapeHtml(
      `${formulaDependencyHref}${encodeURIComponent(dependency.slug)}`
    )}" data-formula-dependency="${escapeHtml(referenceKey)}" title="查看依赖公式：${escapeHtml(
      label
    )}" aria-label="查看依赖公式：${escapeHtml(label)}"><span>${escapeHtml(
      label
    )}</span>${latex ? renderInlineMath(latex) : ""}</a>`;
  }

  function resolveFormulaBinding(bindingId, formulaId, revisionId, displayMode) {
    const binding = activeFormulaBindings.get(bindingId);
    const resolved =
      binding &&
      binding.formulaId === formulaId &&
      binding.revisionId === revisionId &&
      binding.displayMode === displayMode &&
      String(binding.latex || "").trim() &&
      String(binding.slug || "").trim();
    return {
      binding,
      resolved: Boolean(resolved),
      slug: resolved ? String(binding.slug).trim() : "",
      label: resolved ? String(binding.displayName || formulaId).trim() : formulaId
    };
  }

  function renderFormulaBindingMarker(bindingId, formulaId, revisionId, displayMode) {
    const target = resolveFormulaBinding(bindingId, formulaId, revisionId, displayMode);
    if (!target.resolved) return "";
    const title = `${target.label}详细推导`;
    return `<a class="formula-binding-marker formula-binding-marker--${displayMode}" href="./derive.html?formula=${encodeURIComponent(
      target.slug
    )}" data-formula-binding-id="${escapeHtml(bindingId)}" data-formula-id="${escapeHtml(
      formulaId
    )}" data-formula-revision-id="${escapeHtml(revisionId)}" title="${escapeHtml(
      title
    )}" aria-label="查看 ${escapeHtml(title)}"><span class="formula-binding-marker__icon" aria-hidden="true">↩</span><span class="formula-binding-marker__label">${escapeHtml(
      target.label
    )}</span></a>`;
  }

  function renderFormulaReference(shortcode, bindingId, formulaId, revisionId, displayMode, block = false) {
    const target = resolveFormulaBinding(bindingId, formulaId, revisionId, displayMode);
    const { binding, resolved, label } = target;
    const marker = renderFormulaBindingMarker(bindingId, formulaId, revisionId, displayMode);
    const archive = resolved && binding.archiveState === "archived" ? '<span class="formula-reference-state">已归档修订</span>' : "";
    const attributes = `data-formula-binding-id="${escapeHtml(bindingId)}" data-formula-id="${escapeHtml(formulaId)}" data-formula-revision-id="${escapeHtml(revisionId)}"`;
    if (block) {
      const body = resolved
        ? renderDisplayMath(binding.latex)
        : `<div class="formula-reference-unresolved">公式卡引用：<code>${escapeHtml(formulaId)}</code></div>`;
      return `<section class="formula-reference formula-reference--display ${resolved ? "" : "is-unresolved"}" ${attributes}>${body}${archive}${marker}</section>`;
    }
    const body = resolved ? renderInlineMath(binding.latex) : `<code>${escapeHtml(formulaId)}</code>`;
    return `<span class="formula-reference formula-reference--inline ${resolved ? "" : "is-unresolved"}" ${attributes}>${body}${archive}${marker}</span>`;
  }

  function inline(value) {
    const codeSpans = [];
    const mathSpans = [];
    const deriveSpans = [];
    const formulaSpans = [];
    const formulaDependencySpans = [];
    let text = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => {
      const token = `@@LARKIXCODE${codeSpans.length}@@`;
      const decoded = decodeMathEntities(code);
      codeSpans.push(looksLikeFormulaText(decoded) ? renderInlineMath(decoded) : `<code>${code}</code>`);
      return token;
    });

    text = text
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => {
        const token = `@@LARKIXMATH${mathSpans.length}@@`;
        mathSpans.push(renderInlineMath(latex));
        return token;
      })
      .replace(/(^|[^\\$])\$((?:\\.|[^\n$\\])+?)\$(?!\$)/g, (_, prefix, latex) => {
        const token = `@@LARKIXMATH${mathSpans.length}@@`;
        mathSpans.push(renderInlineMath(latex));
        return `${prefix}${token}`;
      });

    text = text.replace(/\{\{derive:([^|{}\s]+)\|([^|{}\n]+?)(?:\|([^|{}\n]+?))?\}\}/g, (shortcode, slug, label, color) => {
      const html = renderDeriveShortcode(shortcode, slug, label, color);
      if (html === shortcode) return shortcode;
      const token = `@@LARKIXDERIVE${deriveSpans.length}@@`;
      deriveSpans.push(html);
      return token;
    });

    text = text.replace(formulaReferencePattern, (shortcode, bindingId, formulaId, revisionId, displayMode, offset, source) => {
      const token = `@@LARKIXFORMULA${formulaSpans.length}@@`;
      const followsAuthorMath = /@@LARKIXMATH\d+@@\s*$/.test(source.slice(0, offset));
      formulaSpans.push(
        followsAuthorMath
          ? renderFormulaBindingMarker(bindingId, formulaId, revisionId, displayMode)
          : renderFormulaReference(shortcode, bindingId, formulaId, revisionId, displayMode, false)
      );
      return token;
    });
    text = text.replace(formulaDependencyPattern, (shortcode, formulaId) => {
      const token = `@@LARKIXFORMULADEPENDENCY${formulaDependencySpans.length}@@`;
      formulaDependencySpans.push(renderFormulaDependency(formulaId));
      return token;
    });
    text = text.replaceAll("{{formula-ref-unavailable}}", () => {
      const token = `@@LARKIXFORMULADEPENDENCY${formulaDependencySpans.length}@@`;
      formulaDependencySpans.push(
        '<span class="formula-dependency-ref is-unavailable" role="note">依赖公式暂不可用</span>'
      );
      return token;
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
      text = text.replaceAll(`@@LARKIXCODE${index}@@`, html);
    });
    mathSpans.forEach((html, index) => {
      text = text.replaceAll(`@@LARKIXMATH${index}@@`, html);
    });
    deriveSpans.forEach((html, index) => {
      text = text.replaceAll(`@@LARKIXDERIVE${index}@@`, html);
    });
    formulaSpans.forEach((html, index) => {
      text = text.replaceAll(`@@LARKIXFORMULA${index}@@`, html);
    });
    formulaDependencySpans.forEach((html, index) => {
      text = text.replaceAll(`@@LARKIXFORMULADEPENDENCY${index}@@`, html);
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
    const parentMathDiagnostics = activeMathDiagnostics;
    const diagnostics = [];
    activeMathDiagnostics = diagnostics;
    const includeH1 = Boolean(options && options.includeH1);
    setFormulaBindings(options.formulaBindings);
    setFormulaDependencies(options.formulaDependencies, options);
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
    let mathStartLine = 0;

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
      mathStartLine = 0;
    }

    function isDeriveShortcodeOnly(line) {
      return /^\s*\{\{derive:[^|{}\s]+\|[^|{}\n]+?(?:\|[^|{}\n]+?)?\}\}\s*$/.test(line);
    }

    function attachFormulaJumpToLastDisplayMath(jumpHtml) {
      const lastIndex = blocks.length - 1;
      if (lastIndex < 0 || !/class="markdown-math markdown-math-display"/.test(blocks[lastIndex])) return false;
      if (!/class="derivation-link/.test(jumpHtml)) return false;
      blocks[lastIndex] = blocks[lastIndex].replace(/<\/div>$/, `${jumpHtml}</div>`);
      return true;
    }

    function attachFormulaBindingToLastDisplayMath(markerHtml) {
      const lastIndex = blocks.length - 1;
      if (lastIndex < 0 || !/class="markdown-math markdown-math-display/.test(blocks[lastIndex])) return false;
      if (!/class="formula-binding-marker/.test(markerHtml)) return false;
      blocks[lastIndex] = blocks[lastIndex].replace(/<\/div>$/, `${markerHtml}</div>`);
      return true;
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
            const codeText = code.join("\n");
            if (looksLikeFormulaBlock(codeLang, codeText)) {
              blocks.push(renderDisplayMath(codeText));
            } else {
              blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(codeText))}</code></pre>`);
            }
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

      if (isDeriveShortcodeOnly(line) && !paragraph.length && !list.length && !quote.length) {
        const jumpHtml = inline(line.trim());
        if (attachFormulaJumpToLastDisplayMath(jumpHtml)) continue;
      }

      const formulaOnly = line.match(formulaReferenceOnlyPattern);
      if (formulaOnly && formulaOnly[4] === "display") {
        flushLooseBlocks();
        const markerHtml = renderFormulaBindingMarker(
          formulaOnly[1],
          formulaOnly[2],
          formulaOnly[3],
          formulaOnly[4]
        );
        if (markerHtml && attachFormulaBindingToLastDisplayMath(markerHtml)) continue;
        blocks.push(renderFormulaReference(line, formulaOnly[1], formulaOnly[2], formulaOnly[3], formulaOnly[4], true));
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
          mathStartLine = index + 1;
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
      const codeText = code.join("\n");
      if (looksLikeFormulaBlock(codeLang, codeText)) {
        blocks.push(renderDisplayMath(codeText));
      } else {
        blocks.push(`<pre data-lang="${escapeHtml(codeLang)}"><code>${highlight(escapeHtml(codeText))}</code></pre>`);
      }
    }
    if (inMath) {
      recordDelimiterDiagnostic(mathDelimiter, mathStartLine || lines.length);
      blocks.push(mathErrorMarkup(true));
      inMath = false;
      mathDelimiter = "";
      math = [];
      mathStartLine = 0;
    }
    flushLooseBlocks();
    activeMathDiagnostics = parentMathDiagnostics;
    if (parentMathDiagnostics) parentMathDiagnostics.push(...diagnostics);
    return {
      html: blocks.join("\n"),
      headings,
      diagnostics,
      valid: diagnostics.length === 0,
      canPublish: diagnostics.length === 0
    };
  }

  function renderFormulaCard(card = {}) {
    const parentMathDiagnostics = activeMathDiagnostics;
    const diagnostics = [];
    activeMathDiagnostics = diagnostics;
    const derivation = render(card.markdownDerivation || "", {
      formulaDependencies: card.derivation?.dependencies || [],
      formulaDependencyMode: "public"
    });
    const conclusionHtml = renderDisplayMath(String(card.latex || ""));
    const purpose = String(card.purpose || "").trim();
    const derivationBody = String(card.markdownDerivation || "").trim()
      ? derivation.html
      : '<p class="formula-card-empty">这条已发布修订暂未提供 Markdown 推导正文。</p>';
    const result = {
      html: `
        <section class="formula-conclusion-public" aria-labelledby="formulaConclusionTitle">
          <h2 id="formulaConclusionTitle">结论公式</h2>
          ${conclusionHtml}
        </section>
        <section class="formula-purpose-public" aria-labelledby="formulaPurposeTitle">
          <h2 id="formulaPurposeTitle">用途说明</h2>
          <p>${escapeHtml(purpose || "暂未填写用途说明。")}</p>
        </section>
        <section class="formula-markdown-derivation" aria-labelledby="formulaMarkdownTitle">
          <h2 id="formulaMarkdownTitle">推导正文</h2>
          ${derivationBody}
        </section>`,
      headings: [
        { id: "formulaConclusionTitle", text: "结论公式", level: 2 },
        { id: "formulaPurposeTitle", text: "用途说明", level: 2 },
        { id: "formulaMarkdownTitle", text: "推导正文", level: 2 },
        ...derivation.headings
      ],
      diagnostics,
      valid: diagnostics.length === 0,
      canPublish: diagnostics.length === 0
    };
    activeMathDiagnostics = parentMathDiagnostics;
    if (parentMathDiagnostics) parentMathDiagnostics.push(...diagnostics);
    return result;
  }

  window.LarkixMarkdown = {
    render,
    renderFormulaCard,
    escapeHtml,
    inline,
    mathToText,
    renderDisplayMath,
    dottedSubscriptMath
  };
})();
