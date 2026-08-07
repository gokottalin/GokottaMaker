"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { inspectMarkdown, markdownToDocx } = require("../lib/md2doc");

const ROOT = path.resolve(__dirname, "..");

const fixture = String.raw`# MD2File 一致性样例

## 正文结构

段落包含 [规范链接](https://example.com/spec)、行内公式 $V_{out}=V_{in}D$ 和括号公式 \(I_L^2=I_{avg}^2+I_{rms}^2\)。

- 无序列表包含 $f_s=100\,\mathrm{kHz}$
- 第二项保留中文

1. 有序列表第一项
2. 有序列表第二项

| 项目 | 数值 |
| --- | --- |
| 占空比 | $D=0.5$ |
| 电感 | 47 uH |

![拓扑示意图](http://127.0.0.1:1/never-fetch.png)

~~~js
const price = "$5";
const latex = "\\frac{a}{b}";
~~~

## 数学结构

\[
\frac{\sqrt{a}}{b}+\sqrt{\frac{a}{b}}
\]

$$
\boxed{\Delta I_L=\frac{V_{in}D}{L f_s}}
$$
`;

function count(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

function storedZipEntry(buffer, expectedName) {
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const contentStart = nameStart + fileNameLength + extraLength;
    const contentEnd = contentStart + compressedSize;
    if (name === expectedName) return buffer.subarray(contentStart, contentEnd).toString("utf8");
    offset = contentEnd;
  }
  throw new Error(`DOCX entry not found: ${expectedName}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function startServer(port, dataDir) {
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USERNAME: "Md2FileTester",
      ADMIN_PASSWORD: "md2file-test-password"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  return { child, output: () => output };
}

async function waitForServer(baseUrl, runtime) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (runtime.child.exitCode !== null) throw new Error(`server exited early\n${runtime.output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Retry until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`server did not start\n${runtime.output()}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function safeRemoveTemp(target) {
  const resolved = path.resolve(target);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${tempRoot}${path.sep}`) || !path.basename(resolved).startsWith("larkix-md2file-")) {
    throw new Error(`refusing to remove unexpected path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function verifyLibraryContract() {
  const toolHtml = fs.readFileSync(path.join(ROOT, "tools", "md2doc.html"), "utf8");
  const toolScript = fs.readFileSync(path.join(ROOT, "tools", "md2doc.js"), "utf8");
  const toolStyle = fs.readFileSync(path.join(ROOT, "styles", "md2doc.css"), "utf8");
  const katexScriptIndex = toolHtml.indexOf("../assets/vendor/katex/katex.min.js");
  const mathScriptIndex = toolHtml.indexOf("../data/math-renderer.js");
  const markdownScriptIndex = toolHtml.indexOf("../data/markdown-renderer.js");
  assert.ok(katexScriptIndex >= 0 && mathScriptIndex > katexScriptIndex && markdownScriptIndex > mathScriptIndex);
  assert.match(toolHtml, /assets\/vendor\/katex\/katex\.min\.css/);
  assert.match(toolScript, /previewState = \{ valid:/);
  assert.match(toolScript, /downloadButton\.disabled = previewState\.empty \|\| !previewState\.valid/);
  assert.match(toolScript, /formatDiagnostics/);
  assert.match(toolStyle, /border:\s*0 !important/);
  assert.match(toolStyle, /\.katex-display\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*hidden;/);

  const rendered = inspectMarkdown(fixture);
  assert.equal(rendered.valid, true);
  assert.deepEqual(Array.from(rendered.diagnostics), []);
  assert.equal(rendered.headings.length, 3);
  assert.match(rendered.html, /class="katex"/);
  assert.equal(count(rendered.html, /markdown-math-inline/g), 4);
  assert.equal(count(rendered.html, /markdown-math markdown-math-display/g), 2);
  assert.match(rendered.html, /class="stretchy fbox"/);
  assert.match(rendered.html, /<table>/);
  assert.match(rendered.html, /<pre data-lang="js">/);
  assert.doesNotMatch(rendered.html, /<script\b/i);

  const docx = markdownToDocx({
    markdown: fixture,
    title: "MD2File 一致性样例",
    options: { pageSize: "a4", margin: "normal", lineSpacing: "compact" }
  });
  const documentXml = storedZipEntry(docx, "word/document.xml");
  assert.match(documentXml, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(documentXml, /<w:pStyle w:val="Heading2"\/>/);
  assert.match(documentXml, /<w:tbl>/);
  assert.match(documentXml, /<w:pStyle w:val="CodeBlock"\/>/);
  assert.match(documentXml, /https:\/\/example\.com\/spec/);
  assert.match(documentXml, /［图片：拓扑示意图］/);
  const mathCount = count(documentXml, /<m:oMath>/g);
  assert.ok(mathCount >= 6, `DOCX lost math blocks: expected at least 6, received ${mathCount}`);
  assert.match(documentXml, /<m:f>/);
  assert.match(documentXml, /<m:rad>/);
  assert.match(documentXml, /<m:sSub>/);
  assert.match(documentXml, /<m:s(?:SubSup|Sup)>/);
  assert.match(documentXml, /<m:borderBox>/);
  assert.ok(
    documentXml.includes('const latex = &quot;\\\\frac{a}{b}&quot;;'),
    "code-block LaTeX remains literal text"
  );

  const codeOnly = inspectMarkdown("~~~js\nconst value = '$x$';\nconst latex = '\\\\frac{a}{b}';\n~~~");
  assert.equal(codeOnly.valid, true);
  assert.equal(count(codeOnly.html, /markdown-math/g), 0);

  const invalid = "$$\n\\frac{a}{b}";
  const invalidResult = inspectMarkdown(invalid);
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.diagnostics[0].code, "math.delimiter.unclosed");
  assert.equal(invalidResult.diagnostics[0].range.line, 1);
  assert.throws(
    () => markdownToDocx({ markdown: invalid, title: "", options: {} }),
    (error) => error.code === "MD2FILE_VALIDATION_FAILED" && error.diagnostics.length > 0
  );

  const longMarkdown = Array.from(
    { length: 60 },
    (_, index) => `## 长文节 ${index + 1}\n\n顺序检查 ${index + 1}，公式 $x_${index + 1}=\\sqrt{${index + 2}}$。`
  ).join("\n\n");
  const longRendered = inspectMarkdown(longMarkdown);
  assert.equal(longRendered.valid, true);
  assert.equal(longRendered.headings.length, 60);
  const longXml = storedZipEntry(
    markdownToDocx({ markdown: longMarkdown, title: "长文", options: {} }),
    "word/document.xml"
  );
  assert.equal(count(longXml, /<w:pStyle w:val="Heading2"\/>/g), 60);
  assert.ok(count(longXml, /<m:rad>/g) >= 60);
}

async function verifyApiContract() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-md2file-"));
  const dataDir = path.join(tempRoot, "data");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtime = startServer(port, dataDir);
  try {
    await waitForServer(baseUrl, runtime);
    const valid = await fetch(`${baseUrl}/api/md2file/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "一致性样例",
        filename: "语义检查",
        format: "docx",
        markdown: fixture,
        options: { pageSize: "a4", margin: "normal", lineSpacing: "compact" }
      })
    });
    if (valid.status !== 200) {
      throw new Error(`valid MD2File API returned ${valid.status}: ${await valid.text()}\n${runtime.output()}`);
    }
    assert.match(valid.headers.get("content-type") || "", /wordprocessingml\.document/);
    assert.match(valid.headers.get("content-disposition") || "", /%E8%AF%AD%E4%B9%89%E6%A3%80%E6%9F%A5\.docx/);
    assert.ok((await valid.arrayBuffer()).byteLength > 1000);

    const invalid = await fetch(`${baseUrl}/api/md2file/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "docx", markdown: "$$\n\\frac{a}{b}" })
    });
    assert.equal(invalid.status, 422);
    const payload = await invalid.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.version, "V0.4");
    assert.equal(payload.diagnostics[0].code, "math.delimiter.unclosed");
    assert.equal(payload.diagnostics[0].level, "ERROR");
    assert.equal(payload.diagnostics[0].range.line, 1);
  } finally {
    await stopServer(runtime.child);
    safeRemoveTemp(tempRoot);
  }
}

async function main() {
  verifyLibraryContract();
  await verifyApiContract();
  console.log("MD2File parity fixtures passed: shared preview, DOCX semantics, invalid 422, code isolation, safe images and long documents.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
