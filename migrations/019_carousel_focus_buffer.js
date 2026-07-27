"use strict";

module.exports = {
  id: "019_carousel_focus_buffer",
  name: "Add persistent focus-aware carousel buffer",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS carousel_focus_buffer (
        buffer_id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL CHECK (content_type IN ('post', 'project')),
        content_id TEXT NOT NULL,
        content_slug TEXT NOT NULL DEFAULT '',
        content_title TEXT NOT NULL DEFAULT '',
        image_reference TEXT NOT NULL DEFAULT '',
        original_slot INTEGER NOT NULL CHECK (original_slot BETWEEN 0 AND 3),
        buffered_reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'buffered'
          CHECK (status IN ('buffered', 'restored', 'removed')),
        buffered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        restored_at TEXT,
        removed_at TEXT,
        UNIQUE (content_type, content_id)
      );

      CREATE INDEX IF NOT EXISTS idx_carousel_focus_buffer_status_slot
        ON carousel_focus_buffer (status, original_slot, buffered_at);
    `);
  }
};
