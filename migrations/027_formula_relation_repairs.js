"use strict";

module.exports = {
  id: "027_formula_relation_repairs",
  name: "Add append-only formula relation repair evidence and public DAG gates",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS formula_relation_repair_queue (
        repair_id TEXT PRIMARY KEY,
        source_table TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_digest TEXT NOT NULL,
        source_formula_id TEXT NOT NULL DEFAULT '',
        source_revision_id TEXT NOT NULL DEFAULT '',
        target_reference TEXT NOT NULL DEFAULT '',
        issue_code TEXT NOT NULL,
        reason TEXT NOT NULL,
        candidate_target_ids_json TEXT NOT NULL DEFAULT '[]',
        evidence_json TEXT NOT NULL DEFAULT '{}',
        plan_digest TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (repair_id GLOB 'repair.*'),
        CHECK (source_table IN (
          'knowledge_nodes',
          'knowledge_node_revisions',
          'knowledge_links',
          'formula_revisions',
          'formula_revision_dependencies'
        )),
        CHECK (source_digest GLOB 'sha256:*'),
        CHECK (issue_code IN (
          'ambiguous_target',
          'missing_source',
          'missing_target',
          'duplicate_dependency',
          'self_reference',
          'evidence_conflict',
          'cycle',
          'archived_target',
          'invalid_shortcode',
          'relation_without_revision'
        )),
        CHECK (plan_digest GLOB 'sha256:*')
      );

      CREATE INDEX IF NOT EXISTS idx_formula_relation_repairs_source
        ON formula_relation_repair_queue(source_formula_id, source_revision_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_formula_relation_repairs_issue
        ON formula_relation_repair_queue(issue_code, created_at DESC, repair_id);

      CREATE TABLE IF NOT EXISTS formula_relation_repair_events (
        event_id TEXT PRIMARY KEY,
        repair_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        target_formula_id TEXT,
        evidence_json TEXT NOT NULL DEFAULT '{}',
        actor_user_id INTEGER,
        actor_username TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repair_id) REFERENCES formula_relation_repair_queue(repair_id),
        FOREIGN KEY (target_formula_id) REFERENCES formula_cards(formula_id),
        CHECK (event_id GLOB 'repair-event.*'),
        CHECK (event_type IN ('resolved', 'reopened')),
        CHECK (
          (event_type = 'resolved' AND length(target_formula_id) > 0) OR
          (event_type = 'reopened' AND target_formula_id IS NULL)
        ),
        CHECK (length(actor_username) <= 120)
      );

      CREATE INDEX IF NOT EXISTS idx_formula_relation_repair_events_latest
        ON formula_relation_repair_events(repair_id, created_at DESC, event_id DESC);

      CREATE TABLE IF NOT EXISTS formula_relation_migration_reports (
        report_digest TEXT PRIMARY KEY,
        plan_digest TEXT NOT NULL,
        backup_database_sha256 TEXT NOT NULL,
        mode TEXT NOT NULL,
        inserted_relation_count INTEGER NOT NULL DEFAULT 0,
        queued_repair_count INTEGER NOT NULL DEFAULT 0,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (report_digest GLOB 'sha256:*'),
        CHECK (plan_digest GLOB 'sha256:*'),
        CHECK (backup_database_sha256 GLOB 'sha256:*'),
        CHECK (mode IN ('dry_run', 'apply_verified')),
        CHECK (inserted_relation_count >= 0),
        CHECK (queued_repair_count >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_formula_relation_reports_plan
        ON formula_relation_migration_reports(plan_digest, mode, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS formula_relation_repair_queue_immutable_update
      BEFORE UPDATE ON formula_relation_repair_queue
      BEGIN
        SELECT RAISE(ABORT, 'formula relation repair queue is append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_relation_repair_queue_immutable_delete
      BEFORE DELETE ON formula_relation_repair_queue
      BEGIN
        SELECT RAISE(ABORT, 'formula relation repair queue is append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_relation_repair_events_immutable_update
      BEFORE UPDATE ON formula_relation_repair_events
      BEGIN
        SELECT RAISE(ABORT, 'formula relation repair events are append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_relation_repair_events_immutable_delete
      BEFORE DELETE ON formula_relation_repair_events
      BEGIN
        SELECT RAISE(ABORT, 'formula relation repair events are append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_relation_migration_reports_immutable_update
      BEFORE UPDATE ON formula_relation_migration_reports
      BEGIN
        SELECT RAISE(ABORT, 'formula relation migration reports are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS formula_relation_migration_reports_immutable_delete
      BEFORE DELETE ON formula_relation_migration_reports
      BEGIN
        SELECT RAISE(ABORT, 'formula relation migration reports are immutable');
      END;

      DROP TRIGGER IF EXISTS formula_cards_published_dependency_gate;

      CREATE TRIGGER formula_cards_published_dependency_gate
      BEFORE UPDATE OF published_revision_id, publish_status, archived_at ON formula_cards
      WHEN NEW.publish_status = 'published' AND NEW.published_revision_id IS NOT NULL
      BEGIN
        SELECT CASE
          WHEN EXISTS (
            SELECT 1
            FROM formula_revision_dependencies dependency
            LEFT JOIN formula_cards target
              ON target.formula_id = dependency.target_formula_id
            WHERE dependency.revision_id = NEW.published_revision_id
              AND (
                target.formula_id IS NULL
                OR target.publish_status <> 'published'
                OR target.archived_at IS NOT NULL
                OR target.published_revision_id IS NULL
                OR NOT EXISTS (
                  SELECT 1 FROM formula_revision_publications publication
                  WHERE publication.revision_id = target.published_revision_id
                    AND publication.formula_id = target.formula_id
                )
              )
          )
          THEN RAISE(ABORT, 'formula dependency is not eligible for publication')
        END;
        SELECT CASE
          WHEN EXISTS (
            WITH RECURSIVE reachable(formula_id) AS (
              SELECT target_formula_id
              FROM formula_revision_dependencies
              WHERE revision_id = NEW.published_revision_id
              UNION
              SELECT dependency.target_formula_id
              FROM reachable
              JOIN formula_cards card ON card.formula_id = reachable.formula_id
              JOIN formula_revision_dependencies dependency
                ON dependency.revision_id = CASE
                  WHEN card.formula_id = NEW.formula_id THEN NEW.published_revision_id
                  ELSE card.published_revision_id
                END
              WHERE CASE
                WHEN card.formula_id = NEW.formula_id THEN NEW.publish_status
                ELSE card.publish_status
              END = 'published'
                AND card.archived_at IS NULL
            )
            SELECT 1 FROM reachable WHERE formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'published formula dependency cycle is not allowed')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS formula_cards_public_projection_gate
      BEFORE UPDATE OF publish_status, published_revision_id, archived_at ON formula_cards
      WHEN NEW.publish_status = 'published'
      BEGIN
        SELECT CASE
          WHEN NEW.archived_at IS NOT NULL OR NEW.published_revision_id IS NULL
          THEN RAISE(ABORT, 'published formula must have an active published revision')
        END;
        SELECT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM formula_revision_publications publication
            WHERE publication.revision_id = NEW.published_revision_id
              AND publication.formula_id = NEW.formula_id
          )
          THEN RAISE(ABORT, 'published formula revision audit is missing')
        END;
      END;
    `);
  }
};
