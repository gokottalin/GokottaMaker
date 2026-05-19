#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/LarkixMaker}"
SERVICE_NAME="${SERVICE_NAME:-larkixmaker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4173/healthz}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-scripts/backup-linux.sh}"
STATE_DIR="${STATE_DIR:-.deploy}"
TARGET_REF="${1:-}"

cd "$APP_DIR"

STATE_FILE="${STATE_DIR}/last-deploy.env"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

short_ref() {
  git rev-parse --short "$1" 2>/dev/null || echo "$1"
}

version_from_file() {
  node -e '
const fs = require("node:fs");
const text = fs.readFileSync("server.js", "utf8");
const version = text.match(/const\s+siteVersion\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
const build = text.match(/const\s+siteBuild\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
console.log(`${version}+${build}`);
' 2>/dev/null || echo "unknown"
}

if [ -z "$TARGET_REF" ] && [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  TARGET_REF="${PRE_DEPLOY_COMMIT:-}"
fi

if [ -z "$TARGET_REF" ]; then
  TARGET_REF="HEAD@{1}"
fi

echo "== LarkixMaker rollback =="
echo "App dir: $APP_DIR"
echo "Service: $SERVICE_NAME"
echo "Current commit: $(git rev-parse --short HEAD)"
echo "Target ref: $TARGET_REF ($(short_ref "$TARGET_REF"))"
echo "Current file version: $(version_from_file)"

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "ERROR: Working tree is not clean. Commit, stash, or inspect local changes before rollback."
  git status --short
  exit 2
fi

echo
echo "== Backup data before rollback =="
if [ -x "$BACKUP_SCRIPT" ]; then
  sudo "$BACKUP_SCRIPT"
else
  sudo bash "$BACKUP_SCRIPT"
fi

echo
echo "== Move code to rollback target =="
git reset --hard "$TARGET_REF"
echo "Rolled back to: $(git rev-parse --short HEAD)"
echo "Rollback file version: $(version_from_file)"

echo
echo "== Restart service =="
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo
echo "== Health check =="
sleep 2
curl -fsS "$HEALTH_URL"
echo
echo "Rollback completed."
