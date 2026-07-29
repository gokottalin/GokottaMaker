(function () {
  const optimized = {
    "./assets/hero/electronics-lab-hero.png": {
      webp: [
        "./assets/hero/electronics-lab-hero-960.webp 960w",
        "./assets/hero/electronics-lab-hero-1600.webp 1600w"
      ],
      sizes: "100vw",
      width: 1600,
      height: 900
    },
    "./assets/covers/analog-cover.png": {
      webp: ["./assets/covers/analog-cover-480.webp 480w", "./assets/covers/analog-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px",
      width: 768,
      height: 512
    },
    "./assets/covers/esp32-cover.png": {
      webp: ["./assets/covers/esp32-cover-480.webp 480w", "./assets/covers/esp32-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px",
      width: 768,
      height: 512
    },
    "./assets/covers/project-cover.png": {
      webp: ["./assets/covers/project-cover-480.webp 480w", "./assets/covers/project-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px",
      width: 768,
      height: 512
    },
    "./assets/covers/stm32-cover.png": {
      webp: ["./assets/covers/stm32-cover-480.webp 480w", "./assets/covers/stm32-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px",
      width: 768,
      height: 512
    }
  };

  function normalize(src) {
    const value = String(src || "");
    if (!value || value.startsWith("http") || value.startsWith("data:")) return value;
    return value.startsWith("./") || value.startsWith("/") ? value : `./${value}`;
  }

  function escapeAttr(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeHtml(value) {
    return escapeAttr(value);
  }

  function sources(src) {
    return optimized[normalize(src)];
  }

  function normalizeCrop(value) {
    if (!value || typeof value !== "object") return null;
    const crop = {
      x: Number(value.x),
      y: Number(value.y),
      width: Number(value.width),
      height: Number(value.height),
      sourceWidth: Number(value.sourceWidth),
      sourceHeight: Number(value.sourceHeight)
    };
    if (
      Object.values(crop).some((number) => !Number.isFinite(number)) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.width <= 0 ||
      crop.height <= 0 ||
      crop.x + crop.width > 1.000000001 ||
      crop.y + crop.height > 1.000000001 ||
      !Number.isInteger(crop.sourceWidth) ||
      !Number.isInteger(crop.sourceHeight) ||
      crop.sourceWidth < 1 ||
      crop.sourceHeight < 1
    ) {
      return null;
    }
    const pixelWidth = crop.width * crop.sourceWidth;
    const expectedWidth = crop.height * crop.sourceHeight * 16 / 9;
    return Math.abs(pixelWidth - expectedWidth) <= Math.max(1, expectedWidth * 0.001) ? crop : null;
  }

  function cropAttributes(crop) {
    return [
      'data-cover-crop="true"',
      `data-cover-crop-x="${escapeAttr(crop.x)}"`,
      `data-cover-crop-y="${escapeAttr(crop.y)}"`,
      `data-cover-crop-width="${escapeAttr(crop.width)}"`,
      `data-cover-crop-height="${escapeAttr(crop.height)}"`,
      `data-cover-source-width="${escapeAttr(crop.sourceWidth)}"`,
      `data-cover-source-height="${escapeAttr(crop.sourceHeight)}"`
    ].join(" ");
  }

  function image(src, alt, options = {}) {
    const normalized = normalize(src);
    const match = sources(normalized);
    const classAttr = options.className ? ` class="${escapeAttr(options.className)}"` : "";
    const loading = options.loading ? ` loading="${escapeAttr(options.loading)}"` : "";
    const decoding = options.decoding === false ? "" : ' decoding="async"';
    const sizes = options.sizes || match?.sizes;
    const sizesAttr = sizes ? ` sizes="${escapeAttr(sizes)}"` : "";
    const width = options.width || match?.width;
    const height = options.height || match?.height;
    const widthAttr = width ? ` width="${escapeAttr(width)}"` : "";
    const heightAttr = height ? ` height="${escapeAttr(height)}"` : "";
    const fetchPriority = options.fetchPriority ? ` fetchpriority="${escapeAttr(options.fetchPriority)}"` : "";
    const img = `<img src="${escapeAttr(normalized)}"${classAttr} alt="${escapeAttr(alt)}"${loading}${decoding}${sizesAttr}${widthAttr}${heightAttr}${fetchPriority} />`;
    const crop = normalizeCrop(options.crop);
    if (!crop) {
      if (!match) return img;
      return `<picture><source type="image/webp" srcset="${escapeAttr(match.webp.join(", "))}"${sizesAttr} />${img}</picture>`;
    }
    const source = match
      ? `<source type="image/webp" srcset="${escapeAttr(match.webp.join(", "))}"${sizesAttr} />`
      : "";
    return `<picture class="larkix-cover-crop" ${cropAttributes(crop)}>${source}${img}</picture>`;
  }

  function cropFromElement(element) {
    return normalizeCrop({
      x: element.dataset.coverCropX,
      y: element.dataset.coverCropY,
      width: element.dataset.coverCropWidth,
      height: element.dataset.coverCropHeight,
      sourceWidth: element.dataset.coverSourceWidth,
      sourceHeight: element.dataset.coverSourceHeight
    });
  }

  function cropLayout(crop, viewportWidth, viewportHeight) {
    const scale = Math.max(
      viewportWidth / (crop.width * crop.sourceWidth),
      viewportHeight / (crop.height * crop.sourceHeight)
    );
    return {
      width: crop.sourceWidth * scale,
      height: crop.sourceHeight * scale,
      left:
        (viewportWidth - crop.width * crop.sourceWidth * scale) / 2
        - crop.x * crop.sourceWidth * scale,
      top:
        (viewportHeight - crop.height * crop.sourceHeight * scale) / 2
        - crop.y * crop.sourceHeight * scale
    };
  }

  function positionCrop(element) {
    const crop = cropFromElement(element);
    if (!crop) return;
    const direct = element.tagName === "IMG";
    const imageElement = direct ? element : element.querySelector("img");
    const viewport = direct ? element.parentElement : element;
    if (!imageElement || !viewport) return;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (!viewportWidth || !viewportHeight) return;
    const layout = cropLayout(crop, viewportWidth, viewportHeight);
    Object.assign(imageElement.style, {
      position: "absolute",
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      maxWidth: "none",
      left: `${layout.left}px`,
      top: `${layout.top}px`,
      right: "auto",
      bottom: "auto",
      objectFit: "fill"
    });
  }

  const observedCropHosts = new WeakSet();
  const cropResizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const target = entry.target;
            const element = target.matches?.("[data-cover-crop]")
              ? target
              : target.querySelector?.(":scope > img[data-cover-crop]");
            if (element) positionCrop(element);
          });
        });

  function hydrateCrop(element) {
    if (!element || !element.matches?.("[data-cover-crop]")) return;
    positionCrop(element);
    if (!cropResizeObserver || observedCropHosts.has(element)) return;
    cropResizeObserver.observe(element.tagName === "IMG" ? element.parentElement : element);
    observedCropHosts.add(element);
  }

  function hydrateCrops(root = document) {
    if (root.matches?.("[data-cover-crop]")) hydrateCrop(root);
    root.querySelectorAll?.("[data-cover-crop]").forEach(hydrateCrop);
  }

  const observedFocusedMedia = new WeakSet();
  const focusedMediaResizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const crop = entry.target.querySelector?.(":scope > [data-cover-crop]");
            if (crop) positionCrop(crop);
          });
        });

  function hydrateFocusedMediaHost(host) {
    if (!host || !host.matches?.("[data-focused-card-media]")) return;
    const crop = host.querySelector?.(":scope > [data-cover-crop]");
    if (crop) hydrateCrop(crop);
    const imageElement = host.querySelector?.("img");
    if (!imageElement || observedFocusedMedia.has(host)) return;

    const setState = (state) => {
      host.dataset.focusedMediaState = state;
    };
    imageElement.addEventListener("load", () => setState("ready"));
    imageElement.addEventListener("error", () => setState("failed"));
    setState(imageElement.complete ? (imageElement.naturalWidth > 0 ? "ready" : "failed") : "loading");
    focusedMediaResizeObserver?.observe(host);
    observedFocusedMedia.add(host);
  }

  function hydrateFocusedMedia(root = document) {
    if (root.matches?.("[data-focused-card-media]")) hydrateFocusedMediaHost(root);
    root.querySelectorAll?.("[data-focused-card-media]").forEach(hydrateFocusedMediaHost);
  }

  function clearDirectCrop(element) {
    [
      "coverCrop",
      "coverCropX",
      "coverCropY",
      "coverCropWidth",
      "coverCropHeight",
      "coverSourceWidth",
      "coverSourceHeight"
    ].forEach((key) => delete element.dataset[key]);
    ["position", "width", "height", "maxWidth", "left", "top", "right", "bottom", "objectFit"].forEach(
      (property) => {
        element.style[property] = "";
      }
    );
  }

  function applyToImage(element, src, options = {}) {
    if (!element) return;
    const normalized = normalize(src);
    const match = sources(normalized);
    element.src = normalized;
    if (match) {
      element.srcset = match.webp.join(", ");
      element.sizes = options.sizes || match.sizes || "100vw";
      element.width = options.width || match.width || element.width;
      element.height = options.height || match.height || element.height;
      if (options.fetchPriority) element.fetchPriority = options.fetchPriority;
    } else {
      element.removeAttribute("srcset");
      element.removeAttribute("sizes");
    }
    const crop = normalizeCrop(options.crop);
    if (!crop) {
      clearDirectCrop(element);
      return;
    }
    element.setAttribute("data-cover-crop", "true");
    element.dataset.coverCropX = String(crop.x);
    element.dataset.coverCropY = String(crop.y);
    element.dataset.coverCropWidth = String(crop.width);
    element.dataset.coverCropHeight = String(crop.height);
    element.dataset.coverSourceWidth = String(crop.sourceWidth);
    element.dataset.coverSourceHeight = String(crop.sourceHeight);
    requestAnimationFrame(() => hydrateCrop(element));
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          hydrateCrops(document);
          hydrateFocusedMedia(document);
        },
        { once: true }
      );
    } else {
      hydrateCrops(document);
      hydrateFocusedMedia(document);
    }
    new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            hydrateCrops(node);
            hydrateFocusedMedia(node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.LarkixMedia = {
    image,
    applyToImage,
    cropLayout,
    hydrateCrops,
    hydrateFocusedMedia,
    normalizeCrop,
    normalize,
    escapeAttr,
    escapeHtml
  };
})();
