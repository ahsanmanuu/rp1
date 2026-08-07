#!/bin/bash
# =============================================================================
# cpanel-build.sh — One-time build script for Latexify on cPanel shared hosting
#
# Run this via cPanel Terminal ONCE after pulling code:
#   cd ~/latexify && bash scripts/cpanel-build.sh
# =============================================================================

set -e

USER_NAME=$(whoami)
APP_DIR="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

# ── Find Node.js from cPanel virtual environment ──
NODEVENV="/home/${USER_NAME}/nodevenv/latexify/22/bin"
if [ -d "$NODEVENV" ]; then
  export PATH="${NODEVENV}:${PATH}"
  echo "[cpanel-build] Using cPanel Node.js virtualenv: ${NODEVENV}"
else
  # Try to find any Node.js virtualenv
  FOUND_ENV=$(find /home/${USER_NAME}/nodevenv -name "node" -type f 2>/dev/null | head -1)
  if [ -n "$FOUND_ENV" ]; then
    export PATH="$(dirname $FOUND_ENV):${PATH}"
    echo "[cpanel-build] Using found Node.js: $(dirname $FOUND_ENV)"
  fi
fi

echo "============================================"
echo "[cpanel-build] Starting Latexify build"
echo "[cpanel-build] App directory: ${APP_DIR}"
echo "[cpanel-build] Node: $(which node) — $(node -v)"
echo "[cpanel-build] npm: $(which npm) — $(npm -v)"
echo "============================================"

cd "$APP_DIR"

# Step 1: Install dependencies
echo ""
echo "[Step 1/5] Installing dependencies..."
npm install --production=false --no-audit --no-fund 2>&1 || {
  echo "[WARNING] npm install had issues, continuing..."
}

# Step 2: Generate Prisma client
echo ""
echo "[Step 2/5] Generating Prisma client..."
npx prisma generate 2>&1 || {
  echo "[WARNING] Prisma generate had issues, continuing..."
}

# Step 3: Fix Prisma exports (project-specific fix)
echo ""
echo "[Step 3/5] Fixing Prisma exports..."
node scripts/fix-prisma-exports.js 2>&1 || {
  echo "[WARNING] fix-prisma-exports had issues, continuing..."
}

# Step 4: Build Next.js with reduced memory (1GB instead of 4GB)
echo ""
echo "[Step 4/5] Building Next.js production bundle (this may take 3-5 minutes)..."
NODE_OPTIONS="--max-old-space-size=1024" npx next build --webpack 2>&1 || {
  echo ""
  echo "[ERROR] Next.js build failed!"
  echo "Try running with even lower memory:"
  echo "  NODE_OPTIONS='--max-old-space-size=512' npx next build --webpack"
  echo ""
  exit 1
}

# Step 5: Copy static assets into standalone directory
echo ""
echo "[Step 5/5] Copying static assets to standalone directory..."
STANDALONE_DIR="${APP_DIR}/.next/standalone"

if [ -d "${APP_DIR}/public" ]; then
  mkdir -p "${STANDALONE_DIR}/public"
  cp -R "${APP_DIR}/public/"* "${STANDALONE_DIR}/public/" 2>/dev/null || true
  echo "  ✓ Copied public/ assets"
fi

if [ -d "${APP_DIR}/.next/static" ]; then
  mkdir -p "${STANDALONE_DIR}/.next/static"
  cp -R "${APP_DIR}/.next/static/"* "${STANDALONE_DIR}/.next/static/" 2>/dev/null || true
  echo "  ✓ Copied .next/static/ assets"
fi

# Sync .htaccess and index.html to public_html
if [ -f "${APP_DIR}/.htaccess" ]; then
  cp "${APP_DIR}/.htaccess" "${PUBLIC_HTML}/.htaccess" 2>/dev/null || true
  echo "  ✓ Synced .htaccess to public_html"
fi
if [ -f "${APP_DIR}/index.html" ]; then
  cp "${APP_DIR}/index.html" "${PUBLIC_HTML}/index.html" 2>/dev/null || true
  echo "  ✓ Synced index.html to public_html"
fi

# Touch restart.txt to trigger Passenger restart
mkdir -p "${APP_DIR}/tmp"
touch "${APP_DIR}/tmp/restart.txt"

echo ""
echo "============================================"
echo "[cpanel-build] BUILD COMPLETE!"
echo ""
echo "Now go to cPanel > Setup Node.js App > Restart Application"
echo "Then visit https://latexify.in"
echo "============================================"
