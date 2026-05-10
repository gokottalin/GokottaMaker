#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-/srv/gokottamaker-data}"
DB_PATH="${DB_PATH:-$DATA_DIR/database/gokottamaker.sqlite}"

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

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found: $DB_PATH" >&2
  exit 1
fi

NODE_BIN="$(resolve_node)"
"$NODE_BIN" --experimental-sqlite "$SCRIPT_DIR/check-carousel-db.js" --db "$DB_PATH"
