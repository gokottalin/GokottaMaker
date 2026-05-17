(function () {
  const sampleMarkdown = `# GokottaMaker 文档示例

## 项目摘要

MD2File 使用站内 Markdown 渲染器进行预览，当前导出 Word DOCX，后续可扩展 PDF 等格式。

## 支持内容

- 标题层级
- 有序列表和无序列表
- 表格
- 引用块
- 代码块

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| Markdown | 已接入 | HTML 预览 |
| Word | 已接入 | DOCX 导出 |

> 文档导出会保留标题层级、列表、引用和代码结构。

~~~js
const tool = "MD2File";
console.log("Markdown export");
~~~

## Calculus Formula

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$
`;

  const api = { convert: "/api/md2file/convert" };
  const el = {
    title: document.querySelector("#docTitle"),
    fileName: document.querySelector("#fileName"),
    pageSize: document.querySelector("#pageSize"),
    pageMargin: document.querySelector("#pageMargin"),
    lineSpacing: document.querySelector("#lineSpacing"),
    previewZoom: document.querySelector("#previewZoom"),
    stats: document.querySelector("#docStats"),
    input: document.querySelector("#markdownInput"),
    preview: document.querySelector("#previewPane"),
    previewStage: document.querySelector("#previewStage"),
    log: document.querySelector("#diagnosticsLog"),
    sampleButton: document.querySelector("#sampleButton"),
    importButton: document.querySelector("#importButton"),
    fileInput: document.querySelector("#fileInput"),
    downloadButton: document.querySelector("#downloadButton"),
    copyButton: document.querySelector("#copyButton"),
    clearButton: document.querySelector("#clearButton"),
    syncScrollToggle: document.querySelector("#syncScrollToggle"),
    alignScrollButton: document.querySelector("#alignScrollButton"),
    refreshButton: document.querySelector("#refreshButton")
  };

  let syncScrollEnabled = true;
  let isSyncingScroll = false;
  let lastScrollSource = "input";

  const pageProfiles = {
    a4: { width: 210, height: 297, label: "A4" },
    letter: { width: 216, height: 279, label: "Letter" },
    a5: { width: 148, height: 210, label: "A5" }
  };

  const marginProfiles = {
    narrow: { size: 12, label: "\u7a84\u8fb9\u8ddd" },
    normal: { size: 22, label: "\u6807\u51c6\u8fb9\u8ddd" },
    wide: { size: 30, label: "\u5bbd\u8fb9\u8ddd" }
  };

  const lineProfiles = {
    compact: { value: 1.35, label: "\u7d27\u51d1\u884c\u8ddd" },
    normal: { value: 1.5, label: "\u6807\u51c6\u884c\u8ddd" },
    relaxed: { value: 1.65, label: "\u8212\u5c55\u884c\u8ddd" },
    loose: { value: 1.9, label: "\u5bbd\u677e\u884c\u8ddd" }
  };

  function setLog(message, tone) {
    el.log.textContent = message;
    el.log.classList.toggle("is-error", tone === "error");
  }

  function getScrollRatio(node) {
    const max = node ? node.scrollHeight - node.clientHeight : 0;
    return max > 0 ? Math.min(1, Math.max(0, node.scrollTop / max)) : 0;
  }

  function setScrollRatio(node, ratio) {
    if (!node) return;
    const max = node.scrollHeight - node.clientHeight;
    if (max > 0) node.scrollTop = max * Math.min(1, Math.max(0, ratio));
  }

  function syncScroll(source, target, force = false) {
    if (!source || !target) return;
    if (!isSyncingScroll) lastScrollSource = source === el.previewStage ? "preview" : "input";
    if ((!syncScrollEnabled && !force) || isSyncingScroll) return;
    const ratio = getScrollRatio(source);
    isSyncingScroll = true;
    window.requestAnimationFrame(() => {
      setScrollRatio(target, ratio);
      isSyncingScroll = false;
    });
  }

  function refreshSyncControl() {
    if (!el.syncScrollToggle) return;
    el.syncScrollToggle.classList.toggle("is-active", syncScrollEnabled);
    el.syncScrollToggle.setAttribute("aria-pressed", String(syncScrollEnabled));
    el.syncScrollToggle.textContent = syncScrollEnabled ? "同步滚动 开" : "同步滚动 关";
  }

  function alignCurrentScroll() {
    if (lastScrollSource === "preview") {
      syncScroll(el.previewStage, el.input, true);
    } else {
      syncScroll(el.input, el.previewStage, true);
    }
  }

  function renderPreview() {
    const markdown = el.input.value;
    const result = window.GokottaMarkdown.render(markdown);
    el.preview.innerHTML = result.html || '<div class="empty-state">\u7b49\u5f85\u9884\u89c8\u3002</div>';
    el.stats.textContent = `${markdown.length} \u5b57\u7b26`;
  }

  function currentOptions() {
    return {
      pageSize: el.pageSize?.value || "a4",
      margin: el.pageMargin?.value || "normal",
      lineSpacing: el.lineSpacing?.value || "relaxed",
      zoom: Number(el.previewZoom?.value || 1)
    };
  }

  function applyPreviewSettings() {
    const markdown = el.input.value;
    const options = currentOptions();
    const page = pageProfiles[options.pageSize] || pageProfiles.a4;
    const margin = marginProfiles[options.margin] || marginProfiles.normal;
    const line = lineProfiles[options.lineSpacing] || lineProfiles.relaxed;
    el.preview.style.setProperty("--paper-width", page.width);
    el.preview.style.setProperty("--paper-height", page.height);
    el.preview.style.setProperty("--page-margin", margin.size);
    el.preview.style.setProperty("--preview-scale", `${3.05 * options.zoom}px`);
    const pageHeightPx = page.height * 3.05 * options.zoom;
    el.preview.style.setProperty("--page-height-px", `${pageHeightPx}px`);
    el.preview.style.minHeight = `${pageHeightPx}px`;
    el.preview.style.setProperty("--doc-line-height", line.value);
    el.preview.dataset.pageSize = options.pageSize;
    const contentHeight = Math.max(el.preview.scrollHeight, pageHeightPx);
    const pageCount = Math.max(1, Math.ceil(contentHeight / pageHeightPx));
    el.preview.style.minHeight = `${pageHeightPx * pageCount}px`;
    el.preview.dataset.pageCount = String(pageCount);
    el.stats.textContent = `${markdown.length} \u5b57\u7b26 / ${page.label} / \u7ea6 ${pageCount} \u9875 / ${margin.label} / ${line.label}`;
  }

  function updatePreview() {
    const inputRatio = getScrollRatio(el.input);
    const previewRatio = getScrollRatio(el.previewStage);
    renderPreview();
    applyPreviewSettings();
    window.requestAnimationFrame(() => {
      setScrollRatio(el.previewStage, syncScrollEnabled ? inputRatio : previewRatio);
    });
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
      setLog("\u004d\u0061\u0072\u006b\u0064\u006f\u0077\u006e \u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a\u3002", "error");
      return;
    }

    el.downloadButton.disabled = true;
    setLog("\u6b63\u5728\u751f\u6210 DOCX ...");
    try {
      const response = await fetch(api.convert, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: el.title.value.trim(),
          format: "docx",
          filename: safeFileName(el.fileName.value),
          markdown,
          options: currentOptions()
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = Array.isArray(data.diagnostics) ? data.diagnostics.map((item) => item.message || item.code).join("\n") : "DOCX 生成失败。";
        throw new Error(message);
      }
      const blob = await response.blob();
      downloadBlob(safeFileName(el.fileName.value), blob);
      setLog("DOCX \u5df2\u751f\u6210\u3002");
    } catch (error) {
      setLog(error.message || "DOCX \u751f\u6210\u5931\u8d25\u3002", "error");
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
    updatePreview();
    setLog(`\u5df2\u5bfc\u5165\uff1a${file.name}`);
  }

  const debouncedPreview = debounce(updatePreview, 120);
  el.input.addEventListener("input", debouncedPreview);
  el.input.addEventListener("scroll", () => syncScroll(el.input, el.previewStage), { passive: true });
  el.input.addEventListener("focus", () => {
    lastScrollSource = "input";
  });
  el.previewStage.addEventListener("scroll", () => syncScroll(el.previewStage, el.input), { passive: true });
  el.previewStage.addEventListener("pointerenter", () => {
    lastScrollSource = "preview";
  });
  [el.pageSize, el.pageMargin, el.lineSpacing, el.previewZoom].forEach((control) => {
    control?.addEventListener("change", applyPreviewSettings);
  });
  el.syncScrollToggle?.addEventListener("click", () => {
    syncScrollEnabled = !syncScrollEnabled;
    refreshSyncControl();
    if (syncScrollEnabled) alignCurrentScroll();
  });
  el.alignScrollButton?.addEventListener("click", alignCurrentScroll);
  el.sampleButton.addEventListener("click", () => {
    el.input.value = sampleMarkdown;
    updatePreview();
    setLog("\u5df2\u52a0\u8f7d\u793a\u4f8b\u3002");
  });
  el.importButton.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", () => importMarkdown(el.fileInput.files[0]));
  el.downloadButton.addEventListener("click", convertToWord);
  el.copyButton.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(el.input.value);
    setLog("\u5df2\u590d\u5236 Markdown\u3002");
  });
  el.clearButton.addEventListener("click", () => {
    el.input.value = "";
    updatePreview();
    setLog("\u5df2\u6e05\u7a7a\u3002");
  });
  el.refreshButton.addEventListener("click", updatePreview);

  el.input.value = sampleMarkdown;
  refreshSyncControl();
  updatePreview();
})();
