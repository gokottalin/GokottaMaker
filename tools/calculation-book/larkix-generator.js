"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { formatDisplay, unitInfo } = require("./evaluator");

function normalizedJson(value) {
  if (Array.isArray(value)) return value.map(normalizedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizedJson(value[key])]));
  }
  return value;
}

function digestBook(book) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizedJson(book))).digest("hex");
}

const dottedSymbolPattern = /[\p{L}][\p{L}\p{N}]*(?:\.[\p{L}][\p{L}\p{N}]*)+/gu;

function dottedSubscriptMath(value) {
  return String(value || "").replace(dottedSymbolPattern, (token) => {
    const [base, ...subscripts] = token.split(".");
    return `${base}_{${subscripts.join(".")}}`;
  });
}

function inlineWebSymbol(symbol) {
  return `$${dottedSubscriptMath(symbol)}$`;
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function webText(book, value) {
  let output = String(value || "");
  const symbols = [...new Set([...book.inputs, ...book.constants, ...book.equations].map((entry) => entry.symbol).filter((symbol) => symbol.includes(".")))]
    .sort((left, right) => right.length - left.length);
  for (const symbol of symbols) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_.])${escapePattern(symbol)}(?![\\p{L}\\p{N}_.])`, "gu");
    output = output.replace(pattern, (_, prefix) => `${prefix}${inlineWebSymbol(symbol)}`);
  }
  return output;
}

function displayInput(entry) {
  if (entry.status === "unresolved" || entry.value === undefined) return "未解决";
  return `${entry.value} ${entry.unit === "1" ? "" : entry.unit}`.trim();
}

function symbolDisplay(book, evaluation) {
  const values = new Map();
  for (const entry of [...book.inputs, ...book.constants]) values.set(entry.symbol, displayInput(entry));
  for (const equation of evaluation.equations) values.set(equation.symbol, formatDisplay(equation.value, equation.rounding));
  return values;
}

function sourcePublicLabels(book, refs) {
  const sourceMap = new Map(book.sources.map((source) => [source.id, source.publicLabel]));
  return refs.map((ref) => sourceMap.get(ref)).filter(Boolean);
}

function topologyTag(book) {
  const topology = String(book.design.topology || "电源拓扑");
  if (/buck-boost/i.test(topology)) return "Buck-Boost";
  if (/flyback/i.test(topology)) return "Flyback";
  return [...topology].slice(0, 32).join("");
}

function presentationOf(book) {
  return book.presentation || {
    voice: "neutral",
    style: "engineering",
    formulaNarration: "per_formula",
    formulaGapPt: 39,
    sectionOrder: [],
    sectionIntroductions: [],
    highlightEquationIds: [],
    symbolGlossary: [],
    symbolPlacement: "front_glossary",
    unresolvedNarration: "per_item",
    unresolvedSummary: "未决输入尚未闭合。"
  };
}

function expandedGlossary(book) {
  const map = new Map();
  for (const entry of presentationOf(book).symbolGlossary || []) {
    for (const symbol of entry.symbol.split(/\s+\/\s+/)) map.set(symbol.trim(), entry.meaning);
  }
  return map;
}

function trimSentence(value) {
  return String(value || "").trim().replaceAll("；", "，").replace(/[。，]+$/u, "");
}

function formulaSymbolNote(book, equation) {
  const glossary = expandedGlossary(book);
  const notes = [`${inlineWebSymbol(equation.symbol)} 表示${webText(book, trimSentence(glossary.get(equation.symbol) || equation.title))}`];
  for (const symbol of equation.dependencies) {
    if (!glossary.has(symbol)) continue;
    notes.push(`${inlineWebSymbol(symbol)} 表示${webText(book, trimSentence(glossary.get(symbol)))}`);
  }
  return `其中，${notes.join("；")}。`;
}

function buildL1Markdown(book, evaluation) {
  const lines = [];
  const presentation = presentationOf(book);
  const concise = presentation.style === "ieee_concise" && presentation.formulaNarration === "section_level";
  const firstPerson = presentation.voice === "first_person_singular";
  const sectionIntroduction = new Map(presentation.sectionIntroductions.map((entry) => [entry.section, entry.text]));
  const highlighted = new Set(presentation.highlightEquationIds);
  const glossary = presentation.symbolGlossary || [];
  const glossaryMap = expandedGlossary(book);
  const valueMap = symbolDisplay(book, evaluation);
  const resultByEquation = new Map(book.results.map((result) => [result.equationId, result]));
  const equationsBySection = new Map();
  for (const equation of evaluation.equations) {
    if (!equation.outputMappings.larkix.include) continue;
    if (!equationsBySection.has(equation.section)) equationsBySection.set(equation.section, []);
    equationsBySection.get(equation.section).push(equation);
  }

  lines.push(firstPerson
    ? "> 我将本计算书用于设计评审；尚未闭合的适用边界在结论中统一说明。"
    : "> 状态：草稿 / 私有。本文中的场景值、候选器件与目标阈值必须按来源和状态解释；未决输入闭环前不得用于量产签核。", "");
  lines.push("## 1. 设计输入、符号与假设", "");
  if (firstPerson) lines.push("我先冻结输入、输出、功率、频率和保护边界，再进入模式与器件计算。", "");
  lines.push(concise
    ? "| 符号 | 含义 | 数值 |"
    : "| 符号 | 数值 | 状态 | 来源或假设 |", concise ? "|---|---|---:|" : "|---|---:|---|---|");
  const assumptionMap = new Map(book.assumptions.map((item) => [item.id, item]));
  for (const entry of book.inputs) {
    if (concise && entry.status === "unresolved") continue;
    let traceText = "未解决";
    if (entry.trace.kind === "source") traceText = sourcePublicLabels(book, entry.trace.refs).join("；");
    if (entry.trace.kind === "assumption") traceText = entry.trace.refs.map((ref) => assumptionMap.get(ref)?.title).filter(Boolean).join("；");
    lines.push(concise
      ? `| ${inlineWebSymbol(entry.symbol)} | ${webText(book, glossaryMap.get(entry.symbol) || entry.title)} | ${displayInput(entry)} |`
      : `| ${inlineWebSymbol(entry.symbol)} | ${displayInput(entry)} | ${entry.status} | ${webText(book, traceText)} |`);
  }
  lines.push("");
  if (concise && presentation.symbolPlacement === "front_glossary") {
    const inputSymbols = new Set(book.inputs.map((entry) => entry.symbol));
    const supplementalGlossary = glossary.filter((entry) => !inputSymbols.has(entry.symbol));
    if (supplementalGlossary.length) {
      lines.push("### 专用符号", "", "| 符号 | 定义 |", "|---|---|");
      for (const entry of supplementalGlossary) lines.push(`| ${inlineWebSymbol(entry.symbol)} | ${webText(book, entry.meaning)} |`);
      lines.push("");
    }
  }
  lines.push(firstPerson ? "我采用以下暂定假设：" : "当前假设：", "");
  for (const assumption of book.assumptions.filter((entry) => entry.status === "active")) {
    lines.push(concise
      ? `- 我按“${webText(book, assumption.title)}”计算；${webText(book, assumption.effect)}`
      : firstPerson
      ? `- 我暂按“${webText(book, assumption.title)}”计算：${webText(book, assumption.reason)}；取得证据后，我将按“${webText(book, assumption.replacement)}”更新。`
      : `- ${webText(book, assumption.title)}：${webText(book, assumption.reason)} 替换证据：${webText(book, assumption.replacement)}`);
  }

  let sectionNumber = 2;
  const orderedSections = [...presentation.sectionOrder];
  for (const section of equationsBySection.keys()) if (!orderedSections.includes(section)) orderedSections.push(section);
  if (!orderedSections.length) orderedSections.push(...equationsBySection.keys());
  for (const section of orderedSections) {
    const equations = equationsBySection.get(section) || [];
    lines.push("", `## ${sectionNumber}. ${section}`, "");
    if (sectionIntroduction.has(section)) lines.push(webText(book, sectionIntroduction.get(section)), "");
    for (const equation of equations) {
      const substitution = equation.dependencies.map((symbol) => `${inlineWebSymbol(symbol)} = ${valueMap.get(symbol) || "未定义"}`).join("，");
      const result = resultByEquation.get(equation.id);
      const sentinelText = !concise && result?.sentinel ? "；跨输出哨兵结果" : "";
      lines.push(`### ${equation.title}`, "", "$$", dottedSubscriptMath(equation.displayExpression), "$$");
      const mapping = equation.outputMappings.larkix;
      if (mapping.derivationSlug) lines.push(`{{derive:${mapping.derivationSlug}|${mapping.jumpLabel}|${mapping.color}}}`);
      if (presentation.symbolPlacement === "formula_local") lines.push("", formulaSymbolNote(book, equation));
      if (concise) {
        lines.push("", `${firstPerson ? "我代入" : "代入"} ${substitution}，${firstPerson ? "得到" : "结果为"} ${inlineWebSymbol(equation.symbol)} ≈ **${formatDisplay(equation.value, equation.rounding)}**${sentinelText}。`);
        if (highlighted.has(equation.id)) {
          lines.push("", `> ${firstPerson ? "我将该结果用于" : "该结果用于"}${webText(book, equation.applicability)}；边界：${webText(book, equation.validity)}。`);
        }
        lines.push("");
        continue;
      }
      lines.push(
        "",
        `代入：${substitution}。`,
        "",
        `结果：${inlineWebSymbol(equation.symbol)} ≈ **${formatDisplay(equation.value, equation.rounding)}**${sentinelText}。`,
        "",
        `适用范围：${webText(book, equation.applicability)}`,
        "",
        `有效性边界：${webText(book, equation.validity)}`
      );
      if (equation.trace.kind === "source") {
        lines.push("", `公开来源：${sourcePublicLabels(book, equation.trace.refs).join("；")}`);
      } else if (equation.trace.kind === "derivation") {
        lines.push("", `来源路径：${webText(book, equation.trace.note)}`);
      } else {
        lines.push("", `来源路径：数学/物理定义；${webText(book, equation.trace.note)}`);
      }
      lines.push("");
    }
    sectionNumber += 1;
  }

  lines.push(`## ${sectionNumber}. 容差、验证与结论`, "");
  if (firstPerson) lines.push(concise
    ? "我依据当前标称计算给出以下工程判断和裕量结论。"
    : "我依据当前标称计算作出以下判断；未闭合项继续阻断签核。", "");
  for (const decision of book.decisions.filter((entry) => !concise || entry.status !== "blocked")) {
    lines.push(`- ${concise ? "" : `[${decision.status}] `}${firstPerson ? "我确认：" : ""}${webText(book, decision.statement)}`);
  }
  lines.push("", firstPerson ? "我检查的裕量：" : "裕量：", "");
  const marginStatus = { pass: "满足", fail: "不满足", unresolved: "待验证" };
  for (const margin of book.margins) lines.push(`- [${concise ? marginStatus[margin.status] : margin.status}] ${webText(book, margin.title)}：${webText(book, margin.requirement)}`);
  if (concise) {
    lines.push("", "### 适用边界", "", webText(book, presentation.unresolvedSummary), "", "> 我只在上述边界内使用本册结果。", "");
    return lines.join("\n").trimEnd();
  }
  lines.push("", firstPerson ? "我保留以下签核阻断项：" : "阻断签核的必填项：", "");
  for (const item of book.unresolvedItems.filter((entry) => entry.mandatory && entry.status === "open")) {
    lines.push(`- ${webText(book, item.title)}：${webText(book, item.resolution)}`);
  }
  lines.push("", "## 风险与验证", "");
  for (const risk of book.risks) lines.push(`- **${risk.severity}**：${webText(book, risk.statement)} ${firstPerson ? "我采用的处置" : "处置"}：${webText(book, risk.mitigation)}`);
  lines.push("", firstPerson ? "我计划执行以下验证：" : "计划验证：", "");
  for (const validation of book.validations) lines.push(`- [${validation.status}] ${webText(book, validation.title)}：${webText(book, validation.acceptance)}`);
  lines.push("", firstPerson
    ? "> 只有在必填输入、实测波形、热与环路证据全部回填后，我才把本草稿转入评审。"
    : "> 只有在必填输入、实测波形、热与环路证据全部回填后，才能把本草稿转入评审。", "");
  return lines.join("\n").trimEnd();
}

function buildDerivationMarkdown(book, derivation) {
  const firstPerson = presentationOf(book).voice === "first_person_singular";
  const assumptionMap = new Map(book.assumptions.map((item) => [item.id, item]));
  const parentEquation = book.equations.find((equation) => equation.id === derivation.parentFormulaId);
  const parentFormula = parentEquation ? inlineWebSymbol(parentEquation.symbol) : `\`${derivation.parentFormulaId}\``;
  const lines = [
    `> 推导层级：${derivation.level}。父公式：${parentFormula}。`,
    "",
    firstPerson ? `我采用以下路径：${webText(book, derivation.summary)}` : webText(book, derivation.summary),
    "",
    "## 前提与适用范围",
    "",
    `- 前置知识：${derivation.prerequisites.map((item) => webText(book, item)).join("；")}`,
    `- 假设：${derivation.assumptions.length ? derivation.assumptions.map((id) => webText(book, assumptionMap.get(id)?.title || id)).join("；") : "无额外工程假设"}`,
    `- ${firstPerson ? "我限定的有效范围" : "有效范围"}：${webText(book, derivation.validity)}`,
    "",
    "## 逐步推导",
    ""
  ];
  derivation.steps.forEach((step, index) => {
    lines.push(`### ${index + 1}. ${webText(book, step.statement)}`, "", "$$", dottedSubscriptMath(step.expression), "$$", "", `${firstPerson ? "我据此判断：" : ""}${webText(book, step.justification)}`, "", `${firstPerson ? "我采用的依据" : "依据"}：${webText(book, step.trace.note)}`, "");
  });
  lines.push("## 量纲检查", "", webText(book, derivation.dimensionalCheck), "", `[返回上一级计算书](./derive.html?slug=${derivation.returnTarget})`, "");
  return lines.join("\n").trimEnd();
}

function nodeStatus(book, preview) {
  return preview ? book.publication.previewOverride : book.publication.canonical;
}

function generateLarkixPackage(book, evaluation, options = {}) {
  const preview = Boolean(options.preview);
  const status = nodeStatus(book, preview);
  const nodes = [
    {
      id: book.outputs.larkix.l1Slug,
      slug: book.outputs.larkix.l1Slug,
      nodeType: "derivation",
      symbol: "CalculationBook",
      title: book.title,
      summary: presentationOf(book).voice === "first_person_singular"
        ? `我在 ${book.title} 中依次完成规格、功率级、保护、控制与验证计算；未决输入闭环前保持签核阻断。`
        : `从同一 JSON 母版生成的 ${book.title} L1 设计计算主线；未决输入闭环前保持签核阻断。`,
      markdown: buildL1Markdown(book, evaluation),
      cover: "",
      accentColor: "purple",
      tags: `电力电子, ${topologyTag(book)}, 计算书, L1`,
      publishStatus: status.publishStatus,
      visibilityStatus: status.visibilityStatus
    },
    ...book.derivations.map((derivation) => ({
      id: derivation.slug,
      slug: derivation.slug,
      nodeType: "derivation",
      symbol: derivation.symbol,
      title: derivation.title,
      summary: derivation.summary,
      markdown: buildDerivationMarkdown(book, derivation),
      cover: "",
      accentColor: derivation.color,
      tags: `电力电子, ${topologyTag(book)}, ${derivation.level.startsWith("L2") ? "L2" : "L3"}, 公式推导`,
      publishStatus: status.publishStatus,
      visibilityStatus: status.visibilityStatus
    }))
  ];
  return {
    schemaVersion: "larkix.calculation-book-package.v1",
    generatorVersion: "1.0.0",
    bookId: book.bookId,
    revision: book.revision,
    sourceDigest: digestBook(book),
    preview,
    routeBase: book.outputs.larkix.routeBase,
    calculations: evaluation.equations.map((equation) => ({
      equationId: equation.id,
      symbol: equation.symbol,
      valueSi: equation.value,
      unit: equation.unit,
      displayValue: formatDisplay(equation.value, equation.rounding),
      sentinel: Boolean(book.results.find((result) => result.equationId === equation.id)?.sentinel)
    })),
    nodes
  };
}

function validateLarkixPackage(book, pkg) {
  const errors = [];
  const slugs = new Set(pkg.nodes.map((node) => node.slug));
  if (slugs.size !== pkg.nodes.length) errors.push("duplicate node slugs");
  const privatePatterns = [/[A-Z]:[\\/]/, /src\.[a-z0-9.-]+\s+locator/i, /10731/];
  if (book.presentation?.voice === "first_person_singular") {
    privatePatterns.push(/Agent\d*/i, /A13_CalculationBookEngineering/i, /用户/);
  }
  const shortcodePattern = /\{\{derive:([^|{}\s]+)\|([^|{}]+?)(?:\|([^|{}]+?))?\}\}/g;
  for (const node of pkg.nodes) {
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(node.slug)) errors.push(`${node.slug}: invalid slug`);
    if (node.markdown.includes("\ufffd") || node.markdown.includes("???")) errors.push(`${node.slug}: mojibake marker`);
    for (const pattern of privatePatterns) if (pattern.test(node.markdown)) errors.push(`${node.slug}: private metadata leaked`);
    let match;
    while ((match = shortcodePattern.exec(node.markdown))) {
      if (!slugs.has(match[1])) errors.push(`${node.slug}: dangling derive target ${match[1]}`);
    }
  }
  const expectedStatus = pkg.preview ? book.publication.previewOverride : book.publication.canonical;
  for (const node of pkg.nodes) {
    if (node.publishStatus !== expectedStatus.publishStatus || node.visibilityStatus !== expectedStatus.visibilityStatus) {
      errors.push(`${node.slug}: publication status mismatch`);
    }
  }
  return { ok: errors.length === 0, errors, nodes: pkg.nodes.length, slugs: [...slugs] };
}

function writeLarkixPackage(book, evaluation, bookDir) {
  const pkg = generateLarkixPackage(book, evaluation, { preview: false });
  const outputPath = path.join(bookDir, book.outputs.larkix.packageFilename);
  const markdownDir = path.join(path.dirname(outputPath), "larkix");
  fs.mkdirSync(markdownDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  for (const node of pkg.nodes) fs.writeFileSync(path.join(markdownDir, `${node.slug}.md`), `${node.markdown}\n`, "utf8");
  return { package: pkg, outputPath, markdownDir, validation: validateLarkixPackage(book, pkg) };
}

module.exports = {
  buildDerivationMarkdown,
  buildL1Markdown,
  dottedSubscriptMath,
  digestBook,
  generateLarkixPackage,
  validateLarkixPackage,
  writeLarkixPackage
};
