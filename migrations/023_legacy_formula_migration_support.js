"use strict";

module.exports = {
  id: "023_legacy_formula_migration_support",
  name: "Add legacy formula migration backup, mapping, redirect, and audit support",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS legacy_formula_backup_manifests (
        manifest_digest TEXT PRIMARY KEY,
        source_database_sha256 TEXT NOT NULL,
        backup_database_sha256 TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (manifest_digest GLOB 'sha256:*'),
        CHECK (source_database_sha256 GLOB 'sha256:*'),
        CHECK (backup_database_sha256 GLOB 'sha256:*')
      );

      CREATE TABLE IF NOT EXISTS legacy_formula_mappings (
        source_table TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_digest TEXT NOT NULL,
        disposition TEXT NOT NULL,
        target_kind TEXT NOT NULL DEFAULT '',
        target_ids_json TEXT NOT NULL DEFAULT '[]',
        merge_key TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        source_status_json TEXT NOT NULL DEFAULT '{}',
        report_digest TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_table, source_key),
        CHECK (source_table IN ('knowledge_nodes', 'knowledge_node_revisions', 'knowledge_links')),
        CHECK (disposition IN ('mapped', 'merged', 'unresolved')),
        CHECK (source_digest GLOB 'sha256:*'),
        CHECK (report_digest GLOB 'sha256:*'),
        CHECK (
          (disposition = 'unresolved' AND target_kind = '' AND target_ids_json = '[]') OR
          (disposition IN ('mapped', 'merged') AND length(target_kind) > 0)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_legacy_formula_mappings_disposition
        ON legacy_formula_mappings(disposition, source_table, source_key);

      CREATE TABLE IF NOT EXISTS legacy_formula_redirects (
        legacy_slug TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL,
        formula_id TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        source_publish_status TEXT NOT NULL,
        source_visibility_status TEXT NOT NULL,
        source_deleted_at TEXT,
        verification_status TEXT NOT NULL,
        report_digest TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (length(legacy_slug) BETWEEN 2 AND 80),
        CHECK (legacy_slug = lower(legacy_slug)),
        CHECK (legacy_slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(target_slug) BETWEEN 2 AND 80),
        CHECK (target_slug = lower(target_slug)),
        CHECK (target_slug NOT GLOB '*[^a-z0-9-]*'),
        CHECK (length(source_node_id) BETWEEN 2 AND 97),
        CHECK (source_publish_status IN ('draft', 'published', 'archived')),
        CHECK (source_visibility_status IN ('public', 'unlisted', 'private')),
        CHECK (verification_status IN ('verified', 'rejected')),
        CHECK (report_digest GLOB 'sha256:*')
      );

      CREATE INDEX IF NOT EXISTS idx_legacy_formula_redirects_target
        ON legacy_formula_redirects(target_slug, verification_status, legacy_slug);

      CREATE TABLE IF NOT EXISTS legacy_formula_migration_reports (
        report_digest TEXT PRIMARY KEY,
        plan_digest TEXT NOT NULL,
        manifest_digest TEXT NOT NULL,
        mode TEXT NOT NULL,
        unresolved_count INTEGER NOT NULL,
        cleanup_eligible INTEGER NOT NULL DEFAULT 0,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (report_digest GLOB 'sha256:*'),
        CHECK (plan_digest GLOB 'sha256:*'),
        CHECK (manifest_digest GLOB 'sha256:*'),
        CHECK (mode IN ('apply_verified', 'apply_blocked', 'cleanup_completed')),
        CHECK (unresolved_count >= 0),
        CHECK (cleanup_eligible IN (0, 1))
      );

      CREATE INDEX IF NOT EXISTS idx_legacy_formula_reports_gate
        ON legacy_formula_migration_reports(mode, cleanup_eligible, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS legacy_formula_backup_manifests_immutable_update
      BEFORE UPDATE ON legacy_formula_backup_manifests
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula backup manifests are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_backup_manifests_immutable_delete
      BEFORE DELETE ON legacy_formula_backup_manifests
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula backup manifests are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_mappings_immutable_update
      BEFORE UPDATE ON legacy_formula_mappings
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula mappings are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_mappings_immutable_delete
      BEFORE DELETE ON legacy_formula_mappings
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula mappings are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_redirects_immutable_update
      BEFORE UPDATE ON legacy_formula_redirects
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula redirects are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_redirects_immutable_delete
      BEFORE DELETE ON legacy_formula_redirects
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula redirects are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_migration_reports_immutable_update
      BEFORE UPDATE ON legacy_formula_migration_reports
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula migration reports are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS legacy_formula_migration_reports_immutable_delete
      BEFORE DELETE ON legacy_formula_migration_reports
      BEGIN
        SELECT RAISE(ABORT, 'legacy formula migration reports are immutable');
      END;
    `);
  }
};
