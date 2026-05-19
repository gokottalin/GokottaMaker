#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/LarkixMaker}"
SERVICE_NAME="${SERVICE_NAME:-gokottamaker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4173/healthz}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-scripts/backup-linux.sh}"
ROLLBACK_SCRIPT="${ROLLBACK_SCRIPT:-scripts/rollback.sh}"
STATE_DIR="${STATE_DIR:-.deploy}"
STATE_FILE="${STATE_DIR}/last-deploy.env"
PRE_DEPLOY_COMMIT=""
POST_DEPLOY_COMMIT=""
LATEST_BACKUP_DIR=""

version_from_file() {
  node -e '
const fs = require("node:fs");
const text = fs.readFileSync("server.js", "utf8");
const version = text.match(/const\s+siteVersion\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
const build = text.match(/const\s+siteBuild\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
console.log(`${version}+${build}`);
' 2>/dev/null || echo "unknown"
}

service_state() {
  systemctl is-active "$SERVICE_NAME" 2>/dev/null || true
}

health_snapshot() {
  curl -fsS "$HEALTH_URL" 2>/dev/null || echo "unavailable"
}

failure_help() {
  local exit_code=$?
  echo
  echo "ERROR: Deploy update failed with exit code ${exit_code}."
  echo "Current commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "Pre-deploy commit: ${PRE_DEPLOY_COMMIT:-unknown}"
  echo "Latest backup: ${LATEST_BACKUP_DIR:-unknown}"
  echo
  echo "Suggested diagnostics:"
  echo "  sudo journalctl -u ${SERVICE_NAME} -n 120 --no-pager"
  echo "  sudo systemctl status ${SERVICE_NAME} --no-pager"
  echo "  curl -fsS ${HEALTH_URL}"
  echo
  echo "Suggested rollback:"
  echo "  cd ${APP_DIR}"
  echo "  bash ${ROLLBACK_SCRIPT} ${PRE_DEPLOY_COMMIT:-HEAD@{1}}"
  exit "$exit_code"
}

cd "$APP_DIR"
trap failure_help ERR
mkdir -p "$STATE_DIR"

echo "== LarkixMaker deploy update =="
echo "App dir: $APP_DIR"
echo "Service: $SERVICE_NAME"

echo
echo "== Pre-deploy status =="
git status -sb
PRE_DEPLOY_COMMIT="$(git rev-parse HEAD)"
echo "Local commit:  $(git rev-parse --short HEAD)"
echo "File version:  $(version_from_file)"
echo "Service state: $(service_state)"
echo "Health:        $(health_snapshot)"

echo
echo "== Fetch origin =="
git -c http.version=HTTP/1.1 fetch origin
echo "Remote commit: $(git rev-parse --short origin/main)"

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "ERROR: Working tree is not clean. Commit, stash, or backup local changes before deploy."
  git status --short
  exit 2
fi

echo
echo "== Backup data =="
BACKUP_OUTPUT=""
if [ -x "$BACKUP_SCRIPT" ]; then
  BACKUP_OUTPUT="$(sudo "$BACKUP_SCRIPT")"
else
  BACKUP_OUTPUT="$(sudo bash "$BACKUP_SCRIPT")"
fi
echo "$BACKUP_OUTPUT"
LATEST_BACKUP_DIR="$(printf '%s\n' "$BACKUP_OUTPUT" | awk -F': ' '/Backup created:/ {print $2}' | tail -n 1)"

cat > "$STATE_FILE" <<EOF
PRE_DEPLOY_COMMIT=${PRE_DEPLOY_COMMIT}
PRE_DEPLOY_VERSION=$(version_from_file)
PRE_DEPLOY_BACKUP=${LATEST_BACKUP_DIR}
DEPLOY_STARTED_AT=$(date -Iseconds)
EOF

echo
echo "== Fast-forward to fetched origin/main =="
git merge --ff-only origin/main
POST_DEPLOY_COMMIT="$(git rev-parse HEAD)"
echo "Now commit:   $(git rev-parse --short HEAD)"
echo "File version: $(version_from_file)"

echo
echo "== Restart service =="
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo
echo "== Health check =="
sleep 2
POST_HEALTH="$(curl -fsS "$HEALTH_URL")"
echo "$POST_HEALTH"
echo

cat >> "$STATE_FILE" <<EOF
POST_DEPLOY_COMMIT=${POST_DEPLOY_COMMIT}
POST_DEPLOY_VERSION=$(version_from_file)
DEPLOY_FINISHED_AT=$(date -Iseconds)
EOF

echo
echo "== Deploy comparison =="
echo "Commit:  $(git rev-parse --short "$PRE_DEPLOY_COMMIT") -> $(git rev-parse --short "$POST_DEPLOY_COMMIT")"
echo "Version: $(grep '^PRE_DEPLOY_VERSION=' "$STATE_FILE" | cut -d= -f2-) -> $(version_from_file)"
echo "Backup:  ${LATEST_BACKUP_DIR:-unknown}"
echo "Health:  ${POST_HEALTH}"
echo "Deploy update completed."
