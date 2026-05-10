#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-/srv/gokottamaker-data}"
DB_PATH="${DB_PATH:-$DATA_DIR/database/gokottamaker.sqlite}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/gokottamaker-backups}"

resolve_node() {
  if [[ -n "${NODE_BIN:-}" ]]; then
    echo "$NODE_BIN"
    return
  fi

  if [[ -x "/opt/node22/bin/node" ]]; then
    echo "/opt/node22/bin/node"
    return
  fi

  command -v node
}

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--dry-run|--apply]" >&2
  exit 64
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found: $DB_PATH" >&2
  exit 1
fi

if [[ "$MODE" != "--apply" ]]; then
  echo "Dry run only. Use --apply to update SQLite after reviewing the planned changes."
fi

NODE_BIN="$(resolve_node)"

if [[ "$MODE" == "--apply" ]]; then
  "$NODE_BIN" --experimental-sqlite "$SCRIPT_DIR/cleanup-carousel-db.js" --db "$DB_PATH" --apply
else
  "$NODE_BIN" --experimental-sqlite "$SCRIPT_DIR/cleanup-carousel-db.js" --db "$DB_PATH"
fi

echo "After cleanup check:"
"$SCRIPT_DIR/check-carousel-cloud.sh"
