#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
TARGET_DIR="${2:-/srv/gokottamaker-data}"

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Usage: sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM [/srv/gokottamaker-data]"
  exit 1
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

echo "Restore completed from: $BACKUP_DIR"
