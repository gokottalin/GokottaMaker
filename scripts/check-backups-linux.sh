#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${1:-/srv/gokottamaker-backups}"
MAX_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ ! -d "$BACKUP_ROOT" ]; then
  printf '{"ok":false,"error":"backup root not found","backupRoot":"%s"}\n' "$(json_escape "$BACKUP_ROOT")"
  exit 2
fi

LATEST="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk 'NR==1 {print $2}')"
COUNT="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l | awk '{print $1}')"

if [ -z "$LATEST" ]; then
  printf '{"ok":false,"backupRoot":"%s","count":0,"error":"no backups found"}\n' "$(json_escape "$BACKUP_ROOT")"
  exit 3
fi

NOW="$(date +%s)"
LATEST_MTIME="$(stat -c %Y "$LATEST")"
AGE_SECONDS=$((NOW - LATEST_MTIME))
AGE_HOURS="$(awk "BEGIN { printf \"%.2f\", ${AGE_SECONDS}/3600 }")"
AGE_OK="$(awk "BEGIN { print (${AGE_SECONDS} <= (${MAX_AGE_HOURS} * 3600)) ? 1 : 0 }")"

CHECKSUM_STATUS="missing"
if [ -f "${LATEST}/manifest.sha256" ]; then
  if command_exists sha256sum; then
    if (cd "$LATEST" && sha256sum -c manifest.sha256 >/tmp/gokottamaker-backup-checksum.log 2>&1); then
      CHECKSUM_STATUS="ok"
    else
      CHECKSUM_STATUS="failed"
    fi
  else
    CHECKSUM_STATUS="skipped-sha256sum-missing"
  fi
fi

DB_STATUS="missing"
if [ -f "${LATEST}/database/gokottamaker.sqlite" ]; then
  if command_exists sqlite3; then
    DB_STATUS="$(sqlite3 "${LATEST}/database/gokottamaker.sqlite" "PRAGMA integrity_check;" 2>&1 || true)"
  else
    DB_STATUS="skipped-sqlite3-missing"
  fi
fi

UPLOAD_FILES=0
if [ -d "${LATEST}/uploads" ]; then
  UPLOAD_FILES="$(find "${LATEST}/uploads" -type f | wc -l | awk '{print $1}')"
fi

OK="false"
if [ "$AGE_OK" = "1" ] && { [ "$CHECKSUM_STATUS" = "ok" ] || [ "$CHECKSUM_STATUS" = "skipped-sha256sum-missing" ]; } && { [ "$DB_STATUS" = "ok" ] || [ "$DB_STATUS" = "skipped-sqlite3-missing" ]; }; then
  OK="true"
fi

cat <<JSON
{
  "ok": ${OK},
  "backupRoot": "$(json_escape "$BACKUP_ROOT")",
  "count": ${COUNT},
  "latest": "$(json_escape "$LATEST")",
  "ageHours": ${AGE_HOURS},
  "maxAgeHours": ${MAX_AGE_HOURS},
  "checksumStatus": "$(json_escape "$CHECKSUM_STATUS")",
  "databaseIntegrity": "$(json_escape "$DB_STATUS")",
  "uploadFiles": ${UPLOAD_FILES}
}
JSON

if [ "$OK" != "true" ]; then
  exit 4
fi
