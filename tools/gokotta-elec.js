(function () {
  const api = {
    samples: "/api/elec/samples",
    build: "/api/elec/build"
  };

  const fallbackSamples = [
    {
      id: "sample-01-voltage-divider",
      title: "Sample 01 - 电阻分压",
      source: `电路 WEB_SAMPLE_01_VOLTAGE_DIVIDER 版本 0.1.0。

网络 GND 是 ground，说明=全局参考地。
网络 VIN 是 input，说明=输入电压。
网络 VOUT 是 output，说明=分压输出节点。

器件 V1 是 VOLTAGE_SOURCE_DC，参数{voltage=5V}。
器件 R1 是 RESISTOR，参数{resistance=10kΩ}。
器件 R2 是 RESISTOR，参数{resistance=10kΩ}。

连接 VIN: V1.POS, R1.A。
连接 VOUT: R1.B, R2.A。
连接 GND: V1.NEG, R2.B。

约束 R1 必须 terminal_connected(A,B)。
约束 R2 必须 terminal_connected(A,B)。`
    }
  ];

  const el = {
    sampleSelect: document.querySelector("#sampleSelect"),
    cnlInput: document.querySelector("#cnlInput"),
    renderButton: document.querySelector("#renderButton"),
    clearButton: document.querySelector("#clearButton"),
    copyButton: document.querySelector("#copyButton"),
    fitButton: document.querySelector("#fitButton"),
    downloadSvgButton: document.querySelector("#downloadSvgButton"),
    copyIrButton: document.querySelector("#copyIrButton"),
    svgPreview: document.querySelector("#svgPreview"),
    diagnosticsLog: document.querySelector("#diagnosticsLog"),
    irViewer: document.querySelector("#irViewer")
  };

  let samples = fallbackSamples;
  let currentSvg = "";
  let currentSvgUrl = "";
  let currentIr = null;

  function releaseCurrentSvgUrl() {
    if (currentSvgUrl) {
      URL.revokeObjectURL(currentSvgUrl);
      currentSvgUrl = "";
    }
  }

  function setLog(value, tone) {
    el.diagnosticsLog.textContent = value || "";
    el.diagnosticsLog.classList.toggle("ge-error", tone === "error");
    el.diagnosticsLog.classList.toggle("ge-warning", tone === "warning");
  }

  function setPreviewEmpty(message) {
    releaseCurrentSvgUrl();
    currentSvg = "";
    el.downloadSvgButton.disabled = true;
    el.svgPreview.className = "ge-preview-empty";
    el.svgPreview.textContent = message;
  }

  function setIr(ir) {
    currentIr = ir || null;
    el.copyIrButton.disabled = !currentIr;
    el.irViewer.textContent = currentIr ? JSON.stringify(currentIr, null, 2) : "{}";
  }

  function normalizeBuildResponse(data) {
    const firstCircuit = Array.isArray(data.circuits) ? data.circuits[0] : null;
    const artifacts = data.artifacts || {};
    const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : firstCircuit?.warnings || [];
    return {
      ok: Boolean(data.ok),
      svg: artifacts.svg || firstCircuit?.svg || "",
      ir: artifacts.ir || firstCircuit?.ir || null,
      ercText: artifacts.ercText || firstCircuit?.erc || "",
      diagnostics,
      raw: data
    };
  }

  function diagnosticsTone(items) {
    if (!Array.isArray(items)) return "";
    if (items.some((item) => item.level === "ERROR")) return "error";
    if (items.some((item) => item.level === "WARNING")) return "warning";
    return "";
  }

  function diagnosticsToText(result) {
    const parts = [];
    if (result.ercText) parts.push(result.ercText.trim());
    if (result.diagnostics && result.diagnostics.length) {
      parts.push(result.diagnostics.map((item) => {
        const line = item.line ? ` line ${item.line}` : "";
        const target = item.target ? ` [${item.target}]` : "";
        return `${item.level || "INFO"}${line}${target}: ${item.code || ""} ${item.message || ""}`.trim();
      }).join("\n"));
    }
    if (!parts.length) parts.push("OK");
    return parts.join("\n\n");
  }

  async function loadSamples() {
    try {
      const response = await fetch(api.samples);
      const data = await response.json();
      if (!response.ok || !data.ok) throw data;
      samples = Array.isArray(data.samples) && data.samples.length ? data.samples : fallbackSamples;
      setLog(`已加载 ${samples.length} 个官方 Sample。`);
    } catch (error) {
      samples = fallbackSamples;
      setLog(formatError(error, "Sample API 未接入，已加载内置最小示例。"), "warning");
    }

    el.sampleSelect.innerHTML = `<option value="">加载 Sample</option>` + samples.map((sample) => (
      `<option value="${sample.id}">${sample.title || sample.id}</option>`
    )).join("");
  }

  async function buildCircuit() {
    const source = el.cnlInput.value.trim();
    if (!source) {
      setPreviewEmpty("请先输入 CNL 文本");
      setLog("没有输入内容。", "error");
      setIr(null);
      return;
    }

    el.renderButton.disabled = true;
    setLog("正在调用 /api/elec/build ...");
    setPreviewEmpty("正在生成 SVG 原理图...");
    setIr(null);

    try {
      const response = await fetch(api.build, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          inputType: "cnl",
          options: {
            runErc: true,
            renderSvg: true,
            allowWarnings: true
          }
        })
      });
      const data = await response.json();
      const result = normalizeBuildResponse(data);
      if (!response.ok || !result.ok) throw data;

      currentSvg = result.svg;
      releaseCurrentSvgUrl();
      currentSvgUrl = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" }));
      el.svgPreview.className = "";
      el.svgPreview.innerHTML = "";
      const image = document.createElement("img");
      image.className = "ge-svg-image";
      image.src = currentSvgUrl;
      image.alt = "GokottaElec 生成的 SVG 原理图预览";
      el.svgPreview.appendChild(image);
      el.downloadSvgButton.disabled = !currentSvg;
      setIr(result.ir);
      setLog(diagnosticsToText(result), diagnosticsTone(result.diagnostics));
    } catch (error) {
      setPreviewEmpty("接口未接入或生成失败");
      setIr(null);
      setLog(formatError(error, "接口未接入或请求失败。请确认 GokottaMaker 后端已实现 POST /api/elec/build。"), "error");
    } finally {
      el.renderButton.disabled = false;
    }
  }

  function formatError(error, fallback) {
    if (error && Array.isArray(error.diagnostics)) {
      return error.diagnostics.map((item) => {
        const code = item.code ? `${item.code}: ` : "";
        return `${item.level || "ERROR"}: ${code}${item.message || "未知错误"}`;
      }).join("\n");
    }
    if (error && error.message) return `${fallback}\n${error.message}`;
    return fallback;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyText(text, successMessage) {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setLog(successMessage);
  }

  el.sampleSelect.addEventListener("change", () => {
    const sample = samples.find((item) => item.id === el.sampleSelect.value);
    if (sample) {
      el.cnlInput.value = sample.source || "";
      setPreviewEmpty("等待生成预览");
      setIr(null);
      setLog(`已载入 ${sample.title || sample.id}。`);
    }
  });

  el.renderButton.addEventListener("click", buildCircuit);
  el.clearButton.addEventListener("click", () => {
    el.cnlInput.value = "";
    setPreviewEmpty("等待生成预览");
    setLog("已清空。");
    setIr(null);
  });
  el.copyButton.addEventListener("click", () => copyText(el.cnlInput.value, "已复制输入。"));
  el.copyIrButton.addEventListener("click", () => copyText(el.irViewer.textContent, "已复制 IR。"));
  el.fitButton.addEventListener("click", () => el.svgPreview.scrollTo({ left: 0, top: 0, behavior: "smooth" }));
  el.downloadSvgButton.addEventListener("click", () => {
    if (currentSvg) downloadText("gokottaelec.svg", currentSvg, "image/svg+xml;charset=utf-8");
  });
  window.addEventListener("pagehide", releaseCurrentSvgUrl);

  loadSamples();
  el.cnlInput.value = fallbackSamples[0].source;
})();
