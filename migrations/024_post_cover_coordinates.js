const CROP_COLUMNS = [
  ["cover_crop_x", "REAL"],
  ["cover_crop_y", "REAL"],
  ["cover_crop_width", "REAL"],
  ["cover_crop_height", "REAL"],
  ["cover_crop_source_width", "INTEGER"],
  ["cover_crop_source_height", "INTEGER"]
];

module.exports = {
  id: "024_post_cover_coordinates",
  name: "Add reversible normalized post cover coordinates",
  up(db) {
    const columns = new Set(db.prepare("PRAGMA table_info(posts)").all().map((column) => column.name));
    for (const [name, definition] of CROP_COLUMNS) {
      if (!columns.has(name)) db.exec(`ALTER TABLE posts ADD COLUMN ${name} ${definition}`);
    }

    db.exec(`
      DROP TRIGGER IF EXISTS posts_cover_crop_validate_insert;
      DROP TRIGGER IF EXISTS posts_cover_crop_validate_update;

      CREATE TRIGGER posts_cover_crop_validate_insert
      BEFORE INSERT ON posts
      WHEN NOT (
        (
          NEW.cover_crop_x IS NULL
          AND NEW.cover_crop_y IS NULL
          AND NEW.cover_crop_width IS NULL
          AND NEW.cover_crop_height IS NULL
          AND NEW.cover_crop_source_width IS NULL
          AND NEW.cover_crop_source_height IS NULL
        )
        OR (
          NEW.cover_crop_x IS NOT NULL
          AND NEW.cover_crop_y IS NOT NULL
          AND NEW.cover_crop_width IS NOT NULL
          AND NEW.cover_crop_height IS NOT NULL
          AND NEW.cover_crop_source_width IS NOT NULL
          AND NEW.cover_crop_source_height IS NOT NULL
          AND NEW.cover_crop_x >= 0.0
          AND NEW.cover_crop_y >= 0.0
          AND NEW.cover_crop_width > 0.0
          AND NEW.cover_crop_height > 0.0
          AND NEW.cover_crop_x <= 1.0
          AND NEW.cover_crop_y <= 1.0
          AND NEW.cover_crop_width <= 1.0
          AND NEW.cover_crop_height <= 1.0
          AND NEW.cover_crop_x + NEW.cover_crop_width <= 1.000000001
          AND NEW.cover_crop_y + NEW.cover_crop_height <= 1.000000001
          AND NEW.cover_crop_source_width = CAST(NEW.cover_crop_source_width AS INTEGER)
          AND NEW.cover_crop_source_height = CAST(NEW.cover_crop_source_height AS INTEGER)
          AND NEW.cover_crop_source_width BETWEEN 1 AND 100000
          AND NEW.cover_crop_source_height BETWEEN 1 AND 100000
          AND ABS(
            NEW.cover_crop_width * NEW.cover_crop_source_width
            - NEW.cover_crop_height * NEW.cover_crop_source_height * 16.0 / 9.0
          ) <= MAX(
            1.0,
            NEW.cover_crop_height * NEW.cover_crop_source_height * 16.0 / 9.0 * 0.001
          )
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid post cover crop coordinates');
      END;

      CREATE TRIGGER posts_cover_crop_validate_update
      BEFORE UPDATE OF
        cover_crop_x,
        cover_crop_y,
        cover_crop_width,
        cover_crop_height,
        cover_crop_source_width,
        cover_crop_source_height
      ON posts
      WHEN NOT (
        (
          NEW.cover_crop_x IS NULL
          AND NEW.cover_crop_y IS NULL
          AND NEW.cover_crop_width IS NULL
          AND NEW.cover_crop_height IS NULL
          AND NEW.cover_crop_source_width IS NULL
          AND NEW.cover_crop_source_height IS NULL
        )
        OR (
          NEW.cover_crop_x IS NOT NULL
          AND NEW.cover_crop_y IS NOT NULL
          AND NEW.cover_crop_width IS NOT NULL
          AND NEW.cover_crop_height IS NOT NULL
          AND NEW.cover_crop_source_width IS NOT NULL
          AND NEW.cover_crop_source_height IS NOT NULL
          AND NEW.cover_crop_x >= 0.0
          AND NEW.cover_crop_y >= 0.0
          AND NEW.cover_crop_width > 0.0
          AND NEW.cover_crop_height > 0.0
          AND NEW.cover_crop_x <= 1.0
          AND NEW.cover_crop_y <= 1.0
          AND NEW.cover_crop_width <= 1.0
          AND NEW.cover_crop_height <= 1.0
          AND NEW.cover_crop_x + NEW.cover_crop_width <= 1.000000001
          AND NEW.cover_crop_y + NEW.cover_crop_height <= 1.000000001
          AND NEW.cover_crop_source_width = CAST(NEW.cover_crop_source_width AS INTEGER)
          AND NEW.cover_crop_source_height = CAST(NEW.cover_crop_source_height AS INTEGER)
          AND NEW.cover_crop_source_width BETWEEN 1 AND 100000
          AND NEW.cover_crop_source_height BETWEEN 1 AND 100000
          AND ABS(
            NEW.cover_crop_width * NEW.cover_crop_source_width
            - NEW.cover_crop_height * NEW.cover_crop_source_height * 16.0 / 9.0
          ) <= MAX(
            1.0,
            NEW.cover_crop_height * NEW.cover_crop_source_height * 16.0 / 9.0 * 0.001
          )
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid post cover crop coordinates');
      END;
    `);
  }
};
