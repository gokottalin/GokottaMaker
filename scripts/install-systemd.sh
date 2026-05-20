#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash scripts/install-systemd.sh"
  exit 1
fi

if [ -z "${GOKOTTA_ADMIN_PASSWORD:-}" ]; then
  echo "Set GOKOTTA_ADMIN_PASSWORD first."
  echo "Example: sudo GOKOTTA_ADMIN_PASSWORD='your-strong-password' bash scripts/install-systemd.sh"
  exit 1
fi

mkdir -p /srv/gokottamaker-data
cat > /etc/gokottamaker.env <<EOF
NODE_ENV=production
DATA_DIR=/srv/gokottamaker-data
ADMIN_USERNAME=Larkix
ADMIN_PASSWORD=${GOKOTTA_ADMIN_PASSWORD}
ADMIN_RESET_PASSWORD_ON_START=false
PORT=4173
HOST=127.0.0.1
SITE_URL=${GOKOTTA_SITE_URL:-https://www.larkix.com}
EOF
chmod 600 /etc/gokottamaker.env

cat > /etc/systemd/system/gokottamaker.service <<EOF
[Unit]
Description=LarkixMaker Website
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/LarkixMaker
EnvironmentFile=/etc/gokottamaker.env
ExecStart=/opt/node22/bin/node --experimental-sqlite /opt/LarkixMaker/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now gokottamaker
systemctl status gokottamaker --no-pager
