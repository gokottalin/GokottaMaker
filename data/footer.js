(function () {
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
