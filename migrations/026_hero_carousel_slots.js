"use strict";

module.exports = {
  id: "026_hero_carousel_slots",
  name: "Add authoritative Hero carousel slots and conflict audit",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS hero_carousel_slots (
        slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 0 AND 3),
        content_type TEXT NOT NULL CHECK (content_type IN ('post', 'project')),
        content_id TEXT NOT NULL,
        content_title TEXT NOT NULL DEFAULT '',
        assignment_source TEXT NOT NULL DEFAULT 'legacy_migration',
        assigned_by_user_id INTEGER,
        assigned_by_username TEXT NOT NULL DEFAULT '',
        assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (content_type, content_id)
      );

      CREATE TABLE IF NOT EXISTS hero_carousel_slot_conflicts (
        report_id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id TEXT NOT NULL,
        slot INTEGER,
        content_type TEXT NOT NULL CHECK (content_type IN ('post', 'project')),
        content_id TEXT NOT NULL,
        content_title TEXT NOT NULL DEFAULT '',
        reason_code TEXT NOT NULL,
        resolution_status TEXT NOT NULL DEFAULT 'requires_manual_resolution'
          CHECK (resolution_status IN ('requires_manual_resolution')),
        detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (migration_id, content_type, content_id, reason_code)
      );

      CREATE INDEX IF NOT EXISTS idx_hero_carousel_conflicts_slot
        ON hero_carousel_slot_conflicts (slot, report_id);

      WITH legacy_claims AS (
        SELECT 'post' AS content_type, id AS content_id, title AS content_title,
               featured_order AS slot
        FROM posts
        WHERE featured = 1 AND deleted_at IS NULL
        UNION ALL
        SELECT 'project' AS content_type, id AS content_id, title AS content_title,
               featured_order AS slot
        FROM projects
        WHERE featured = 1 AND deleted_at IS NULL
      ),
      classified AS (
        SELECT claims.*,
               CASE
                 WHEN slot < 0 OR slot > 3 THEN 'LEGACY_SLOT_OUT_OF_RANGE'
                 WHEN (
                   SELECT COUNT(*)
                   FROM legacy_claims peers
                   WHERE peers.slot = claims.slot
                 ) > 1 THEN 'LEGACY_SLOT_COLLISION'
                 ELSE ''
               END AS reason_code
        FROM legacy_claims claims
      )
      INSERT OR IGNORE INTO hero_carousel_slot_conflicts
        (migration_id, slot, content_type, content_id, content_title, reason_code)
      SELECT '026_hero_carousel_slots', slot, content_type, content_id, content_title, reason_code
      FROM classified
      WHERE reason_code <> '';

      WITH legacy_claims AS (
        SELECT 'post' AS content_type, id AS content_id, title AS content_title,
               featured_order AS slot
        FROM posts
        WHERE featured = 1 AND deleted_at IS NULL
        UNION ALL
        SELECT 'project' AS content_type, id AS content_id, title AS content_title,
               featured_order AS slot
        FROM projects
        WHERE featured = 1 AND deleted_at IS NULL
      )
      INSERT OR IGNORE INTO hero_carousel_slots
        (slot, content_type, content_id, content_title, assignment_source)
      SELECT claims.slot, claims.content_type, claims.content_id, claims.content_title,
             'legacy_migration'
      FROM legacy_claims claims
      WHERE claims.slot BETWEEN 0 AND 3
        AND (
          SELECT COUNT(*)
          FROM legacy_claims peers
          WHERE peers.slot = claims.slot
        ) = 1;
    `);
  }
};
