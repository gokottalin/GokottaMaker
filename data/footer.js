(function () {
  const themeKey = "gokottamaker-theme";
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

  const systemTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(getStoredTheme() || systemTheme);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) {
      return;
    }
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });

  const meta = window.GOKOTTA_SITE_META || {};
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-shell site-footer-inner">
      <span>GokottaMaker</span>
      <span>Version ${meta.versionLabel || "V1.0.0+20260504-0149"}</span>
    </div>
  `;
  document.body.appendChild(footer);
})();
