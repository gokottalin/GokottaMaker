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
    validate
  });
})(typeof window !== "undefined" ? window : globalThis);
