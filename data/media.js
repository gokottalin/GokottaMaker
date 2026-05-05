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
    if (!match) return img;
    return `<picture><source type="image/webp" srcset="${escapeAttr(match.webp.join(", "))}"${sizesAttr} />${img}</picture>`;
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
  }

  window.GokottaMedia = {
    image,
    applyToImage,
    normalize,
    escapeAttr,
    escapeHtml
  };
})();
