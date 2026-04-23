#!/usr/bin/env bash
# ============================================================
# Life OS — VM bootstrap (Debian 12)
# Run this ONCE on a fresh Compute Engine VM after SSH-ing in:
#   curl -fsSL https://raw.githubusercontent.com/mohamed9546/Life-os/main/deploy/setup-vm.sh | bash
# OR clone the repo and run: bash deploy/setup-vm.sh
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/mohamed9546/Life-os.git"
APP_DIR="/opt/life-os/app"
DATA_DIR="/opt/life-os/data"
ENV_FILE="/opt/life-os/env"
IMAGE_TAG="life-os:latest"
NEXTJS_UID=1001
NEXTJS_GID=1001

log()  { echo -e "\033[1;34m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn ]\033[0m $*"; }

# ---- 1. Safety: 2 GB swap so Next.js build doesn't OOM on e2-medium ----
if [[ ! -f /swapfile ]]; then
  log "Creating 2 GB swap file (one-off build safety)…"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ---- 2. Docker ----
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl gnupg git
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  sudo usermod -aG docker "$USER"
fi

# ---- 3. Directories + ownership for bind mount ----
sudo mkdir -p "$APP_DIR" "$DATA_DIR"
sudo chown -R "$NEXTJS_UID:$NEXTJS_GID" "$DATA_DIR"

# ---- 4. Clone or update the repo ----
if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Cloning $REPO_URL into $APP_DIR…"
  sudo git clone "$REPO_URL" "$APP_DIR"
else
  log "Repo already present — pulling latest…"
  sudo git -C "$APP_DIR" pull --ff-only
fi

# ---- 5. Env file (don't overwrite if it exists) ----
if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating env template at $ENV_FILE — EDIT THIS before starting the service"
  sudo cp "$APP_DIR/deploy/env.example" "$ENV_FILE"
  sudo chmod 600 "$ENV_FILE"
  warn "Stop here and run:  sudo nano $ENV_FILE"
  warn "Then re-run this script, OR start manually with:  sudo systemctl start life-os"
fi

# ---- 6. Build the image ----
log "Building Docker image (first build ~8-10 min on e2-medium)…"
sudo docker build -t "$IMAGE_TAG" "$APP_DIR"

# ---- 7. Install systemd unit ----
log "Installing life-os.service…"
sudo cp "$APP_DIR/deploy/life-os.service" /etc/systemd/system/life-os.service
sudo systemctl daemon-reload
sudo systemctl enable life-os

# ---- 8. Start if env file is filled in ----
if sudo grep -q "REPLACE_ME" "$ENV_FILE"; then
  warn "Env file still has REPLACE_ME placeholders — NOT starting service."
  warn "Edit:  sudo nano $ENV_FILE"
  warn "Start: sudo systemctl start life-os"
else
  log "Starting life-os…"
  sudo systemctl restart life-os
  log "Tail logs:  sudo journalctl -u life-os -f"
fi

log "Done. App (once started) listens on 127.0.0.1:8080 — front with Caddy or Cloudflare Tunnel."
