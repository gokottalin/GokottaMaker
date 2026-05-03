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
cat > /etc/systemd/system/gokottamaker.service <<EOF
[Unit]
Description=GokottaMaker Website
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/GokottaMaker
Environment=NODE_ENV=production
Environment=DATA_DIR=/srv/gokottamaker-data
Environment=ADMIN_USERNAME=Gokotta
Environment=ADMIN_PASSWORD=${GOKOTTA_ADMIN_PASSWORD}
Environment=PORT=4173
ExecStart=/opt/node22/bin/node --experimental-sqlite /opt/GokottaMaker/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now gokottamaker
systemctl status gokottamaker --no-pager
