#!/bin/bash
set -e

USER_NAME=$(whoami)
DEPLOYPATH="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

echo "[cPanel Deploy] Target Deployment Path: ${DEPLOYPATH}"
echo "[cPanel Deploy] Target Public HTML: ${PUBLIC_HTML}"

mkdir -p "$DEPLOYPATH"
mkdir -p "$DEPLOYPATH/tmp"

# Fast file sync excluding git object history and local env
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env.local' . "$DEPLOYPATH/"
else
  /bin/cp -R . "$DEPLOYPATH/"
fi

# Sync .htaccess and index.html to public_html for LiteSpeed / Apache
if [ -f .htaccess ]; then
  /bin/cp .htaccess "$PUBLIC_HTML/.htaccess" 2>/dev/null || true
fi

if [ -f index.html ]; then
  /bin/cp index.html "$PUBLIC_HTML/index.html" 2>/dev/null || true
fi

# Touch restart.txt to force Passenger / LiteSpeed app restart
touch "$DEPLOYPATH/tmp/restart.txt"

echo "[cPanel Deploy] Deployment completed successfully!"
