function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function replaceBrandInColumns(db, table, columns) {
  if (!tableExists(db, table)) return;
  const existing = columnNames(db, table);
  for (const column of columns) {
    if (!existing.has(column)) continue;
    db.prepare(
      `UPDATE ${table}
       SET ${column} = REPLACE(${column}, 'Gokotta', 'Larkix')
       WHERE ${column} LIKE '%Gokotta%'`
    ).run();
  }
}

module.exports = {
  id: "010_larkix_brand_rename",
  name: "Rename visible brand text to Larkix",
  up(db) {
    replaceBrandInColumns(db, "posts", ["title", "excerpt", "markdown", "tags"]);
    replaceBrandInColumns(db, "projects", ["title", "summary", "markdown", "tags", "repo_url", "bom_url", "docs_url"]);
    replaceBrandInColumns(db, "content_revisions", ["content_title", "snapshot_json"]);
    replaceBrandInColumns(db, "audit_logs", ["action", "target_title", "details_json"]);
    replaceBrandInColumns(db, "site_settings", ["value_json"]);
  }
};
