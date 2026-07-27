#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/GokottaMaker}"
SERVICE_NAME="${SERVICE_NAME:-gokottamaker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4173/healthz}"
NODE_BIN="${NODE_BIN:-/opt/node22/bin/node}"
DATA_DIR="${DATA_DIR:-/srv/gokottamaker-data}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-scripts/backup-linux.sh}"
ROLLBACK_SCRIPT="${ROLLBACK_SCRIPT:-scripts/rollback.sh}"
CONTENT_SYNC_SCRIPT="${CONTENT_SYNC_SCRIPT:-scripts/content-sync-cloud.sh}"
CONTENT_SYNC_PACKAGE="${CONTENT_SYNC_PACKAGE:-}"
CONTENT_SYNC_CHECKSUM="${CONTENT_SYNC_CHECKSUM:-}"
CONTENT_SYNC_APPLY="${CONTENT_SYNC_APPLY:-false}"
CONTENT_SYNC_CONFIRM="${CONTENT_SYNC_CONFIRM:-}"
CONTENT_SYNC_MAX_BACKUP_AGE_HOURS="${CONTENT_SYNC_MAX_BACKUP_AGE_HOURS:-2}"
STATE_DIR="${STATE_DIR:-.deploy}"
STATE_FILE="${STATE_DIR}/last-deploy.env"
PRE_DEPLOY_COMMIT=""
POST_DEPLOY_COMMIT=""
LATEST_BACKUP_DIR=""

version_from_file() {
  "$NODE_BIN" -e '
const fs = require("node:fs");
const text = fs.readFileSync("server.js", "utf8");
const version = text.match(/const\s+siteVersion\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
const build = text.match(/const\s+siteBuild\s*=\s*["\x27]([^"\x27]+)["\x27]/)?.[1] || "unknown";
console.log(`${version}+${build}`);
' 2>/dev/null || echo "unknown"
}

health_commit() {
  printf '%s' "$1" | "$NODE_BIN" -e '
let body = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { body += chunk; });
process.stdin.on("end", () => {
  try {
    console.log(JSON.parse(body).gitCommit || "unknown");
  } catch {
    console.log("unknown");
  }
});
' 2>/dev/null || echo "unknown"
}

service_state() {
  systemctl is-active "$SERVICE_NAME" 2>/dev/null || true
}

health_snapshot() {
  curl -fsS "$HEALTH_URL" 2>/dev/null || echo "unavailable"
}

run_content_sync() {
  if [ -z "$CONTENT_SYNC_PACKAGE" ]; then
    echo "Content package sync skipped: CONTENT_SYNC_PACKAGE is not configured"
    return 0
  fi

  case "$CONTENT_SYNC_APPLY" in
    true|false) ;;
    *)
      echo "ERROR: CONTENT_SYNC_APPLY must be exactly true or false." >&2
      return 4
      ;;
  esac

  echo "Package:  $CONTENT_SYNC_PACKAGE"
  echo "Checksum: ${CONTENT_SYNC_CHECKSUM:-missing}"
  echo "Mode:     $([ "$CONTENT_SYNC_APPLY" = "true" ] && echo apply || echo dry-run)"
  APP_DIR="$APP_DIR" NODE_BIN="$NODE_BIN" DATA_DIR="$DATA_DIR" \
    bash "$CONTENT_SYNC_SCRIPT" \
      --dry-run \
      --package "$CONTENT_SYNC_PACKAGE" \
      --checksum "$CONTENT_SYNC_CHECKSUM" \
      --data-dir "$DATA_DIR"

  if [ "$CONTENT_SYNC_APPLY" != "true" ]; then
    echo "Content package validated only; no content data changed."
    return 0
  fi

  sudo env \
    APP_DIR="$APP_DIR" \
    NODE_BIN="$NODE_BIN" \
    DATA_DIR="$DATA_DIR" \
    CONTENT_SYNC_MAX_BACKUP_AGE_HOURS="$CONTENT_SYNC_MAX_BACKUP_AGE_HOURS" \
    bash "$CONTENT_SYNC_SCRIPT" \
      --apply \
      --confirm "$CONTENT_SYNC_CONFIRM" \
      --package "$CONTENT_SYNC_PACKAGE" \
      --checksum "$CONTENT_SYNC_CHECKSUM" \
      --backup-evidence "${LATEST_BACKUP_DIR}/manifest.txt" \
      --data-dir "$DATA_DIR"
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
echo "== Content package sync gate =="
run_content_sync

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
EXPECTED_HEALTH_COMMIT="$(git rev-parse --short HEAD)"
ACTUAL_HEALTH_COMMIT="$(health_commit "$POST_HEALTH")"
if [ "$ACTUAL_HEALTH_COMMIT" != "$EXPECTED_HEALTH_COMMIT" ]; then
  echo "ERROR: Health commit mismatch. Expected ${EXPECTED_HEALTH_COMMIT}, got ${ACTUAL_HEALTH_COMMIT}."
  exit 3
fi

cat >> "$STATE_FILE" <<EOF
POST_DEPLOY_COMMIT=${POST_DEPLOY_COMMIT}
POST_DEPLOY_VERSION=$(version_from_file)
CONTENT_SYNC_PACKAGE=${CONTENT_SYNC_PACKAGE}
CONTENT_SYNC_CHECKSUM=${CONTENT_SYNC_CHECKSUM}
CONTENT_SYNC_APPLY=${CONTENT_SYNC_APPLY}
DEPLOY_FINISHED_AT=$(date -Iseconds)
EOF

echo
echo "== Deploy comparison =="
echo "Commit:  $(git rev-parse --short "$PRE_DEPLOY_COMMIT") -> $(git rev-parse --short "$POST_DEPLOY_COMMIT")"
echo "Version: $(grep '^PRE_DEPLOY_VERSION=' "$STATE_FILE" | cut -d= -f2-) -> $(version_from_file)"
echo "Backup:  ${LATEST_BACKUP_DIR:-unknown}"
echo "Health:  ${POST_HEALTH}"
echo "Deploy update completed."
