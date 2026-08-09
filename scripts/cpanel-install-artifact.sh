#!/bin/bash
# =============================================================================
# cpanel-install-artifact.sh — Install a pre-built standalone artifact on cPanel
#
# Usage: cd ~/latexify && bash scripts/cpanel-install-artifact.sh [path/to/latexify-next.tar.gz]
# =============================================================================

USER_NAME=$(whoami)
APP_DIR="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

ARTIFACT="${1:-${APP_DIR}/latexify-next.tar.gz}"

if [ ! -f "$ARTIFACT" ]; then
  echo "[ERROR] Artifact not found: $ARTIFACT"
  echo "        Upload latexify-next.tar.gz to ~/latexify/ via cPanel File Manager first."
  exit 1
fi

echo "============================================"
echo "[cpanel-install] Installing pre-built artifact"
echo "[cpanel-install] Artifact: $ARTIFACT ($(du -h "$ARTIFACT" | cut -f1))"
echo "============================================"

cd "$APP_DIR" || exit 1

# Back up existing .next directory
if [ -d ".next/standalone" ]; then
  echo "[Step 1/4] Backing up existing standalone..."
  rm -rf .next/standalone.bak 2>/dev/null
  mv .next/standalone .next/standalone.bak 2>/dev/null || true
fi

# Extract artifact into .next/standalone
echo "[Step 2/4] Extracting artifact..."
mkdir -p .next/standalone
tar -xzf "$ARTIFACT" -C .next/standalone
echo "  ✓ Extracted to .next/standalone/"

# Ensure static assets are in place
echo "[Step 3/4] Verifying static assets..."
if [ -d "public" ] && [ -d ".next/standalone" ]; then
  mkdir -p .next/standalone/public
  cp -R public/* .next/standalone/public/ 2>/dev/null || true
  echo "  ✓ public/ assets"
fi

if [ -d ".next/static" ] && [ -d ".next/standalone" ]; then
  mkdir -p .next/standalone/.next/static
  cp -R .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
  echo "  ✓ .next/static/ assets"
fi

# Sync .htaccess to public_html
echo "[Step 4/4] Syncing .htaccess..."
if [ -f .htaccess ]; then
  cp -f .htaccess "${PUBLIC_HTML}/.htaccess" 2>/dev/null || true
fi
rm -f "${PUBLIC_HTML}/index.html" 2>/dev/null || true

# Restart Passenger
mkdir -p tmp
touch tmp/restart.txt

# Clean up backup
rm -rf .next/standalone.bak 2>/dev/null || true

echo ""
echo "============================================"
echo "[cpanel-install] INSTALL COMPLETE!"
echo "Now: cPanel > Setup Node.js App > Restart"
echo "============================================"
