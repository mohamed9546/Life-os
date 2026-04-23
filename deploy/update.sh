#!/usr/bin/env bash
# ============================================================
# Life OS — pull latest, rebuild image, restart service.
# Usage on VM:   sudo bash /opt/life-os/app/deploy/update.sh
# Or from cron:  0 4 * * * /opt/life-os/app/deploy/update.sh >> /var/log/life-os-update.log 2>&1
# ============================================================
set -euo pipefail

APP_DIR="/opt/life-os/app"
IMAGE_TAG="life-os:latest"

cd "$APP_DIR"

BEFORE=$(git rev-parse HEAD)
git fetch --quiet origin main
AFTER=$(git rev-parse origin/main)

if [[ "$BEFORE" == "$AFTER" ]]; then
  echo "[update] Already on $BEFORE — nothing to do."
  exit 0
fi

echo "[update] $BEFORE -> $AFTER"
git pull --ff-only origin main

docker build -t "$IMAGE_TAG" .
systemctl restart life-os

echo "[update] Rebuilt and restarted. Check: journalctl -u life-os -n 30"
