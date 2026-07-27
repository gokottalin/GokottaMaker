"use strict";

const focusPolicy = {
  enabled: true,
  ownerConfigured: false,
  primaryScope: "electronics-basics",
  visibleScopes: ["electronics-basics", "derivations", "projects"],
  scopeAliases: { "power-electronics": "electronics-basics" },
  homepageOrder: ["electronics-basics", "derivations", "projects"],
  hideMiniappsFromPrimaryNav: true,
  hideAdminFromPublicNav: true,
  noindexHiddenLandingPages: true,
  noindexHiddenDetailPages: true,
  homepageMode: "focused",
  schemaVersion: 2
};

module.exports = {
  id: "018_focus_mode_scope_gate",
  name: "Normalize global focus mode to default-enabled server scope gate",
  up(db) {
    const row = db.prepare("SELECT value_json AS valueJson FROM site_settings WHERE key = ?").get("public_focus_mode");
    let current = {};
    try {
      current = row ? JSON.parse(row.valueJson) : {};
    } catch {
      current = {};
    }
    const ownerConfigured = current.ownerConfigured === true;
    const next = {
      ...focusPolicy,
      enabled: ownerConfigured ? current.enabled !== false : true,
      ownerConfigured
    };
    db.prepare(
      `INSERT INTO site_settings (key, value_json, updated_at)
       VALUES ('public_focus_mode', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = CURRENT_TIMESTAMP`
    ).run(JSON.stringify(next));
  }
};
