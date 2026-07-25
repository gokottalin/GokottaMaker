const defaultPublicFocusMode = {
  enabled: false,
  primaryScope: "power-electronics",
  visibleScopes: ["home", "power-electronics", "derivations"],
  hiddenScopes: ["analog", "stm32", "esp32", "projects"],
  hideMiniappsFromPrimaryNav: true,
  hideAdminFromPublicNav: true,
  noindexHiddenLandingPages: true,
  noindexHiddenDetailPages: false,
  homepageMode: "focused",
  bannerCopy: ""
};

module.exports = {
  id: "013_public_focus_mode_default",
  name: "Add disabled public focus mode setting",
  up(db) {
    db.prepare(
      `INSERT OR IGNORE INTO site_settings (key, value_json)
       VALUES (?, ?)`
    ).run("public_focus_mode", JSON.stringify(defaultPublicFocusMode));
  }
};
