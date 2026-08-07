#!/bin/bash
USER_NAME=$(whoami)
DEPLOYPATH="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

echo "[cPanel Deploy] Target Deployment Path: ${DEPLOYPATH}"
echo "[cPanel Deploy] Target Public HTML: ${PUBLIC_HTML}"

mkdir -p "$DEPLOYPATH"
mkdir -p "$DEPLOYPATH/tmp"

# Only sync files if running from outside the target deployment directory
CURRENT_REALPATH=$(pwd -P 2>/dev/null || pwd)
TARGET_REALPATH=$(cd "$DEPLOYPATH" 2>/dev/null && pwd -P || echo "$DEPLOYPATH")

if [ "$CURRENT_REALPATH" != "$TARGET_REALPATH" ]; then
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env.local' . "$DEPLOYPATH/"
  fi
fi

cd "$DEPLOYPATH" || exit 1

# If git repository exists, pull clean latest changes
if [ -d ".git" ]; then
  echo "[cPanel Deploy] Fetching and pulling latest git commits..."
  git fetch origin 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || git pull --rebase 2>/dev/null || git pull 2>/dev/null || true
fi

# Sync .htaccess to public_html for LiteSpeed / Apache
if [ -f .htaccess ]; then
  /bin/cp -f .htaccess "$PUBLIC_HTML/.htaccess" 2>/dev/null || true
fi

# Touch restart.txt to force Passenger / LiteSpeed app restart
touch "$DEPLOYPATH/tmp/restart.txt"

echo "[cPanel Deploy] Deployment sync completed successfully!"
