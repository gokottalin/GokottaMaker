"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { formatDisplay } = require("./evaluator");
const { digestBook } = require("./larkix-generator");

const WS = "http://schemas.mathsoft.com/worksheet30";
const ML = "http://schemas.mathsoft.com/math30";
const U = "http://schemas.mathsoft.com/units10";

const RESULT_UNITS = Object.freeze({
  V: "volt",
  A: "ampere",
  W: "watt",
  J: "joule",
  H: "henry",
  Ω: "ohm",
  Hz: "hertz",
  s: "second",
  T: "tesla",
  C: "coulomb",
  F: "farad",
  K: "kelvin"
});

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fmt(value) {
  if (!Number.isFinite(value)) throw new Error(`Non-finite Mathcad value: ${value}`);
  if (value === 0) return "0";
  return Number(value.toPrecision(15)).toString();
}

function mid(symbol) {
  const index = String(symbol).indexOf(".");
  if (index < 0) return `<ml:id xml:space="preserve">${esc(symbol)}</ml:id>`;
  const base = symbol.slice(0, index);
  const subscript = symbol.slice(index + 1);
  return `<ml:id xml:space="preserve" subscript="${esc(subscript)}">${esc(base)}</ml:id>`;
}

function real(value) {
  return `<ml:real>${esc(fmt(Number(value)))}</ml:real>`;
}

function binary(op, args) {
  if (!args.length) throw new Error(`${op} requires arguments`);
  if (args.length === 1) return args[0];
  let expression = `<ml:apply><ml:${op}/>${args[0]}${args[1]}</ml:apply>`;
  for (const arg of args.slice(2)) expression = `<ml:apply><ml:${op}/>${expression}${arg}</ml:apply>`;
  return expression;
}

function parens(value) {
  return `<ml:parens>${value}</ml:parens>`;
}

function inputValueXml(value, unit) {
  if (unit === "1") return real(value);
  return binary("mult", [real(value), mid(unit)]);
}

function astXml(node, parentOp = "") {
  if (node.op === "literal") return inputValueXml(node.value, node.unit || "1");
  if (node.op === "ref") return mid(node.symbol);
  const args = (node.args || []).map((child) => {
    const rendered = astXml(child, node.op);
    if (["multiply", "divide"].includes(node.op) && ["add", "subtract"].includes(child.op)) return parens(rendered);
    return rendered;
  });
  if (node.op === "add") return binary("plus", args);
  if (node.op === "subtract") return binary("minus", args);
  if (node.op === "multiply") return binary("mult", args);
  if (node.op === "divide") {
    if (args.length !== 2) throw new Error("Mathcad divide requires two arguments");
    return `<ml:apply><ml:div/>${args[0]}${args[1]}</ml:apply>`;
  }
  if (node.op === "power") {
    if (args.length !== 2) throw new Error("Mathcad power requires two arguments");
    return `<ml:apply><ml:pow/>${args[0]}${args[1]}</ml:apply>`;
  }
  if (node.op === "sqrt") {
    if (args.length !== 1) throw new Error("Mathcad sqrt requires one argument");
    return `<ml:apply><ml:sqrt/>${args[0]}</ml:apply>`;
  }
  if (node.op === "negate") {
    if (args.length !== 1) throw new Error("Mathcad negate requires one argument");
    return `<ml:apply><ml:neg/>${args[0]}</ml:apply>`;
  }
  throw new Error(`Mathcad operator is not supported: ${node.op}`);
}

function resultXml(value, unit) {
  if (unit === "1") return `<result xmlns="${ML}"><real>${fmt(value)}</real></result>`;
  const mathcadUnit = RESULT_UNITS[unit];
  if (!mathcadUnit) throw new Error(`No Mathcad result unit mapping for ${unit}`);
  return `<result xmlns="${ML}"><unitedValue><ml:real>${fmt(value)}</ml:real><unitMonomial xmlns="${U}"><unitReference unit="${mathcadUnit}"/></unitMonomial></unitedValue></result>`;
}

function defineXml(symbol, rhs, resultValue, resultUnit) {
  const evaluated = resultValue === undefined
    ? rhs
    : `<ml:eval placeholderMultiplicationStyle="default">${rhs}${resultXml(resultValue, resultUnit)}</ml:eval>`;
  return `<math optimize="false" disable-calc="false"><ml:define xmlns:ml="${ML}">${mid(symbol)}${evaluated}</ml:define></math>`;
}

function textHeight(text, widthChars = 56) {
  return 18 + 18 * Math.max(1, Math.ceil([...String(text)].length / widthChars));
}

function textRegion(regionId, top, text, style = "Normal", height = null, tag = "") {
  const actualHeight = height ?? textHeight(text);
  return `<region region-id="${regionId}" left="18" top="${top.toFixed(2)}" width="920" height="${actualHeight.toFixed(2)}" align-x="18" align-y="${(top + 12).toFixed(2)}" show-border="false" show-highlight="false" is-protected="false" z-order="0" background-color="inherit" tag="${esc(tag)}"><text use-page-width="false" push-down="false" lock-width="false"><p style="${esc(style)}" margin-left="inherit" margin-right="inherit" text-indent="inherit" text-align="inherit" list-style-type="inherit" tabs="inherit">${esc(text)}</p></text></region>`;
}

function mathRegion(regionId, top, body, tag) {
  return `<region region-id="${regionId}" left="18" top="${top.toFixed(2)}" width="760" height="29.00" align-x="34" align-y="${(top + 20).toFixed(2)}" show-border="false" show-highlight="false" is-protected="false" z-order="0" background-color="inherit" tag="${esc(tag)}">${body}<rendering item-idref="16"/></region>`;
}

class WorksheetBuilder {
  constructor(options = {}) {
    this.regionId = 1;
    this.top = 18;
    this.parts = [];
    this.areaNames = [];
    this.formulaGapPt = options.formulaGapPt || 39;
  }

  nextId() {
    const id = this.regionId;
    this.regionId += 1;
    return id;
  }

  addText(text, style = "Normal", height = null, gap = 10, tag = "") {
    const actualHeight = height ?? (style === "Title" ? 42 : style === "Heading 1" ? 30 : textHeight(text));
    this.parts.push(textRegion(this.nextId(), this.top, text, style, actualHeight, tag));
    this.top += actualHeight + gap;
  }

  addArea(title, items) {
    this.addText(title, "Heading 1", 30, 10, `section:${this.areaNames.length + 1}`);
    const outerId = this.nextId();
    const areaTop = this.top;
    let innerTop = areaTop + 18;
    const innerParts = [];
    let firstInner = null;
    let lastInner = null;

    for (const item of items) {
      const regionId = this.nextId();
      firstInner ??= regionId;
      lastInner = regionId;
      if (item.kind === "math") {
        innerParts.push(mathRegion(regionId, innerTop, item.body, item.tag));
        innerTop += this.formulaGapPt;
        if (item.explanation) {
          const explanationId = this.nextId();
          lastInner = explanationId;
          const height = textHeight(item.explanation);
          innerParts.push(textRegion(explanationId, innerTop, item.explanation, "Normal", height, `${item.tag}:explanation`));
          innerTop += height + 7;
        }
      } else if (item.kind === "text") {
        const height = textHeight(item.text);
        innerParts.push(textRegion(regionId, innerTop, item.text, "Normal", height, item.tag || ""));
        innerTop += height + 7;
      } else {
        throw new Error(`Unknown worksheet area item: ${item.kind}`);
      }
    }
    if (firstInner === null || lastInner === null) throw new Error(`Empty Mathcad area: ${title}`);
    const areaHeight = innerTop - areaTop + 24;
    this.parts.push(`<region region-id="${outerId}" left="0" top="${areaTop.toFixed(2)}" width="6000" align-x="6000" align-y="${(areaTop + 12).toFixed(2)}" show-border="false" show-highlight="false" is-protected="false" z-order="0" background-color="inherit" tag="area:${esc(title)}" height="${areaHeight.toFixed(2)}"><area is-collapsed="false" name="${esc(title)}" show-name="false" show-border="true" show-icon="true" show-timestamp="true" allow-expand="false" is-locked="false" timestamp="" top-lock-id="${firstInner}" bottom-lock-id="${lastInner}" bottom-tag="">${innerParts.join("")}</area><rendering item-idref="16"/></region>`);
    this.top += areaHeight + 36;
    this.areaNames.push(title);
  }

  xml() {
    return `<regions>\n${this.parts.join("\n")}\n</regions>`;
  }
}

function sourceSummary(book, refs) {
  const sourceMap = new Map(book.sources.map((source) => [source.id, source]));
  return refs.map((id) => `${id}（${sourceMap.get(id)?.publicLabel || "来源缺失"}）`).join("；");
}

function expandedSymbolGlossary(book) {
  const map = new Map();
  for (const entry of book.presentation?.symbolGlossary || []) {
    for (const symbol of entry.symbol.split(/\s+\/\s+/)) map.set(symbol.trim(), entry.meaning);
  }
  return map;
}

function trimSentence(value) {
  return String(value || "").trim().replaceAll("；", "，").replace(/[。，]+$/u, "");
}

function inputExplanation(book, input, concise = false) {
  if (concise) {
    const meaning = expandedSymbolGlossary(book).get(input.symbol) || input.title;
    return `其中，${input.symbol} 表示${trimSentence(meaning)}。`;
  }
  let trace = "";
  if (input.trace.kind === "source") trace = `来源：${sourceSummary(book, input.trace.refs)}`;
  else if (input.trace.kind === "assumption") trace = `假设：${input.trace.refs.join("、")}`;
  else trace = "未解决，禁止签核";
  return `${input.symbol} 为${input.title}；量纲：${input.unit}；状态：${input.status}；${trace}；适用：${input.applicability}。`;
}

function equationExplanation(book, equation, concise = false, includeBoundary = false) {
  if (concise) {
    const glossary = expandedSymbolGlossary(book);
    const notes = [`${equation.symbol} 表示${trimSentence(glossary.get(equation.symbol) || equation.title)}`];
    for (const symbol of equation.dependencies) {
      if (glossary.has(symbol)) notes.push(`${symbol} 表示${trimSentence(glossary.get(symbol))}`);
    }
    const boundary = includeBoundary ? ` 我将该结果用于${equation.applicability}；边界为${equation.validity}。` : "";
    return `其中，${notes.join("；")}。我得到 ${equation.symbol}≈${formatDisplay(equation.value, equation.rounding)}。${boundary}`;
  }
  const trace = equation.trace.kind === "derivation"
    ? `推导：${equation.trace.refs.join("、")}`
    : equation.trace.kind === "source" ? `来源：${equation.trace.refs.join("、")}` : `依据：${equation.trace.note}`;
  return `${equation.displayExpression}；结果约 ${formatDisplay(equation.value, equation.rounding)}；量纲：${equation.unit}；${trace}；适用：${equation.applicability}；边界：${equation.validity}。`;
}

function buildRegions(book, evaluation) {
  const presentation = book.presentation || {};
  const firstPerson = presentation.voice === "first_person_singular";
  const concise = presentation.style === "ieee_concise" && presentation.formulaNarration === "section_level";
  const highlighted = new Set(presentation.highlightEquationIds || []);
  const sectionIntroduction = new Map((presentation.sectionIntroductions || []).map((entry) => [entry.section, entry.text]));
  const builder = new WorksheetBuilder({ formulaGapPt: presentation.formulaGapPt || 39 });
  builder.addText(book.outputs.mathcad.worksheetTitle, "Title", 42, 8, "front:title");
  builder.addText(firstPerson
    ? `我采用版本 ${book.revision} 执行本次计算；bookId=${book.bookId}。`
    : `bookId=${book.bookId}；revision=${book.revision}；由同一 JSON 母版生成 Mathcad 15 与 Larkix 内容。`, "Normal", null, 8, "front:identity");
  builder.addText(firstPerson
    ? "我将本册用于设计评审；尚未闭合的适用边界在结论中统一说明。"
    : "本册为内部草稿。场景值、候选器件与目标阈值必须按来源和状态解释；未决输入闭环前不得用于生产签核。", "Normal", null, 8, "front:warning");
  if (!concise) builder.addText(`签核状态：${book.design.signoff.status}；未解决必填项 ${book.design.signoff.blockedBy.length} 项。`, "Normal", null, 10, "front:signoff");

  const inputItems = [];
  if (firstPerson) inputItems.push({ kind: "text", text: "我先冻结输入、输出、功率、频率和保护边界，再进入模式与器件计算。", tag: "inputs:introduction" });
  if (concise && presentation.symbolPlacement === "front_glossary" && presentation.symbolGlossary?.length) {
    for (let index = 0; index < presentation.symbolGlossary.length; index += 5) {
      const entries = presentation.symbolGlossary.slice(index, index + 5);
      inputItems.push({
        kind: "text",
        text: entries.map((entry) => `${entry.symbol}：${entry.meaning}`).join("；"),
        tag: `symbols:${index / 5 + 1}`
      });
    }
  }
  for (const input of [...book.inputs, ...book.constants]) {
    if (input.status === "unresolved") {
      if (concise) continue;
      inputItems.push({ kind: "text", text: `未解决警告 [${input.id}]：${input.title}；${input.trace.note}；该项${input.requiredForSignoff ? "阻断" : "不阻断"}签核。`, tag: `unresolved:${input.id}` });
      continue;
    }
    inputItems.push({
      kind: "math",
      body: defineXml(input.symbol, inputValueXml(input.value, input.unit)),
      explanation: inputExplanation(book, input, concise),
      tag: `input:${input.id}`
    });
  }
  if (!concise) inputItems.push({ kind: "text", text: `公开来源标签：${book.sources.map((source) => `${source.id}=${source.publicLabel}`).join("；")}。详细定位只保留在私有 JSON 母版。`, tag: "sources:public-labels" });
  builder.addArea("1. 设计输入与符号", inputItems);

  const equationsBySection = new Map();
  for (const equation of evaluation.equations) {
    if (!equation.outputMappings.mathcad.include) continue;
    if (!equationsBySection.has(equation.section)) equationsBySection.set(equation.section, []);
    equationsBySection.get(equation.section).push(equation);
  }
  let sectionIndex = 2;
  const orderedSections = [...(presentation.sectionOrder || [])];
  for (const section of equationsBySection.keys()) if (!orderedSections.includes(section)) orderedSections.push(section);
  if (!orderedSections.length) orderedSections.push(...equationsBySection.keys());
  for (const section of orderedSections) {
    const items = [];
    if (sectionIntroduction.has(section)) items.push({ kind: "text", text: sectionIntroduction.get(section), tag: `section-intro:${sectionIndex}` });
    for (const equation of equationsBySection.get(section) || []) items.push({
      kind: "math",
      body: defineXml(equation.symbol, astXml(equation.expression), equation.value, equation.unit),
      explanation: equationExplanation(book, equation, concise, highlighted.has(equation.id)),
      tag: `formula:${equation.id}`
    });
    builder.addArea(`${sectionIndex}. ${section}`, items);
    sectionIndex += 1;
  }

  const closingItems = [];
  if (firstPerson) closingItems.push({ kind: "text", text: concise
    ? "我依据当前标称计算给出工程判断、裕量和适用边界。"
    : "我依据当前标称计算检查裕量、风险与验证项；未闭合项继续阻断签核。", tag: "closing:introduction" });
  if (concise) {
    for (const decision of book.decisions.filter((entry) => entry.status === "accepted")) {
      closingItems.push({ kind: "text", text: `我确认：${decision.statement}`, tag: `decision:${decision.id}` });
    }
  }
  const marginStatus = { pass: "满足", fail: "不满足", unresolved: "待验证" };
  for (const margin of book.margins) closingItems.push({ kind: "text", text: `${firstPerson ? "我检查的" : ""}裕量 [${concise ? marginStatus[margin.status] : margin.status}] ${margin.title}：${margin.requirement}。`, tag: `margin:${margin.id}` });
  if (concise) {
    closingItems.push({ kind: "text", text: `适用边界：${presentation.unresolvedSummary}`, tag: "closing:boundary" });
  }
  if (!concise) {
  for (const risk of book.risks) closingItems.push({ kind: "text", text: `风险 [${risk.severity}] ${risk.statement}；${firstPerson ? "我采用的处置" : "处置"}：${risk.mitigation}`, tag: `risk:${risk.id}` });
  for (const item of book.unresolvedItems.filter((entry) => entry.status === "open")) closingItems.push({ kind: "text", text: `待确认 [${item.mandatory ? "阻断签核" : "后续补齐"}] ${item.title}；解决：${item.resolution}`, tag: `open:${item.id}` });
  for (const validation of book.validations) closingItems.push({ kind: "text", text: `验证 [${validation.status}] ${validation.title}；验收：${validation.acceptance}`, tag: `validation:${validation.id}` });
  }
  builder.addArea(`${sectionIndex}. 容差、验证与结论`, closingItems);
  return { regions: builder.xml(), areaNames: builder.areaNames };
}

function stableUuid(seed) {
  const hex = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function replaceElementText(xml, tag, value) {
  const pattern = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`);
  if (pattern.test(xml)) return xml.replace(pattern, `<${tag}>${esc(value)}</${tag}>`);
  const selfClosing = new RegExp(`<${tag}\\s*/>`);
  if (selfClosing.test(xml)) return xml.replace(selfClosing, `<${tag}>${esc(value)}</${tag}>`);
  throw new Error(`Template metadata tag is missing: ${tag}`);
}

function buildMathcadXml(book, evaluation, templateXml) {
  const marker = `Larkix generated calculation book; bookId=${book.bookId}; sourceDigest=${digestBook(book)}`;
  let xml = templateXml;
  xml = replaceElementText(xml, "title", book.outputs.mathcad.worksheetTitle);
  xml = replaceElementText(xml, "description", marker);
  xml = replaceElementText(xml, "author", "Larkix Engineering");
  xml = replaceElementText(xml, "company", "");
  xml = replaceElementText(xml, "keywords", `power electronics, ${book.design.topology}, traceable calculation book`);
  xml = replaceElementText(xml, "revisedBy", "Larkix Engineering");
  xml = replaceElementText(xml, "documentID", stableUuid(`${book.bookId}:document`));
  xml = replaceElementText(xml, "versionID", stableUuid(`${book.bookId}:${book.revision}:version`));
  const start = xml.indexOf("<regions>");
  const end = xml.indexOf("<binaryContent", start);
  if (start < 0 || end < 0) throw new Error("Mathcad template regions/binaryContent boundary is missing");
  const built = buildRegions(book, evaluation);
  xml = `${xml.slice(0, start)}${built.regions}\n\t${xml.slice(end)}`;
  return { xml, marker, areaNames: built.areaNames };
}

function writeMathcad(book, evaluation, outputPath, templatePath = book.outputs.mathcad.template) {
  const resolvedTemplate = path.resolve(templatePath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedTemplate.toLowerCase() === resolvedOutput.toLowerCase()) throw new Error("Refusing to overwrite the Mathcad input template");
  if (!fs.existsSync(resolvedTemplate)) throw new Error(`Mathcad template not found: ${resolvedTemplate}`);
  if (fs.existsSync(resolvedOutput)) {
    const existing = fs.readFileSync(resolvedOutput, "utf8");
    if (!existing.includes(`bookId=${book.bookId}`)) throw new Error(`Refusing to overwrite an unrelated existing worksheet: ${resolvedOutput}`);
  }
  const templateXml = fs.readFileSync(resolvedTemplate, "utf8");
  const built = buildMathcadXml(book, evaluation, templateXml);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, built.xml, "utf8");
  return { outputPath: resolvedOutput, templatePath: resolvedTemplate, ...built };
}

function xmlStructureReport(filename) {
  const python = [
    "import json,sys,xml.etree.ElementTree as ET",
    `WS='{${WS}}'`,
    `ML='{${ML}}'`,
    "root=ET.parse(sys.argv[1]).getroot()",
    "areas=[]; area_errors=[]; diffs=[]; bad_ops=[]; formula_results={}",
    "for outer in root.iter(WS+'region'):",
    " area=outer.find(WS+'area')",
    " if area is None: continue",
    " areas.append(area.attrib.get('name',''))",
    " children=[c for c in list(area) if c.tag==WS+'region']",
    " ids=[c.attrib.get('region-id') for c in children]",
    " if not children or ids[0]!=area.attrib.get('top-lock-id') or ids[-1]!=area.attrib.get('bottom-lock-id'): area_errors.append(area.attrib.get('name','')+': lock ids')",
    " if children:",
    "  spare=float(outer.attrib.get('top','0'))+float(outer.attrib.get('height','0'))-max(float(c.attrib.get('top','0'))+float(c.attrib.get('height','0')) for c in children)",
    "  if spare<16: area_errors.append(area.attrib.get('name','')+': spare='+str(spare))",
    " for a,b in zip(children,children[1:]):",
    "  if a.find(WS+'math') is not None and b.find(WS+'text') is not None: diffs.append(round(float(b.attrib['top'])-float(a.attrib['top']),2))",
    "for node in root.iter(ML+'apply'):",
    " children=list(node); op=children[0].tag.replace(ML,'') if children else 'empty'; operands=max(0,len(children)-1)",
    " if (op in ('mult','plus','minus','div','pow') and operands!=2) or (op=='sqrt' and operands!=1): bad_ops.append([op,operands])",
    "for region in root.iter(WS+'region'):",
    " tag=region.attrib.get('tag','')",
    " if not tag.startswith('formula:'): continue",
    " result=region.find('.//'+ML+'result')",
    " real=result.find('.//'+ML+'real') if result is not None else None",
    " if real is not None: formula_results[tag[8:]]=float(real.text)",
    "print(json.dumps({'root':root.tag,'areas':areas,'areaErrors':area_errors,'formulaExplanationDiffs':sorted(set(diffs)),'badBinaryOps':bad_ops,'mathRegions':sum(1 for _ in root.iter(WS+'math')),'formulaResults':formula_results},ensure_ascii=False))"
  ].join("\n");
  const execution = spawnSync("python", ["-X", "utf8", "-c", python, filename], {
    encoding: "utf8",
    env: { ...process.env, PYTHONUTF8: "1" }
  });
  if (execution.status !== 0) throw new Error(`Python XML parse failed: ${execution.stderr || execution.stdout}`);
  return JSON.parse(execution.stdout);
}

function validateMathcad(book, filename) {
  const text = fs.readFileSync(filename, "utf8");
  const regionsText = text.slice(text.indexOf("<regions>"), text.indexOf("</regions>") + "</regions>".length);
  const errors = [];
  let structure;
  try {
    structure = xmlStructureReport(filename);
  } catch (error) {
    errors.push(error.message);
    structure = { areas: [], areaErrors: [], formulaExplanationDiffs: [], badBinaryOps: [], mathRegions: 0, formulaResults: {} };
  }
  if (structure.areaErrors.length) errors.push(...structure.areaErrors);
  if (structure.areas.some((name) => name.includes("\ufffd") || name.includes("???"))) errors.push("XML validation output contains mojibake");
  if (structure.badBinaryOps.length) errors.push(`bad binary operators: ${JSON.stringify(structure.badBinaryOps)}`);
  const formulaGapPt = book.presentation?.formulaGapPt || 39;
  const sectionNarration = book.presentation?.formulaNarration === "section_level";
  if ((!sectionNarration && !structure.formulaExplanationDiffs.length) || structure.formulaExplanationDiffs.some((value) => value > formulaGapPt)) {
    errors.push(`formula-to-explanation spacing exceeds ${formulaGapPt} pt or is missing`);
  }
  const forbiddenTokens = ["K.sqrt2", "1.414", "VbusmaxV", "PoutW", "PinW", "DCRohm", "LnomH", "CsingleF"];
  const forbiddenUnits = ["mΩ", "mV", "mJ", "ms", "mA", "mW"];
  const tokenHits = forbiddenTokens.filter((token) => regionsText.includes(token));
  const unitHits = forbiddenUnits.filter((unit) => new RegExp(`(^|[^A-Za-z0-9_])${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9_])`).test(regionsText));
  if (tokenHits.length) errors.push(`forbidden tokens: ${tokenHits.join(", ")}`);
  if (unitHits.length) errors.push(`forbidden units: ${unitHits.join(", ")}`);
  const expressionHasOp = (node, op) => node?.op === op || (node?.args || []).some((child) => expressionHasOp(child, op));
  if (book.equations.some((equation) => expressionHasOp(equation.expression, "sqrt")) && !regionsText.includes("<ml:sqrt/>")) {
    errors.push("Mathcad worksheet is missing a required real sqrt node");
  }
  const requiredTokens = new Set();
  for (const entry of [...book.inputs, ...book.constants]) {
    if (entry.status !== "unresolved") requiredTokens.add(entry.unit);
    if (entry.symbol.includes("η")) requiredTokens.add("η");
  }
  for (const equation of book.equations) {
    requiredTokens.add(equation.unit);
    requiredTokens.add(equation.rounding.displayUnit);
    if (equation.symbol.includes("η")) requiredTokens.add("η");
  }
  requiredTokens.delete("1");
  requiredTokens.delete("V");
  requiredTokens.delete("A");
  requiredTokens.delete("W");
  requiredTokens.delete("J");
  requiredTokens.delete("H");
  requiredTokens.delete("s");
  for (const token of requiredTokens) if (!regionsText.includes(token)) errors.push(`required symbol missing: ${token}`);
  if (regionsText.includes("\ufffd") || regionsText.includes("???")) errors.push("Chinese encoding marker detected");
  for (const equation of book.equations.filter((entry) => entry.outputMappings.mathcad.include)) {
    if (!Object.hasOwn(structure.formulaResults, equation.id)) errors.push(`formula region/result missing: ${equation.id}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    bytes: fs.statSync(filename).size,
    xmlParse: errors.some((entry) => entry.startsWith("Python XML")) ? "FAILED" : "OK",
    areas: structure.areas,
    mathRegions: structure.mathRegions,
    areaErrors: structure.areaErrors,
    formulaExplanationDiffs: structure.formulaExplanationDiffs,
    badBinaryOps: structure.badBinaryOps,
    formulaResults: structure.formulaResults,
    prohibitedTokenHits: tokenHits,
    prohibitedUnitHits: unitHits,
    hasSqrt: regionsText.includes("<ml:sqrt/>"),
    hasLiteralSubscripts: regionsText.includes(" subscript="),
    hasUnitedResults: regionsText.includes("<unitedValue>")
  };
}

module.exports = {
  ML,
  U,
  WS,
  astXml,
  buildMathcadXml,
  buildRegions,
  validateMathcad,
  writeMathcad,
  xmlStructureReport
};
