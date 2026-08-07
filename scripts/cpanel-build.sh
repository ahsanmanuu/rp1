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
for npath in "/home/${USER_NAME}/nodevenv/latexify"/*/bin; do
  if [ -d "$npath" ]; then
    export PATH="${npath}:${PATH}"
    echo "[cpanel-build] Found cPanel Node environment: ${npath}"
    break
  fi
done

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
export UV_THREADPOOL_SIZE=1
export NEXT_CPU_COUNT=1
export NEXT_PRIVATE_WORKER_THREADS=0
export NEXT_DISABLE_TURBOPACK=1
export NEXT_DISABLE_SOURCEMAPS=1
export NODE_ENV=production

# ── Detect the container's real memory ceiling so the V8 heap never fights
#    the OS OOM-killer. cPanel shared hosting reports this via cgroup.
CGROUP_BYTES=0
if [ -r /sys/fs/cgroup/memory.max ]; then
  CGROUP_BYTES=$(cat /sys/fs/cgroup/memory.max 2>/dev/null | tr -d '[:space:]')
elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  CGROUP_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null | tr -d '[:space:]')
fi
SYSTEM_MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
CGROUP_MEM_MB=0
if [ -n "$CGROUP_BYTES" ] && [ "$CGROUP_BYTES" != "max" ] && [ "$CGROUP_BYTES" -gt 0 ] && [ "$CGROUP_BYTES" -lt 9999999999 ]; then
  CGROUP_MEM_MB=$((CGROUP_BYTES / 1024 / 1024))
fi
if [ -n "$CGROUP_MEM_MB" ] && [ "$CGROUP_MEM_MB" -gt 0 ] && [ -n "$SYSTEM_MEM_MB" ] && [ "$SYSTEM_MEM_MB" -gt 0 ]; then
  if [ "$CGROUP_MEM_MB" -lt "$SYSTEM_MEM_MB" ]; then TOTAL_MEM_MB=$CGROUP_MEM_MB; else TOTAL_MEM_MB=$SYSTEM_MEM_MB; fi
else
  TOTAL_MEM_MB=$CGROUP_MEM_MB
  [ -z "$TOTAL_MEM_MB" ] || [ "$TOTAL_MEM_MB" -le 0 ] && TOTAL_MEM_MB=$SYSTEM_MEM_MB
fi

# Heap cap = total - 128MB (Node/webpack native + OS overhead), clamped safe
HEAP=384
if [ -n "$TOTAL_MEM_MB" ] && [ "$TOTAL_MEM_MB" -gt 256 ]; then
  HEAP=$((TOTAL_MEM_MB - 128))
fi
if [ -z "$HEAP" ] || [ "$HEAP" -lt 256 ]; then HEAP=256; fi
if [ "$HEAP" -gt 512 ]; then HEAP=512; fi
echo "  [cpanel-build] Container memory limit: ${TOTAL_MEM_MB:-unknown}MB → starting V8 heap cap: ${HEAP}MB"
echo "  [cpanel-build] If the build is OOM-killed we lower the cap and retry automatically."
echo "  [cpanel-build] Diagnostics: $(free -m 2>/dev/null | awk '/^Mem:/{print $2"MB total, "$7"MB available"}') | ulimit -v: $(ulimit -v 2>/dev/null)"

BUILD_EXIT=1
ATTEMPT=1
while [ "$ATTEMPT" -le 3 ] && [ "$BUILD_EXIT" -ne 0 ]; do
  echo "  ── BuildRunner attempt ${ATTEMPT}/3 (max-old-space-size=${HEAP}MB) ──"
  NODE_OPTIONS="--max-old-space-size=${HEAP}" node node_modules/next/dist/bin/next build --webpack
  BUILD_EXIT=$?
  if [ "$BUILD_EXIT" -ne 0 ]; then
    if [ "$BUILD_EXIT" -eq 137 ]; then
      # SIGKILL from the OS OOM-killer → total process memory exceeded the pool
      echo "  [cpanel-build] Build was OOM-killed (137) — lowering the heap cap and retrying"
      HEAP=$((HEAP - 80))
      [ "$HEAP" -lt 160 ] && HEAP=160
    else
      # V8 'heap out of memory' (exit 134) or other failure → give it headroom
      echo "  [cpanel-build] Build exited ${BUILD_EXIT} (V8 'out of memory'?) — raising the heap cap and retrying"
      HEAP=$((HEAP + 64))
      [ "$HEAP" -gt 512 ] && HEAP=512
    fi
  fi
  ATTEMPT=$((ATTEMPT + 1))
done
echo "  Build finished at: $(date)"

# ── Fallback: Turbopack (native Rust compiler) ──
# Webpack couldn't fit in the tiny V8 heap? Turbopack keeps its compilation
# memory OUTSIDE the V8 heap (Rust), so it is not limited by --max-old-space-size
# and typically completes where webpack OOMs. Final safety net for cPanel.
if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "[cpanel-build] Webpack build failed after $((ATTEMPT-1)) attempt(s) — falling back to Turbopack build..."
  echo "  Turbopack compiles in native Rust, so its memory is NOT bounded by the V8 heap cap."
  unset NEXT_DISABLE_TURBOPACK
  NODE_OPTIONS="--max-old-space-size=${HEAP}" node node_modules/next/dist/bin/next build
  BUILD_EXIT=$?
  echo "  Turbopack build finished at: $(date +%H:%M:%S) (exit $BUILD_EXIT)"
fi

if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "[ERROR] Build failed with exit code $BUILD_EXIT after $((ATTEMPT-1)) attempt(s)."
  echo "[FIX]   The cPanel memory pool is too small for a full Next.js 16 webpack build."
  echo "[FIX]   Raise the plan/LVE memory limit (WHM → Limits → tweak) and re-run, or"
  echo "[FIX]   build locally/on CI and upload the .next/standalone output instead."
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
if [ -f .htaccess ]; then
  cp .htaccess "${PUBLIC_HTML}/.htaccess" 2>/dev/null || true
  # Ensure CloudLinux Passenger block has correct dynamic username
  if ! grep -q "CLOUDLINUX PASSED AGENT CONFIGURATION" "${PUBLIC_HTML}/.htaccess"; then
    sed -i "1i# DO NOT REMOVE. CLOUDLINUX PASSED AGENT CONFIGURATION BEGIN\nPassengerAppRoot \"/home/${USER_NAME}/latexify\"\nPassengerBaseURI \"/\"\nPassengerNodejs \"/home/${USER_NAME}/nodevenv/latexify/22/bin/node\"\nPassengerAppType node\nPassengerStartupFile app.js\n# DO NOT REMOVE. CLOUDLINUX PASSED AGENT CONFIGURATION END\n" "${PUBLIC_HTML}/.htaccess"
  fi
fi
rm -f "${PUBLIC_HTML}/index.html" 2>/dev/null || true

# Restart app
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "============================================"
echo "[cpanel-build] BUILD COMPLETE!"
echo "Now: cPanel > Setup Node.js App > Restart"
echo "============================================"
