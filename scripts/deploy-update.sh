#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/GokottaMaker}"
SERVICE_NAME="${SERVICE_NAME:-gokottamaker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4173/healthz}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-scripts/backup-linux.sh}"

cd "$APP_DIR"

echo "== GokottaMaker deploy update =="
echo "App dir: $APP_DIR"
echo "Service: $SERVICE_NAME"

echo
echo "== Current status =="
git status -sb
echo "Local:  $(git rev-parse --short HEAD)"

echo
echo "== Fetch origin =="
git -c http.version=HTTP/1.1 fetch origin
echo "Remote: $(git rev-parse --short origin/main)"

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "ERROR: Working tree is not clean. Commit, stash, or backup local changes before deploy."
  git status --short
  exit 2
fi

echo
echo "== Backup data =="
if [ -x "$BACKUP_SCRIPT" ]; then
  sudo "$BACKUP_SCRIPT"
else
  sudo bash "$BACKUP_SCRIPT"
fi

echo
echo "== Pull latest =="
git -c http.version=HTTP/1.1 pull --ff-only origin main
echo "Now:    $(git rev-parse --short HEAD)"

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
echo "Deploy update completed."
