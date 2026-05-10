#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${1:-/srv/gokottamaker-backups}"
OFFSITE_BACKUP_TARGET="${2:-${OFFSITE_BACKUP_TARGET:-}}"
OFFSITE_BACKUP_MODE="${OFFSITE_BACKUP_MODE:-rsync}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if [ -z "$OFFSITE_BACKUP_TARGET" ]; then
  echo "Usage: OFFSITE_BACKUP_TARGET=user@host:/path bash scripts/sync-backups-offsite.sh [/srv/gokottamaker-backups]"
  echo "Modes: OFFSITE_BACKUP_MODE=rsync or OFFSITE_BACKUP_MODE=rclone"
  exit 1
fi

if [ ! -d "$BACKUP_ROOT" ]; then
  echo "ERROR: Backup root does not exist: $BACKUP_ROOT" >&2
  exit 2
fi

case "$OFFSITE_BACKUP_MODE" in
  rsync)
    if ! command_exists rsync; then
      echo "ERROR: rsync is not installed." >&2
      exit 3
    fi
    rsync -a "$BACKUP_ROOT/" "$OFFSITE_BACKUP_TARGET/"
    ;;
  rclone)
    if ! command_exists rclone; then
      echo "ERROR: rclone is not installed." >&2
      exit 4
    fi
    rclone copy "$BACKUP_ROOT" "$OFFSITE_BACKUP_TARGET"
    ;;
  *)
    echo "ERROR: Unsupported OFFSITE_BACKUP_MODE: $OFFSITE_BACKUP_MODE" >&2
    exit 5
    ;;
esac

echo "Offsite backup sync completed: $OFFSITE_BACKUP_MODE -> $OFFSITE_BACKUP_TARGET"
