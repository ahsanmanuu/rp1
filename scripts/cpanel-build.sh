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

# Add local node_modules/.bin to PATH (replaces npx)
export PATH="${APP_DIR}/node_modules/.bin:${PATH}"

echo "============================================"
echo "[cpanel-build] Node: $(node -v 2>&1)"
echo "[cpanel-build] npm:  $(npm -v 2>&1)"
echo "============================================"

cd "$APP_DIR" || exit 1

mkdir -p tmp
touch tmp/building.lock
trap 'rm -f tmp/building.lock' EXIT

# Step 1: Check node_modules and essential build tools
echo ""
if [ ! -d "node_modules/@tailwindcss/postcss" ]; then
  echo "[Step 1/5] Installing missing build dependencies (@tailwindcss/postcss)..."
  npm install @tailwindcss/postcss tailwindcss --no-audit --no-fund
else
  echo "[Step 1/5] node_modules and Tailwind PostCSS verified — SKIPPING full npm install"
fi

# Step 2: Generate Prisma client
echo ""
echo "[Step 2/5] Generating Prisma client..."
node node_modules/prisma/build/index.js generate || echo "[WARNING] Prisma generate had issues"

# Step 3: Fix Prisma exports
echo ""
echo "[Step 3/5] Fixing Prisma exports..."
node scripts/fix-prisma-exports.js || echo "[WARNING] fix-prisma-exports had issues"

# Step 4: Build Next.js (low-memory mode for shared cPanel hosting)
echo ""
echo "[Step 4/5] Building Next.js (this may take 3-5 minutes)..."
echo "  Build started at: $(date)"
export CPANEL_BUILD=true
export DISABLE_ESLINT_PLUGIN=true
export NEXT_TELEMETRY_DISABLED=1
export UV_THREADPOOL_SIZE=4
NODE_OPTIONS="--max-old-space-size=1536" node node_modules/next/dist/bin/next build --webpack
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

# Sync .htaccess to public_html and remove static index.html so LiteSpeed routes to Node.js
cp .htaccess "${PUBLIC_HTML}/.htaccess" 2>/dev/null || true
rm -f "${PUBLIC_HTML}/index.html" 2>/dev/null || true

# Restart app
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "============================================"
echo "[cpanel-build] BUILD COMPLETE!"
echo "Now: cPanel > Setup Node.js App > Restart"
echo "============================================"
