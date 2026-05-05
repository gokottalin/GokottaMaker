(function () {
  const optimized = {
    "./assets/hero/electronics-lab-hero.png": {
      webp: [
        "./assets/hero/electronics-lab-hero-960.webp 960w",
        "./assets/hero/electronics-lab-hero-1600.webp 1600w"
      ],
      sizes: "100vw"
    },
    "./assets/covers/analog-cover.png": {
      webp: ["./assets/covers/analog-cover-480.webp 480w", "./assets/covers/analog-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px"
    },
    "./assets/covers/esp32-cover.png": {
      webp: ["./assets/covers/esp32-cover-480.webp 480w", "./assets/covers/esp32-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px"
    },
    "./assets/covers/project-cover.png": {
      webp: ["./assets/covers/project-cover-480.webp 480w", "./assets/covers/project-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px"
    },
    "./assets/covers/stm32-cover.png": {
      webp: ["./assets/covers/stm32-cover-480.webp 480w", "./assets/covers/stm32-cover-800.webp 800w"],
      sizes: "(max-width: 760px) 100vw, 220px"
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
    const img = `<img src="${escapeAttr(normalized)}"${classAttr} alt="${escapeAttr(alt)}"${loading}${decoding}${sizesAttr} />`;
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
    } else {
      element.removeAttribute("srcset");
      element.removeAttribute("sizes");
    }
  }

  window.GokottaMedia = {
    image,
    applyToImage,
    normalize
  };
})();
