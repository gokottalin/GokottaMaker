(function formulaDetailPage(global) {
  "use strict";

  const match = global.location.pathname.match(/^\/formula\/([^/]+)$/);
  let slug = "";
  try {
    slug = match ? decodeURIComponent(match[1]) : "";
  } catch {
    slug = "";
  }
  global.renderFormulaCardPage(
    { heroId: "formulaHero", contentId: "formulaContent", tocId: "formulaToc", canonicalDetail: true },
    slug
  );
})(window);
