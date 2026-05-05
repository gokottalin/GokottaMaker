#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-/srv/gokottamaker-data}"
BACKUP_ROOT="${2:-/srv/gokottamaker-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_BACKUPS="${MIN_BACKUPS:-5}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET="${BACKUP_ROOT}/${STAMP}"
MANIFEST="${TARGET}/manifest.txt"
CHECKSUMS="${TARGET}/manifest.sha256"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

bytes_for_path() {
  if [ -e "$1" ]; then
    du -sb "$1" 2>/dev/null | awk '{print $1}'
  else
    echo 0
  fi
}

file_count_for_path() {
  if [ -d "$1" ]; then
    find "$1" -type f | wc -l | awk '{print $1}'
  else
    echo 0
  fi
}

sqlite_integrity_check() {
  local db_file="$1"

  if [ ! -f "$db_file" ]; then
    echo "missing"
    return 0
  fi

  if ! command_exists sqlite3; then
    echo "skipped-sqlite3-missing"
    return 0
  fi

  local result
  result="$(sqlite3 "$db_file" "PRAGMA integrity_check;" 2>&1 || true)"
  if [ "$result" != "ok" ]; then
    echo "$result"
    return 1
  fi

  echo "ok"
}

mkdir -p "$TARGET"

SOURCE_DB="${SOURCE_DIR}/database/gokottamaker.sqlite"
TARGET_DB="${TARGET}/database/gokottamaker.sqlite"
SOURCE_DB_INTEGRITY="$(sqlite_integrity_check "$SOURCE_DB" || true)"

if [ -d "${SOURCE_DIR}/database" ]; then
  mkdir -p "${TARGET}/database"

  if [ -f "$SOURCE_DB" ] && command_exists sqlite3; then
    sqlite3 "$SOURCE_DB" ".backup '${TARGET_DB}'"

    find "${SOURCE_DIR}/database" -mindepth 1 -maxdepth 1 -type f ! -name "gokottamaker.sqlite" \
      -exec cp -a {} "${TARGET}/database/" \;
  else
    cp -a "${SOURCE_DIR}/database/." "${TARGET}/database/"
  fi
fi

if [ -d "${SOURCE_DIR}/uploads" ]; then
  cp -a "${SOURCE_DIR}/uploads" "$TARGET/"
fi

TARGET_DB_INTEGRITY="$(sqlite_integrity_check "$TARGET_DB" || true)"

{
  echo "name=GokottaMaker backup"
  echo "created_at=$(date -Iseconds)"
  echo "source_dir=${SOURCE_DIR}"
  echo "backup_dir=${TARGET}"
  echo "database_file=${TARGET_DB}"
  echo "source_database_integrity=${SOURCE_DB_INTEGRITY}"
  echo "backup_database_integrity=${TARGET_DB_INTEGRITY}"
  echo "source_database_bytes=$(bytes_for_path "$SOURCE_DB")"
  echo "backup_database_bytes=$(bytes_for_path "$TARGET_DB")"
  echo "source_uploads_files=$(file_count_for_path "${SOURCE_DIR}/uploads")"
  echo "backup_uploads_files=$(file_count_for_path "${TARGET}/uploads")"
  echo "backup_total_bytes=$(bytes_for_path "$TARGET")"
} > "$MANIFEST"

if command_exists sha256sum; then
  (
    cd "$TARGET"
    find . -type f ! -name "manifest.sha256" -print0 | sort -z | xargs -0 sha256sum
  ) > "$CHECKSUMS"
else
  echo "sha256sum is not available; checksum manifest skipped." >&2
fi

if [ "$SOURCE_DB_INTEGRITY" != "missing" ] && [ "$SOURCE_DB_INTEGRITY" != "ok" ] && [ "$SOURCE_DB_INTEGRITY" != "skipped-sqlite3-missing" ]; then
  echo "ERROR: Source SQLite integrity check failed: $SOURCE_DB_INTEGRITY" >&2
  exit 3
fi

if [ "$TARGET_DB_INTEGRITY" != "missing" ] && [ "$TARGET_DB_INTEGRITY" != "ok" ] && [ "$TARGET_DB_INTEGRITY" != "skipped-sqlite3-missing" ]; then
  echo "ERROR: Backup SQLite integrity check failed: $TARGET_DB_INTEGRITY" >&2
  exit 4
fi

if [ "$MIN_BACKUPS" -gt 0 ]; then
  mapfile -t OLD_BACKUPS < <(
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -printf '%T@ %p\n' \
      | sort -n \
      | awk '{print $2}'
  )

  BACKUP_COUNT="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l | awk '{print $1}')"
  for old_backup in "${OLD_BACKUPS[@]}"; do
    if [ "$BACKUP_COUNT" -le "$MIN_BACKUPS" ]; then
      break
    fi
    rm -rf "$old_backup"
    BACKUP_COUNT=$((BACKUP_COUNT - 1))
  done
else
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
fi

echo "Backup created: $TARGET"
echo "Manifest: $MANIFEST"
