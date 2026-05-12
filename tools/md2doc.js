(function () {
  const sampleMarkdown = `# GokottaMaker 文档示例

## 项目摘要

MD2File 使用站点现有 Markdown 解析器生成预览；当前导出 Word DOCX，后续可扩展 PDF 等格式。

## 支持内容

- 标题与段落
- 有序列表和无序列表
- 表格
- 代码块
- 引用

| 模块 | 状态 | 输出 |
| --- | --- | --- |
| Markdown | 已接入 | HTML 预览 |
| Word | 已接入 | DOCX 下载 |

> 文档导出会保留基础层级、表格、列表、代码块和引用结构。

\`\`\`js
const tool = "MD2File";
console.log("Markdown export");
\`\`\`
`;

  const api = { convert: "/api/md2file/convert" };
  const el = {
    title: document.querySelector("#docTitle"),
    fileName: document.querySelector("#fileName"),
    stats: document.querySelector("#docStats"),
    input: document.querySelector("#markdownInput"),
    preview: document.querySelector("#previewPane"),
    log: document.querySelector("#diagnosticsLog"),
    sampleButton: document.querySelector("#sampleButton"),
    importButton: document.querySelector("#importButton"),
    fileInput: document.querySelector("#fileInput"),
    downloadButton: document.querySelector("#downloadButton"),
    copyButton: document.querySelector("#copyButton"),
    clearButton: document.querySelector("#clearButton"),
    refreshButton: document.querySelector("#refreshButton")
  };

  function setLog(message, tone) {
    el.log.textContent = message;
    el.log.classList.toggle("is-error", tone === "error");
  }

  function renderPreview() {
    const markdown = el.input.value;
    const result = window.GokottaMarkdown.render(markdown);
    el.preview.innerHTML = result.html || '<div class="empty-state">暂无预览。</div>';
    el.stats.textContent = `${markdown.length} 字符`;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function safeFileName(value) {
    return String(value || "md2file").trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-").replace(/\s+/g, "-") || "md2file";
  }

  async function convertToWord() {
    const markdown = el.input.value.trim();
    if (!markdown) {
      setLog("Markdown 内容不能为空。", "error");
      return;
    }

    el.downloadButton.disabled = true;
    setLog("正在生成 DOCX ...");
    try {
      const response = await fetch(api.convert, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: el.title.value.trim(),
          format: "docx",
          filename: safeFileName(el.fileName.value),
          markdown
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = Array.isArray(data.diagnostics) ? data.diagnostics.map((item) => item.message || item.code).join("\n") : "DOCX 生成失败。";
        throw new Error(message);
      }
      const blob = await response.blob();
      downloadBlob(safeFileName(el.fileName.value), blob);
      setLog("DOCX 已生成。");
    } catch (error) {
      setLog(error.message || "DOCX 生成失败。", "error");
    } finally {
      el.downloadButton.disabled = false;
    }
  }

  function debounce(fn, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  async function importMarkdown(file) {
    if (!file) return;
    const text = await file.text();
    el.input.value = text;
    el.fileName.value = safeFileName(file.name.replace(/\.(md|markdown|txt)$/i, ""));
    renderPreview();
    setLog(`已导入：${file.name}`);
  }

  const debouncedPreview = debounce(renderPreview, 120);
  el.input.addEventListener("input", debouncedPreview);
  el.sampleButton.addEventListener("click", () => {
    el.input.value = sampleMarkdown;
    renderPreview();
    setLog("已载入示例。");
  });
  el.importButton.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", () => importMarkdown(el.fileInput.files[0]));
  el.downloadButton.addEventListener("click", convertToWord);
  el.copyButton.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(el.input.value);
    setLog("已复制 Markdown。");
  });
  el.clearButton.addEventListener("click", () => {
    el.input.value = "";
    renderPreview();
    setLog("已清空。");
  });
  el.refreshButton.addEventListener("click", renderPreview);

  el.input.value = sampleMarkdown;
  renderPreview();
})();
