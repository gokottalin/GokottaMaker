(function () {
  const pageKey = document.body.dataset.layoutPage;
  const container = document.querySelector("[data-layout-container]") || document.querySelector("#mainContent");
  let siteLayout = window.GOKOTTA_SERVER_CONTENT?.siteLayout || {};
  let layoutSignature = JSON.stringify(siteLayout);

  function rowsForPage() {
    return Array.isArray(siteLayout[pageKey]) ? siteLayout[pageKey] : [];
  }

  function applyLayout() {
    if (!pageKey || !container) return;
    const sections = [...container.children].filter((section) => section.dataset.layoutSection);
    if (!sections.length) return;
    const orderMap = new Map(rowsForPage().map((item) => [item.key, item]));
    sections
      .sort((a, b) => {
        const left = Number(orderMap.get(a.dataset.layoutSection)?.order ?? 99);
        const right = Number(orderMap.get(b.dataset.layoutSection)?.order ?? 99);
        return left - right;
      })
      .forEach((section) => {
        const config = orderMap.get(section.dataset.layoutSection);
        section.hidden = config?.visible === false;
        section.dataset.layoutSize = config?.size || "standard";
        container.appendChild(section);
      });
  }

  function startPolling() {
    if (!window.GOKOTTA_SERVER_CONTENT || !window.fetch) return;
    window.setInterval(async () => {
      try {
        const response = await fetch("./api/content", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const nextLayout = payload.siteLayout || {};
        const nextSignature = JSON.stringify(nextLayout);
        if (nextSignature === layoutSignature) return;
        siteLayout = nextLayout;
        layoutSignature = nextSignature;
        applyLayout();
      } catch {
        return;
      }
    }, 3000);
  }

  window.GokottaSiteLayout = { apply: applyLayout };
  applyLayout();
  startPolling();
})();
