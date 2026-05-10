#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
TARGET_DIR="${2:-/srv/gokottamaker-data}"
DRY_RUN="${DRY_RUN:-false}"

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="true"
  BACKUP_DIR="${2:-}"
  TARGET_DIR="${3:-/srv/gokottamaker-data}"
fi

command_exists() {
  command -v "$1" >/dev/null 2>&1
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

validate_backup() {
  if [ ! -d "${BACKUP_DIR}/database" ] && [ ! -d "${BACKUP_DIR}/uploads" ]; then
    echo "ERROR: Backup must contain at least database/ or uploads/." >&2
    exit 2
  fi

  if [ -f "${BACKUP_DIR}/manifest.sha256" ] && command_exists sha256sum; then
    (
      cd "$BACKUP_DIR"
      sha256sum -c manifest.sha256
    )
  elif [ -f "${BACKUP_DIR}/manifest.sha256" ]; then
    echo "WARNING: manifest.sha256 exists but sha256sum is not available; checksum verification skipped." >&2
  else
    echo "WARNING: manifest.sha256 not found; checksum verification skipped." >&2
  fi

  local backup_db_integrity
  backup_db_integrity="$(sqlite_integrity_check "${BACKUP_DIR}/database/gokottamaker.sqlite" || true)"
  if [ "$backup_db_integrity" != "missing" ] && [ "$backup_db_integrity" != "ok" ] && [ "$backup_db_integrity" != "skipped-sqlite3-missing" ]; then
    echo "ERROR: Backup SQLite integrity check failed: $backup_db_integrity" >&2
    exit 3
  fi

  echo "Backup validation passed. SQLite integrity: $backup_db_integrity"
}

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Usage: sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS [/srv/gokottamaker-data]"
  echo "Dry run: sudo bash scripts/restore-linux.sh --dry-run /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS"
  echo "Legacy dry run: sudo env DRY_RUN=true bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS"
  exit 1
fi

case "$TARGET_DIR" in
  ""|"/"|"/srv"|"/srv/"|"/opt"|"/opt/")
    echo "ERROR: Refusing to restore into unsafe target directory: $TARGET_DIR" >&2
    exit 4
    ;;
esac

validate_backup

if [ "$DRY_RUN" = "true" ]; then
  echo "Dry run completed. No files changed."
  echo "Would restore from: $BACKUP_DIR"
  echo "Would restore into: $TARGET_DIR"
  exit 0
fi

if systemctl list-unit-files | grep -q '^gokottamaker.service'; then
  systemctl stop gokottamaker || true
fi

STAMP="$(date +%Y-%m-%d_%H-%M)"
SAFETY_COPY="${TARGET_DIR}.before-restore-${STAMP}"

if [ -d "$TARGET_DIR" ]; then
  cp -a "$TARGET_DIR" "$SAFETY_COPY"
  echo "Safety copy created: $SAFETY_COPY"
fi

mkdir -p "$TARGET_DIR"

if [ -d "${BACKUP_DIR}/database" ]; then
  rm -rf "${TARGET_DIR}/database"
  cp -a "${BACKUP_DIR}/database" "${TARGET_DIR}/database"
fi

if [ -d "${BACKUP_DIR}/uploads" ]; then
  rm -rf "${TARGET_DIR}/uploads"
  cp -a "${BACKUP_DIR}/uploads" "${TARGET_DIR}/uploads"
fi

if systemctl list-unit-files | grep -q '^gokottamaker.service'; then
  systemctl start gokottamaker
fi

RESTORED_DB_INTEGRITY="$(sqlite_integrity_check "${TARGET_DIR}/database/gokottamaker.sqlite" || true)"
if [ "$RESTORED_DB_INTEGRITY" != "missing" ] && [ "$RESTORED_DB_INTEGRITY" != "ok" ] && [ "$RESTORED_DB_INTEGRITY" != "skipped-sqlite3-missing" ]; then
  echo "ERROR: Restored SQLite integrity check failed: $RESTORED_DB_INTEGRITY" >&2
  exit 5
fi

echo "Restore completed from: $BACKUP_DIR"
echo "Restored SQLite integrity: $RESTORED_DB_INTEGRITY"
