(function (global) {
  "use strict";

  const ENGINE = "KaTeX";
  const VERSION = "0.16.22";
  const RENDER_OPTIONS = Object.freeze({
    throwOnError: true,
    strict: "error",
    trust: false,
    output: "htmlAndMathml",
    maxExpand: 1000,
    maxSize: 20
  });
  const ADAPTIVE_BLOCK_SELECTOR = [
    ".markdown-math-display",
    ".formula-card-latex",
    ".formula-editor-preview",
    ".formula-markdown-preview",
    ".formula-authoring-latex",
    ".formula-selection-preview"
  ].join(",");
  const MEASURE_EPSILON = 0.5;
  let adaptiveObserver = null;
  let adaptiveMutationObserver = null;
  let adaptiveFrame = 0;
  const adaptiveRoots = new Set();

  function measuredMath(container) {
    if (!container || container.matches?.(".markdown-math-inline")) return null;
    return container.querySelector?.(".katex-display > .katex, .katex-display, .katex") || null;
  }

  function measureBlock(container) {
    const math = measuredMath(container);
    if (!math || typeof math.getBoundingClientRect !== "function") return false;
    const rect = math.getBoundingClientRect();
    if (!(rect.height > 0)) return false;
    const padding = Math.max(6, Math.min(14, rect.height * 0.1));
    const previous = Number(container.dataset.mathContentHeight || 0);
    container.dataset.mathAdaptive = "block";
    container.style.setProperty("--math-content-block-size", `${rect.height.toFixed(2)}px`);
    container.style.setProperty("--math-safe-block-padding", `${padding.toFixed(2)}px`);
    container.dataset.mathContentHeight = rect.height.toFixed(2);
    adaptiveObserver?.observe(math);
    return Math.abs(previous - rect.height) > MEASURE_EPSILON;
  }

  function collectBlocks(root) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    const blocks = [];
    if (root.matches?.(ADAPTIVE_BLOCK_SELECTOR)) blocks.push(root);
    root.querySelectorAll(ADAPTIVE_BLOCK_SELECTOR).forEach((block) => blocks.push(block));
    return blocks;
  }

  function flushAdaptiveLayout() {
    adaptiveFrame = 0;
    const roots = [...adaptiveRoots];
    adaptiveRoots.clear();
    roots.forEach((root) => collectBlocks(root).forEach(measureBlock));
  }

  function scheduleAdaptiveLayout(root) {
    if (!global.document) return;
    adaptiveRoots.add(root && root.nodeType ? root : global.document);
    if (adaptiveFrame) return;
    const requestFrame = global.requestAnimationFrame || ((callback) => global.setTimeout(callback, 0));
    adaptiveFrame = requestFrame(flushAdaptiveLayout);
  }

  function startAdaptiveLayout() {
    if (!global.document || adaptiveMutationObserver) return;
    adaptiveObserver =
      typeof global.ResizeObserver === "function"
        ? new global.ResizeObserver((entries) => {
            entries.forEach((entry) => {
              const block = entry.target.closest?.(ADAPTIVE_BLOCK_SELECTOR);
              if (block) scheduleAdaptiveLayout(block);
            });
          })
        : null;
    adaptiveMutationObserver =
      typeof global.MutationObserver === "function"
        ? new global.MutationObserver((records) => {
            records.forEach((record) => scheduleAdaptiveLayout(record.target));
          })
        : { disconnect() {} };
    adaptiveMutationObserver.observe?.(global.document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });
    global.addEventListener?.("resize", () => scheduleAdaptiveLayout(global.document));
    global.document.fonts?.ready?.then(() => scheduleAdaptiveLayout(global.document));
    scheduleAdaptiveLayout(global.document);
  }

  function positionAt(source, offset) {
    const safeOffset = Math.max(0, Math.min(source.length, Number.isFinite(offset) ? offset : 0));
    const before = source.slice(0, safeOffset).split("\n");
    return {
      offset: safeOffset,
      line: before.length,
      column: before[before.length - 1].length + 1
    };
  }

  function diagnostic(code, message, source, offset = 0, length = 0) {
    const start = positionAt(source, offset);
    const end = positionAt(source, start.offset + Math.max(0, length));
    return {
      code,
      severity: "error",
      blocking: true,
      message,
      range: {
        offset: start.offset,
        length: Math.max(0, length),
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column
      }
    };
  }

  function unwrapDelimiter(source) {
    const pairs = [
      { open: "\\[", close: "\\]", displayMode: true },
      { open: "$$", close: "$$", displayMode: true },
      { open: "\\(", close: "\\)", displayMode: false }
    ];
    for (const pair of pairs) {
      const starts = source.startsWith(pair.open);
      const ends = source.endsWith(pair.close);
      if (!starts && !ends) continue;
      if (!starts || !ends || source.length < pair.open.length + pair.close.length) {
        const offset = starts ? Math.max(0, source.length - pair.close.length) : 0;
        return {
          source,
          displayMode: pair.displayMode,
          diagnostics: [
            diagnostic(
              "math.delimiter.unmatched",
              `LaTeX 定界符不完整：需要成对使用 ${pair.open} 和 ${pair.close}。`,
              source,
              offset,
              starts ? 0 : pair.close.length
            )
          ]
        };
      }
      return {
        source: source.slice(pair.open.length, -pair.close.length).trim(),
        displayMode: pair.displayMode,
        diagnostics: []
      };
    }
    return { source, displayMode: null, diagnostics: [] };
  }

  function evaluate(value, options = {}) {
    const rawSource = String(value == null ? "" : value).trim();
    const unwrapped = unwrapDelimiter(rawSource);
    const displayMode =
      typeof options.displayMode === "boolean"
        ? options.displayMode
        : Boolean(unwrapped.displayMode);
    const source = unwrapped.source;

    if (unwrapped.diagnostics.length) {
      return {
        valid: false,
        blocking: true,
        source,
        displayMode,
        diagnostics: unwrapped.diagnostics,
        html: ""
      };
    }

    if (!source) {
      return {
        valid: false,
        blocking: true,
        source,
        displayMode,
        diagnostics: [diagnostic("math.source.empty", "LaTeX 公式不能为空。", source)],
        html: ""
      };
    }

    const engine = global.katex;
    if (
      !engine ||
      typeof engine.renderToString !== "function" ||
      String(engine.version || "") !== VERSION
    ) {
      return {
        valid: false,
        blocking: true,
        source,
        displayMode,
        diagnostics: [
          diagnostic(
            "math.engine.unavailable",
            `本地 ${ENGINE} ${VERSION} 未正确加载，已阻止数学内容输出。`,
            source
          )
        ],
        html: ""
      };
    }

    try {
      const html = engine.renderToString(source, {
        ...RENDER_OPTIONS,
        displayMode
      });
      return {
        valid: true,
        blocking: false,
        source,
        displayMode,
        diagnostics: [],
        html
      };
    } catch (error) {
      const offset = Number.isFinite(error && error.position) ? error.position : 0;
      const length = Number.isFinite(error && error.length) ? error.length : 0;
      const detail = String((error && (error.rawMessage || error.message)) || "无法解析公式。")
        .replace(/^KaTeX parse error:\s*/i, "")
        .trim();
      return {
        valid: false,
        blocking: true,
        source,
        displayMode,
        diagnostics: [
          diagnostic("math.syntax.invalid", `LaTeX 语法错误：${detail}`, source, offset, length)
        ],
        html: ""
      };
    }
  }

  function validate(value, options = {}) {
    const result = evaluate(value, options);
    return {
      valid: result.valid,
      blocking: result.blocking,
      source: result.source,
      displayMode: result.displayMode,
      diagnostics: result.diagnostics
    };
  }

  function render(value, options = {}) {
    return evaluate(value, options);
  }

  global.LarkixMath = Object.freeze({
    ENGINE,
    VERSION,
    render,
    validate,
    adaptiveLayout: Object.freeze({
      measure: measureBlock,
      refresh: scheduleAdaptiveLayout,
      start: startAdaptiveLayout
    })
  });

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", startAdaptiveLayout, { once: true });
    } else {
      startAdaptiveLayout();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
