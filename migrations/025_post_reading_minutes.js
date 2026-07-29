const MAX_READING_MINUTES = 9999;

module.exports = {
  id: "025_post_reading_minutes",
  name: "Add nullable positive-integer post reading minutes",
  up(db) {
    const columns = new Set(db.prepare("PRAGMA table_info(posts)").all().map((column) => column.name));
    if (!columns.has("reading_minutes")) {
      db.exec("ALTER TABLE posts ADD COLUMN reading_minutes INTEGER");
    }

    db.exec(`
      DROP TRIGGER IF EXISTS posts_reading_minutes_validate_insert;
      DROP TRIGGER IF EXISTS posts_reading_minutes_validate_update;
      DROP TRIGGER IF EXISTS posts_reading_minutes_seed_compatibility;

      CREATE TRIGGER posts_reading_minutes_validate_insert
      BEFORE INSERT ON posts
      WHEN NEW.reading_minutes IS NOT NULL
        AND (
          TYPEOF(NEW.reading_minutes) != 'integer'
          OR NEW.reading_minutes NOT BETWEEN 1 AND ${MAX_READING_MINUTES}
        )
      BEGIN
        SELECT RAISE(ABORT, 'invalid post reading minutes');
      END;

      CREATE TRIGGER posts_reading_minutes_validate_update
      BEFORE UPDATE OF reading_minutes ON posts
      WHEN NEW.reading_minutes IS NOT NULL
        AND (
          TYPEOF(NEW.reading_minutes) != 'integer'
          OR NEW.reading_minutes NOT BETWEEN 1 AND ${MAX_READING_MINUTES}
        )
      BEGIN
        SELECT RAISE(ABORT, 'invalid post reading minutes');
      END;

      CREATE TRIGGER posts_reading_minutes_seed_compatibility
      AFTER INSERT ON posts
      WHEN NEW.reading_minutes IS NULL
        AND CAST(NEW.read_time AS TEXT) IS NOT NULL
        AND CAST(TRIM(CAST(NEW.read_time AS TEXT)) AS INTEGER) BETWEEN 1 AND ${MAX_READING_MINUTES}
        AND (
          TRIM(CAST(NEW.read_time AS TEXT)) =
            PRINTF('%d', CAST(TRIM(CAST(NEW.read_time AS TEXT)) AS INTEGER))
          OR TRIM(CAST(NEW.read_time AS TEXT)) =
            PRINTF('%d 分钟阅读', CAST(TRIM(CAST(NEW.read_time AS TEXT)) AS INTEGER))
        )
      BEGIN
        UPDATE posts
        SET reading_minutes = CAST(TRIM(CAST(NEW.read_time AS TEXT)) AS INTEGER),
            read_time = NULL
        WHERE id = NEW.id;
      END;
    `);
  }
};
