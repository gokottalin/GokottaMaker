#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-/srv/gokottamaker-data}"
BACKUP_ROOT="${2:-/srv/gokottamaker-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H-%M)"
TARGET="${BACKUP_ROOT}/${STAMP}"

mkdir -p "$TARGET"

if [ -d "${SOURCE_DIR}/database" ]; then
  cp -a "${SOURCE_DIR}/database" "$TARGET/"
fi

if [ -d "${SOURCE_DIR}/uploads" ]; then
  cp -a "${SOURCE_DIR}/uploads" "$TARGET/"
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
echo "Backup created: $TARGET"
