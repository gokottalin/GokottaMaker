(function () {
  const themeKey = "larkixmaker-theme";
  const root = document.documentElement;

  const getStoredTheme = () => {
    try {
      return localStorage.getItem(themeKey);
    } catch (error) {
      return null;
    }
  };

  const setStoredTheme = (theme) => {
    try {
      localStorage.setItem(themeKey, theme);
    } catch (error) {
      /* Theme choice still works for the current page. */
    }
  };

  const updateThemeControls = (theme) => {
    const isDark = theme === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", isDark ? "切换日间模式" : "切换夜间模式");
      button.setAttribute("title", isDark ? "切换日间模式" : "切换夜间模式");
      button.setAttribute("aria-pressed", String(isDark));
      button.dataset.themeState = theme;
    });
  };

  const applyTheme = (theme, persist = false) => {
    root.dataset.theme = theme;
    if (persist) {
      setStoredTheme(theme);
    }
    updateThemeControls(theme);
  };

  const setupNavControls = () => {
    document.querySelectorAll(".site-header").forEach((header, index) => {
      const inner = header.querySelector(".header-inner");
      const nav = header.querySelector(".main-nav");
      const brand = header.querySelector(".brand");
      if (!inner || !nav || !brand || header.querySelector("[data-nav-toggle]")) {
        return;
      }

      const navId = nav.id || `siteNav-${index + 1}`;
      nav.id = navId;

      const button = document.createElement("button");
      button.className = "nav-toggle";
      button.type = "button";
      button.dataset.navToggle = "";
      button.setAttribute("aria-controls", navId);
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "展开导航");
      button.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span><span class="visually-hidden">导航</span>';
      brand.insertAdjacentElement("afterend", button);
    });
  };

  const setThemeOrigin = (button) => {
    const rect = button.getBoundingClientRect();
    root.style.setProperty("--theme-x", `${Math.round(rect.left + rect.width / 2)}px`);
    root.style.setProperty("--theme-y", `${Math.round(rect.top + rect.height / 2)}px`);
  };

  const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const transitionTheme = (theme, button) => {
    setThemeOrigin(button);
    const commit = () => applyTheme(theme, true);
    if (!document.startViewTransition || prefersReducedMotion()) {
      root.classList.add("theme-switching");
      commit();
      window.setTimeout(() => root.classList.remove("theme-switching"), 360);
      return;
    }
    root.classList.add("theme-switching");
    const transition = document.startViewTransition(commit);
    transition.finished.finally(() => root.classList.remove("theme-switching"));
  };

  const systemTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(getStoredTheme() || systemTheme);
  setupNavControls();

  document.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-nav-toggle]");
    if (navButton) {
      const header = navButton.closest(".site-header");
      const expanded = navButton.getAttribute("aria-expanded") === "true";
      navButton.setAttribute("aria-expanded", String(!expanded));
      navButton.setAttribute("aria-label", expanded ? "展开导航" : "收起导航");
      header?.classList.toggle("is-nav-open", !expanded);
      return;
    }

    const button = event.target.closest("[data-theme-toggle]");
    if (!button) {
      return;
    }
    transitionTheme(root.dataset.theme === "dark" ? "light" : "dark", button);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".site-header.is-nav-open").forEach((header) => {
      header.classList.remove("is-nav-open");
      const button = header.querySelector("[data-nav-toggle]");
      button?.setAttribute("aria-expanded", "false");
      button?.setAttribute("aria-label", "展开导航");
    });
  });

  const meta = window.LARKIX_SITE_META || {};
  const siteBrand = document.body.dataset.siteBrand || "LarkixMaker";
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-shell site-footer-inner">
      <span>${siteBrand}</span>
      <span>Version ${meta.versionLabel || "V1.0.0+20260504-0149"}</span>
    </div>
  `;
  document.body.appendChild(footer);
})();
