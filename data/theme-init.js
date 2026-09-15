(function () {
  const themeKey = "larkixmaker-theme";
  let theme = "light";

  try {
    const storedTheme = localStorage.getItem(themeKey);
    if (storedTheme === "light" || storedTheme === "dark") {
      theme = storedTheme;
    }
  } catch (error) {
    /* Storage can be unavailable; light is the deterministic safe default. */
  }

  document.documentElement.dataset.theme = theme;
})();
