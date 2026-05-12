const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let cachedMarkdown;
let crcTable;

function markdownRenderer() {
  if (cachedMarkdown) return cachedMarkdown;
  const sandbox = { window: {} };
  const rendererPath = path.join(__dirname, "..", "data", "markdown-renderer.js");
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(rendererPath, "utf8"), sandbox);
  cachedMarkdown = sandbox.window.GokottaMarkdown;
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
      .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function paragraph(text, style = "", options = {}) {
  const lines = String(text || "").split(/\r?\n/);
  const tabs = options.tabs ? '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs>' : "";
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : "";
  const spacing = options.tight ? '<w:spacing w:after="80"/>' : '<w:spacing w:after="160"/>';
  const indent = options.indent ? `<w:ind w:left="${options.indent}"/>` : "";
  const pPr = styleXml || spacing || indent || tabs ? `<w:pPr>${styleXml}${spacing}${indent}${tabs}</w:pPr>` : "";
  const runs = lines
    .map((line, index) => {
      const br = index ? "<w:br/>" : "";
      return `<w:r>${br}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${pPr}${runs}</w:p>`;
}

function table(rows) {
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
          return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}</w:tcPr>${paragraph(cell, "", { tight: true })}</w:tc>`;
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
      cells.push(textFromHtml(cellMatch[1]));
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
        const prefix = ordered ? `${index}. ` : "• ";
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
    if (block.type === "rule") body.push(paragraph("────────", "", { tight: true }));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml() {
  const baseFonts = '<w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Microsoft YaHei"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr>${baseFonts}<w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="40"/><w:color w:val="0B1220"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="32"/><w:color w:val="0D6FD3"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="28"/><w:color w:val="0B1220"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr>${baseFonts}<w:b/><w:sz w:val="24"/><w:color w:val="123657"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="140"/><w:ind w:left="420"/></w:pPr><w:rPr>${baseFonts}<w:i/><w:color w:val="526F85"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="CodeBlock"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="80" w:after="160"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Microsoft YaHei"/><w:sz w:val="19"/><w:color w:val="1A3448"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E3EF"/><w:left w:val="single" w:sz="4" w:color="D9E3EF"/><w:bottom w:val="single" w:sz="4" w:color="D9E3EF"/><w:right w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideH w:val="single" w:sz="4" w:color="D9E3EF"/><w:insideV w:val="single" w:sz="4" w:color="D9E3EF"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
}

function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
}

function wordRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
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

function markdownToDocx({ markdown, title }) {
  return zip([
    { name: "[Content_Types].xml", content: contentTypesXml() },
    { name: "_rels/.rels", content: packageRelsXml() },
    { name: "word/_rels/document.xml.rels", content: wordRelsXml() },
    { name: "word/document.xml", content: documentXml(markdown, title) },
    { name: "word/styles.xml", content: stylesXml() }
  ]);
}

module.exports = { markdownToDocx, markdownRenderer };
