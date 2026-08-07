#!/bin/bash
# =============================================================================
# cpanel-build.sh — Build script for Latexify on cPanel shared hosting
#
# Usage: cd ~/latexify && bash scripts/cpanel-build.sh
# =============================================================================

USER_NAME=$(whoami)
APP_DIR="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

# ── Find Node.js from cPanel virtual environment ──
NODEVENV="/home/${USER_NAME}/nodevenv/latexify/22/bin"
if [ -d "$NODEVENV" ]; then
  export PATH="${NODEVENV}:${PATH}"
fi

# Verify node/npm are available
echo "============================================"
echo "[cpanel-build] Node: $(node -v 2>&1)"
echo "[cpanel-build] npm:  $(npm -v 2>&1)"
echo "============================================"

cd "$APP_DIR" || exit 1

# Step 1: Only install if node_modules is missing
echo ""
if [ -d "node_modules/next" ]; then
  echo "[Step 1/5] node_modules already exists — SKIPPING npm install"
else
  echo "[Step 1/5] Installing dependencies..."
  npm install --production=false --no-audit --no-fund --prefer-offline
fi

# Step 2: Generate Prisma client
echo ""
echo "[Step 2/5] Generating Prisma client..."
npx prisma generate || echo "[WARNING] Prisma generate had issues"

# Step 3: Fix Prisma exports
echo ""
echo "[Step 3/5] Fixing Prisma exports..."
node scripts/fix-prisma-exports.js || echo "[WARNING] fix-prisma-exports had issues"

# Step 4: Build Next.js (1GB memory limit for shared hosting)
echo ""
echo "[Step 4/5] Building Next.js (this may take 3-5 minutes)..."
echo "  Build started at: $(date)"
NODE_OPTIONS="--max-old-space-size=1024" npx next build --webpack
BUILD_EXIT=$?
echo "  Build finished at: $(date)"

if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "[ERROR] Build failed with exit code $BUILD_EXIT"
  exit 1
fi

# Step 5: Copy static assets into standalone directory
echo ""
echo "[Step 5/5] Copying static assets..."
STANDALONE_DIR="${APP_DIR}/.next/standalone"

if [ -d "public" ] && [ -d "$STANDALONE_DIR" ]; then
  mkdir -p "${STANDALONE_DIR}/public"
  cp -R public/* "${STANDALONE_DIR}/public/" 2>/dev/null || true
  echo "  ✓ public/ assets"
fi

if [ -d ".next/static" ] && [ -d "$STANDALONE_DIR" ]; then
  mkdir -p "${STANDALONE_DIR}/.next/static"
  cp -R .next/static/* "${STANDALONE_DIR}/.next/static/" 2>/dev/null || true
  echo "  ✓ .next/static/ assets"
fi

# Sync to public_html
cp .htaccess "${PUBLIC_HTML}/.htaccess" 2>/dev/null || true
cp index.html "${PUBLIC_HTML}/index.html" 2>/dev/null || true

# Restart app
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "============================================"
echo "[cpanel-build] BUILD COMPLETE!"
echo "Now: cPanel > Setup Node.js App > Restart"
echo "============================================"
