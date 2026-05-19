const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let cachedMarkdown;
let crcTable;

const pageProfiles = {
  a4: { width: 11906, height: 16838 },
  a5: { width: 8391, height: 11906 },
  letter: { width: 12240, height: 15840 }
};

const marginProfiles = {
  narrow: { top: 720, right: 720, bottom: 720, left: 720, header: 360, footer: 360 },
  normal: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
  wide: { top: 1800, right: 1800, bottom: 1800, left: 1800, header: 720, footer: 720 }
};

const lineSpacingProfiles = {
  compact: 276,
  normal: 312,
  relaxed: 360,
  loose: 420
};

function markdownRenderer() {
  if (cachedMarkdown) return cachedMarkdown;
  const sandbox = { window: {} };
  const rendererPath = path.join(__dirname, "..", "data", "markdown-renderer.js");
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(rendererPath, "utf8"), sandbox);
  cachedMarkdown = sandbox.window.LarkixMarkdown;
  return cachedMarkdown;
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function textFromHtml(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<span class="markdown-math markdown-math-inline"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, (_, latex) =>
        mathText(latex)
      )
      .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function mathText(latex) {
  const decoded = decodeHtml(latex);
  const renderer = markdownRenderer();
  return renderer && typeof renderer.mathToText === "function" ? renderer.mathToText(decoded) : decoded;
}

const mathSymbols = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  Gamma: "Γ",
  delta: "δ",
  Delta: "Δ",
  epsilon: "ε",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  omega: "ω",
  nabla: "∇",
  partial: "∂",
  infty: "∞",
  int: "∫",
  iint: "∬",
  iiint: "∭",
  oint: "∮",
  sum: "∑",
  cdot: "·",
  times: "×",
  div: "÷",
  pm: "±",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  neq: "≠",
  approx: "≈",
  to: "→",
  rightarrow: "→",
  leftarrow: "←"
};

const mathOperators = new Set(["sin", "cos", "tan", "lim", "log", "ln", "exp", "round", "min", "max"]);
const plainMathWords = new Set(["ADC", "CPU", "DMA", "GPIO", "HAL", "LSB", "MCU", "MOS", "PDF", "ST", "TVS"]);

function normalizeMathSource(value) {
  return decodeHtml(value)
    .trim()
    .replace(/\\begin\{(?:equation|equation\*|align|align\*|aligned|gather|gather\*|split|multline|multline\*|cases)\}/g, "")
    .replace(/\\end\{(?:equation|equation\*|align|align\*|aligned|gather|gather\*|split|multline|multline\*|cases)\}/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\(?:quad|qquad|,|;|:|!)/g, " ")
    .replace(/\\\\/g, "\n");
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
    if (depth === 0) return { value: source.slice(start + 1, cursor), end: cursor + 1, grouped: true };
  }
  return { value: source.slice(start + 1), end: source.length, grouped: true };
}

function readScriptValue(source, index) {
  const group = readBalanced(source, index, "{", "}");
  if (group.grouped) return group;
  const token = source.slice(index).match(/^[A-Za-z0-9]+/);
  if (token) return { value: token[0], end: index + token[0].length, grouped: false };
  return group;
}

function readCommand(source, index) {
  if (source[index] !== "\\") return null;
  const alpha = source.slice(index + 1).match(/^[A-Za-z]+/);
  if (alpha) return { name: alpha[0], end: index + 1 + alpha[0].length };
  return { name: source[index + 1] || "", end: Math.min(source.length, index + 2) };
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
  return { prefix: source.slice(0, leftStart), left, right, suffix: source.slice(rightEnd) };
}

function mathRun(text) {
  return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${xmlEscape(text)}</m:t></m:r>`;
}

function mathSubscript(base, sub) {
  return `<m:sSub><m:e>${base}</m:e><m:sub>${sub}</m:sub></m:sSub>`;
}

function mathSuperscript(base, sup) {
  return `<m:sSup><m:e>${base}</m:e><m:sup>${sup}</m:sup></m:sSup>`;
}

function mathSubSuperscript(base, sub, sup) {
  return `<m:sSubSup><m:e>${base}</m:e><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup></m:sSubSup>`;
}

function mathFraction(num, den) {
  return `<m:f><m:num>${num}</m:num><m:den>${den}</m:den></m:f>`;
}

function mathIdentifier(token) {
  if (!token || plainMathWords.has(token)) return mathRun(token);
  let match = token.match(/^([VRTCI])([A-Z][A-Z0-9]+)(\+?)$/);
  if (match) return `${mathSubscript(mathRun(match[1]), mathRun(match[2]))}${match[3] ? mathRun(match[3]) : ""}`;
  match = token.match(/^([VRTCI])([a-z][A-Za-z0-9]+)$/);
  if (match) return mathSubscript(mathRun(match[1]), mathRun(match[2]));
  match = token.match(/^([VRTCI])([0-9]+)$/);
  if (match) return mathSubscript(mathRun(match[1]), mathRun(match[2]));
  return mathRun(token);
}

function applyMathScripts(base, source, index) {
  let cursor = index;
  let sub = "";
  let sup = "";
  for (let step = 0; step < 2; step += 1) {
    while (source[cursor] === " ") cursor += 1;
    if (source[cursor] === "_") {
      const group = readScriptValue(source, cursor + 1);
      sub = mathOxml(group.value);
      cursor = group.end;
      continue;
    }
    if (source[cursor] === "^") {
      const group = readScriptValue(source, cursor + 1);
      sup = mathOxml(group.value);
      cursor = group.end;
      continue;
    }
    break;
  }
  if (sub && sup) return { xml: mathSubSuperscript(base, sub, sup), end: cursor };
  if (sub) return { xml: mathSubscript(base, sub), end: cursor };
  if (sup) return { xml: mathSuperscript(base, sup), end: cursor };
  return { xml: base, end: index };
}

function mathOxml(value) {
  const source = normalizeMathSource(value);
  const fraction = splitTopLevelFraction(source);
  if (fraction) return `${mathOxml(fraction.prefix)}${mathFraction(mathOxml(fraction.left), mathOxml(fraction.right))}${mathOxml(fraction.suffix)}`;

  let output = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      output += mathRun(" ");
      index += 1;
      continue;
    }
    if (char === "^" || char === "_") {
      const group = readScriptValue(source, index + 1);
      output += mathOxml(group.value);
      index = group.end;
      continue;
    }
    if (char === "(") {
      const group = readBalanced(source, index, "(", ")");
      const scripted = applyMathScripts(`${mathRun("(")}${mathOxml(group.value)}${mathRun(")")}`, source, group.end);
      output += scripted.xml;
      index = scripted.end;
      continue;
    }
    if (char === "[") {
      const group = readBalanced(source, index, "[", "]");
      const scripted = applyMathScripts(`${mathRun("[")}${mathOxml(group.value)}${mathRun("]")}`, source, group.end);
      output += scripted.xml;
      index = scripted.end;
      continue;
    }
    if (char === "{") {
      const group = readBalanced(source, index, "{", "}");
      output += mathOxml(group.value);
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
        const scripted = applyMathScripts(mathFraction(mathOxml(numerator.value), mathOxml(denominator.value)), source, denominator.end);
        output += scripted.xml;
        index = scripted.end;
        continue;
      }
      if (command.name === "sqrt") {
        const radicand = readBalanced(source, index, "{", "}");
        const scripted = applyMathScripts(`<m:rad><m:degHide m:val="1"/><m:e>${mathOxml(radicand.value)}</m:e></m:rad>`, source, radicand.end);
        output += scripted.xml;
        index = scripted.end;
        continue;
      }
      if (["mathbf", "boldsymbol", "mathrm", "mathit", "mathcal", "text", "operatorname"].includes(command.name)) {
        const group = readBalanced(source, index, "{", "}");
        output += mathOxml(group.value);
        index = group.end;
        continue;
      }
      if (mathSymbols[command.name]) {
        const scripted = applyMathScripts(mathRun(mathSymbols[command.name]), source, index);
        output += scripted.xml;
        index = scripted.end;
        continue;
      }
      if (mathOperators.has(command.name)) {
        const scripted = applyMathScripts(mathRun(command.name), source, index);
        output += scripted.xml;
        index = scripted.end;
        continue;
      }
      const scripted = applyMathScripts(mathRun(command.name.length === 1 ? command.name : command.name), source, index);
      output += scripted.xml;
      index = scripted.end;
      continue;
    }
    const word = source.slice(index).match(/^[A-Za-z][A-Za-z0-9]*/);
    if (word) {
      const scripted = applyMathScripts(mathIdentifier(word[0]), source, index + word[0].length);
      output += scripted.xml;
      index = scripted.end;
      continue;
    }
    const number = source.slice(index).match(/^\d+(?:\.\d+)?/);
    if (number) {
      const scripted = applyMathScripts(mathRun(number[0]), source, index + number[0].length);
      output += scripted.xml;
      index = scripted.end;
      continue;
    }
    const scripted = applyMathScripts(mathRun(char), source, index + 1);
    output += scripted.xml;
    index = scripted.end;
  }
  return output;
}

function normalizeDocxOptions(options = {}) {
  const pageSize = typeof options.pageSize === "string" ? options.pageSize.toLowerCase() : "a4";
  const margin = typeof options.margin === "string" ? options.margin.toLowerCase() : "normal";
  const lineSpacing = typeof options.lineSpacing === "string" ? options.lineSpacing.toLowerCase() : "relaxed";
  return {
    page: pageProfiles[pageSize] || pageProfiles.a4,
    margin: marginProfiles[margin] || marginProfiles.normal,
    lineSpacing: lineSpacingProfiles[lineSpacing] || lineSpacingProfiles.relaxed
  };
}

function paragraphProperties(style = "", options = {}) {
  const tabs = options.tabs ? '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs>' : "";
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : "";
  const line = options.docx?.lineSpacing ? ` w:line="${options.docx.lineSpacing}" w:lineRule="auto"` : "";
  const spacing = options.tight ? `<w:spacing w:after="80"${line}/>` : `<w:spacing w:after="160"${line}/>`;
  const indent = options.indent ? `<w:ind w:left="${options.indent}"/>` : "";
  return styleXml || spacing || indent || tabs ? `<w:pPr>${styleXml}${spacing}${indent}${tabs}</w:pPr>` : "";
}

function textRuns(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines
    .map((line, index) => {
      const br = index ? "<w:br/>" : "";
      return `<w:r>${br}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
    })
    .join("");
}

function paragraph(text, style = "", options = {}) {
  const pPr = paragraphProperties(style, options);
  return `<w:p>${pPr}${textRuns(text)}</w:p>`;
}

function paragraphFromRuns(runs, style = "", options = {}) {
  return `<w:p>${paragraphProperties(style, options)}${runs}</w:p>`;
}

function richRunsFromHtml(html) {
  const source = String(html || "");
  const runs = [];
  let cursor = 0;
  while (cursor < source.length) {
    const mathIndex = source.slice(cursor).search(/<span class="markdown-math markdown-math-inline"[^>]*data-latex="/i);
    const codeIndex = source.slice(cursor).search(/<code>/i);
    const brIndex = source.slice(cursor).search(/<br\s*\/?>/i);
    const candidates = [mathIndex, codeIndex, brIndex].filter((index) => index >= 0);
    if (!candidates.length) {
      runs.push(textRuns(textFromHtml(source.slice(cursor))));
      break;
    }
    const next = cursor + Math.min(...candidates);
    if (next > cursor) runs.push(textRuns(textFromHtml(source.slice(cursor, next))));

    if (/^<br\s*\/?>/i.test(source.slice(next))) {
      const br = source.slice(next).match(/^<br\s*\/?>/i)[0];
      runs.push("<w:r><w:br/></w:r>");
      cursor = next + br.length;
      continue;
    }

    if (/^<code>/i.test(source.slice(next))) {
      const end = source.toLowerCase().indexOf("</code>", next);
      if (end < 0) {
        runs.push(textRuns(textFromHtml(source.slice(next))));
        break;
      }
      runs.push(textRuns(textFromHtml(source.slice(next + 6, end))));
      cursor = end + 7;
      continue;
    }

    const openEnd = source.indexOf(">", next);
    if (openEnd < 0) {
      runs.push(textRuns(textFromHtml(source.slice(next))));
      break;
    }
    const openTag = source.slice(next, openEnd + 1);
    const latex = (openTag.match(/data-latex="([^"]*)"/i) || [])[1] || "";
    let depth = 1;
    const spanPattern = /<\/?span\b[^>]*>/gi;
    spanPattern.lastIndex = openEnd + 1;
    let end = -1;
    let spanMatch;
    while ((spanMatch = spanPattern.exec(source))) {
      if (/^<span\b/i.test(spanMatch[0])) depth += 1;
      else depth -= 1;
      if (depth === 0) {
        end = spanPattern.lastIndex;
        break;
      }
    }
    runs.push(`<m:oMath>${mathOxml(latex)}</m:oMath>`);
    cursor = end >= 0 ? end : openEnd + 1;
  }
  return runs.join("");
}

function paragraphFromHtml(html, style = "", options = {}) {
  return paragraphFromRuns(richRunsFromHtml(html), style, options);
}

function horizontalRule(docxOptions = {}) {
  const line = docxOptions.lineSpacing ? ` w:line="${docxOptions.lineSpacing}" w:lineRule="auto"` : "";
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="180"${line}/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="AAB8C5"/></w:pBdr></w:pPr></w:p>`;
}

function mathParagraph(latex, docxOptions = {}) {
  const value = String(latex || "").trim();
  if (!value) return "";
  const line = docxOptions.lineSpacing ? ` w:line="${docxOptions.lineSpacing}" w:lineRule="auto"` : "";
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="180"${line}/></w:pPr><m:oMath>${mathOxml(value)}</m:oMath></w:p>`;
}

function table(rows, docxOptions) {
  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((row) => row.length));
  const width = Math.max(1200, Math.floor(9000 / columnCount));
  const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="${width}"/>`).join("");
  const body = rows
    .map((row, rowIndex) => {
      const cells = Array.from({ length: columnCount }, (_, index) => row[index] || "");
      return `<w:tr>${cells
        .map((cell) => {
          const fill = rowIndex === 0 ? '<w:shd w:fill="EAF4FF"/>' : "";
          return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}</w:tcPr>${paragraphFromHtml(cell, "", { tight: true, docx: docxOptions })}</w:tc>`;
        })
        .join("")}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E3EF"/><w:left w:val="single" w:sz="4" w:color="D9E3EF"/><w:bottom w:val="single" w:sz="4" w:color="D9E3EF"/><w:right w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideH w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideV w:val="single" w:sz="4" w:color="D9E3EF"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function rowsFromTableHtml(html) {
  const rows = [];
  for (const rowMatch of String(html || "").matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
      cells.push(cellMatch[1]);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function blocksFromRenderedHtml(html) {
  const output = [];
  const pattern =
    /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>|<p>([\s\S]*?)<\/p>|<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>|<blockquote>([\s\S]*?)<\/blockquote>|<(ul|ol)>([\s\S]*?)<\/\6>|<div class="markdown-table-wrap">([\s\S]*?)<\/table><\/div>|<hr\s*\/>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    if (match[1]) {
      output.push({ type: "heading", level: Number(match[1]), text: textFromHtml(match[2]) });
    } else if (match[3]) {
      output.push({ type: "paragraph", text: textFromHtml(match[3]) });
    } else if (match[4]) {
      output.push({ type: "code", text: textFromHtml(match[4]) });
    } else if (match[5]) {
      const quoteText = [...match[5].matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((item) => textFromHtml(item[1])).join("\n");
      output.push({ type: "quote", text: quoteText || textFromHtml(match[5]) });
    } else if (match[6]) {
      const ordered = match[6] === "ol";
      let index = 1;
      for (const item of match[7].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const prefix = ordered ? `${index}. ` : "? ";
        output.push({ type: "list", text: `${prefix}${textFromHtml(item[1])}` });
        index += 1;
      }
    } else if (match[8]) {
      output.push({ type: "table", rows: rowsFromTableHtml(match[8]) });
    } else {
      output.push({ type: "rule" });
    }
  }
  return output;
}

function blocksFromRenderedHtmlV2(html) {
  const output = [];
  const pattern =
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|<div class="markdown-math markdown-math-display"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/div>|<p>([\s\S]*?)<\/p>|<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>|<blockquote>([\s\S]*?)<\/blockquote>|<(ul|ol)>([\s\S]*?)<\/\7>|<div class="markdown-table-wrap">([\s\S]*?)<\/table><\/div>|<hr\s*\/>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    if (match[1]) {
      output.push({ type: "heading", level: Number(match[1]), text: textFromHtml(match[2]) });
    } else if (match[3]) {
      output.push({ type: "math", latex: decodeHtml(match[3]), text: mathText(match[3]) });
    } else if (match[4]) {
      output.push({ type: "paragraph", html: match[4], text: textFromHtml(match[4]) });
    } else if (match[5]) {
      output.push({ type: "code", text: textFromHtml(match[5]) });
    } else if (match[6]) {
      const quoteText = [...match[6].matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((item) => textFromHtml(item[1])).join("\n");
      output.push({ type: "quote", text: quoteText || textFromHtml(match[6]) });
    } else if (match[7]) {
      const ordered = match[7] === "ol";
      let index = 1;
      for (const item of match[8].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const prefix = ordered ? `${index}. ` : "- ";
        output.push({ type: "list", html: `${xmlEscape(prefix)}${item[1]}`, text: `${prefix}${textFromHtml(item[1])}` });
        index += 1;
      }
    } else if (match[9]) {
      output.push({ type: "table", rows: rowsFromTableHtml(match[9]) });
    } else {
      output.push({ type: "rule" });
    }
  }
  return output;
}

function headingStyleForLevel(level) {
  const normalized = Math.min(3, Math.max(1, Number(level) || 1));
  return `Heading${normalized}`;
}

function documentXmlV2(markdown, title, options = {}) {
  const docxOptions = normalizeDocxOptions(options);
  const rendered = markdownRenderer().render(markdown, { includeH1: true });
  const blocks = blocksFromRenderedHtmlV2(rendered.html);
  const body = [];
  if (title) body.push(paragraph(title, "Title", { docx: docxOptions }));
  for (const block of blocks) {
    if (block.type === "heading") body.push(paragraph(block.text, headingStyleForLevel(block.level), { docx: docxOptions }));
    if (block.type === "paragraph") body.push(paragraphFromHtml(block.html, "", { docx: docxOptions }));
    if (block.type === "math") body.push(mathParagraph(block.latex || block.text, docxOptions));
    if (block.type === "quote") body.push(paragraph(block.text, "Quote", { indent: 420, docx: docxOptions }));
    if (block.type === "code") body.push(paragraph(block.text, "CodeBlock", { tabs: true, docx: docxOptions }));
    if (block.type === "list") body.push(paragraphFromHtml(block.html, "", { indent: 360, tight: true, docx: docxOptions }));
    if (block.type === "table") body.push(table(block.rows, docxOptions));
    if (block.type === "rule") body.push(horizontalRule(docxOptions));
  }
  const margin = docxOptions.margin;
  const page = docxOptions.page;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${page.width}" w:h="${page.height}"/><w:pgMar w:top="${margin.top}" w:right="${margin.right}" w:bottom="${margin.bottom}" w:left="${margin.left}" w:header="${margin.header}" w:footer="${margin.footer}" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function documentXml(markdown, title) {
  const rendered = markdownRenderer().render(markdown);
  const blocks = blocksFromRenderedHtml(rendered.html);
  const body = [];
  if (title) body.push(paragraph(title, "Title"));
  for (const block of blocks) {
    if (block.type === "heading") body.push(paragraph(block.text, `Heading${Math.max(1, block.level - 1)}`));
    if (block.type === "paragraph") body.push(paragraph(block.text));
    if (block.type === "quote") body.push(paragraph(block.text, "Quote", { indent: 420 }));
    if (block.type === "code") body.push(paragraph(block.text, "CodeBlock", { tabs: true }));
    if (block.type === "list") body.push(paragraph(block.text, "", { indent: 360, tight: true }));
    if (block.type === "table") body.push(table(block.rows));
    if (block.type === "rule") body.push(paragraph("────────────", "", { tight: true }));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml() {
  const baseFonts = '<w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Microsoft YaHei"/>';
  const heading = ({ styleId, name, outlineLevel, priority, before, after, size, color }) =>
    `<w:style w:type="paragraph" w:styleId="${styleId}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="${priority}"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="${after}"/><w:outlineLvl w:val="${outlineLevel}"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr></w:style>`;
  const headingStyles = [
    { styleId: "Heading1", name: "heading 1", outlineLevel: 0, priority: 9, before: 260, after: 120, size: 32, color: "0D6FD3" },
    { styleId: "Heading2", name: "heading 2", outlineLevel: 1, priority: 9, before: 220, after: 100, size: 28, color: "0B1220" },
    { styleId: "Heading3", name: "heading 3", outlineLevel: 2, priority: 9, before: 180, after: 80, size: 24, color: "123657" }
  ]
    .map(heading)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr>${baseFonts}<w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="40"/><w:color w:val="0B1220"/></w:rPr></w:style>${headingStyles}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="140"/><w:ind w:left="420"/></w:pPr><w:rPr>${baseFonts}<w:i/><w:color w:val="526F85"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="CodeBlock"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="80" w:after="160"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Microsoft YaHei"/><w:sz w:val="19"/><w:color w:val="1A3448"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E3EF"/><w:left w:val="single" w:sz="4" w:color="D9E3EF"/><w:bottom w:val="single" w:sz="4" w:color="D9E3EF"/><w:right w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideH w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideV w:val="single" w:sz="4" w:color="D9E3EF"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
}

function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
}

function wordRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const crc = crc32(content);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, content);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + content.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function markdownToDocx({ markdown, title, options }) {
  return zip([
    { name: "[Content_Types].xml", content: contentTypesXml() },
    { name: "_rels/.rels", content: packageRelsXml() },
    { name: "word/_rels/document.xml.rels", content: wordRelsXml() },
    { name: "word/document.xml", content: documentXmlV2(markdown, title, options) },
    { name: "word/styles.xml", content: stylesXml() }
  ]);
}

module.exports = { markdownToDocx, markdownRenderer };
