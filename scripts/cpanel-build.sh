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

# ── Fast path: prebuilt standalone artifact (off-box / GitHub Actions build) ──
# If a standalone tar exists in the app dir, install it directly. The box's
# memory pool is too small for ANY compiler (webpack AND Turbopack proved it),
# so building here is only a last resort. Just extract+restart — memory-light.
if [ -f "${APP_DIR}/latexify-next.tar.gz" ]; then
  echo "[cpanel-build] Found prebuilt artifact — installing it (no build needed)."
  bash scripts/cpanel-deploy-artifact.sh "${APP_DIR}/latexify-next.tar.gz"
  exit $?;
fi

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

# Step 2: Fix Prisma exports & shim CLI for in-process execution
echo ""
echo "[Step 2/5] Fixing Prisma exports & shimming CLI..."
node scripts/fix-prisma-exports.js || echo "[WARNING] fix-prisma-exports had issues"

# Step 3: Generate Prisma client (in-process, zero child forks)
echo ""
echo "[Step 3/5] Generating Prisma client..."
# EAGAIN fix: Prisma 7.x spawns a telemetry checkpoint child unconditionally unless disabled.
# On cPanel CloudLinux (ulimit-u restricted), spawn() fails with EAGAIN -11.
# These env-vars suppress ALL child-process spawns in the Prisma CLI:
export CHECKPOINT_DISABLE=1
export CHECKPOINT_DISABLE=true
export PRISMA_TELEMETRY_DISABLE=1
export PRISMA_HIDE_UPDATE_MESSAGE=true
export PRISMA_GENERATE_FORCE_INLINE=1
node node_modules/prisma/build/index.js generate || echo "[WARNING] Prisma generate had issues"

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
#
# IMPORTANT: On cPanel CloudLinux the LVE (Lightweight Virtual Environment)
# cap is NOT reflected in /sys/fs/cgroup or `free`. Those show the HOST
# machine totals (e.g. 95735 MB). The real per-account LVE memory limit is
# enforced by the kernel at a much lower value (often 512-1024 MB) and is
# invisible to the process. We therefore:
#   1. Try cgroup v2 / v1 (may be "max" = unlimited on some setups)
#   2. Fall back to `free` available (not total — available is closer to LVE)
#   3. Clamp aggressively to 512 MB max because this cPanel account has
#      proven it cannot build Next.js 16 in-process at any heap size.
CGROUP_BYTES=0
if [ -r /sys/fs/cgroup/memory.max ]; then
  CGROUP_BYTES=$(cat /sys/fs/cgroup/memory.max 2>/dev/null | tr -d '[:space:]')
elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  CGROUP_BYTES=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null | tr -d '[:space:]')
fi

# Use available memory (column 7) not total — much closer to real LVE headroom
SYSTEM_AVAIL_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')
SYSTEM_MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')

CGROUP_MEM_MB=0
if [ -n "$CGROUP_BYTES" ] && [ "$CGROUP_BYTES" != "max" ] && \
   echo "$CGROUP_BYTES" | grep -qE '^[0-9]+$' && \
   [ "$CGROUP_BYTES" -gt 0 ] && [ "$CGROUP_BYTES" -lt 549755813888 ]; then
  # cgroup reports a real per-container limit (< 512 GB = real LVE)
  CGROUP_MEM_MB=$((CGROUP_BYTES / 1024 / 1024))
fi

if [ "$CGROUP_MEM_MB" -gt 0 ] && [ "$CGROUP_MEM_MB" -lt 4096 ]; then
  # Real LVE ceiling detected via cgroup
  TOTAL_MEM_MB=$CGROUP_MEM_MB
elif [ -n "$SYSTEM_AVAIL_MB" ] && [ "$SYSTEM_AVAIL_MB" -gt 0 ] && [ "$SYSTEM_AVAIL_MB" -lt 4096 ]; then
  # cgroup not readable / unlimited — trust available memory if it looks LVE-sized
  TOTAL_MEM_MB=$SYSTEM_AVAIL_MB
else
  # Both readings look like host-machine totals; assume a conservative LVE cap
  TOTAL_MEM_MB=512
fi

# Hard cap at 512 MB: empirical testing proved this cPanel LVE cannot sustain
# a full Next.js 16 webpack/Turbopack build regardless of heap setting.
# V8 heap is set to 80% of ceiling to leave room for native allocations.
MAX_BUILD_MEM=512
if [ "$TOTAL_MEM_MB" -gt "$MAX_BUILD_MEM" ]; then TOTAL_MEM_MB=$MAX_BUILD_MEM; fi
HEAP=$((TOTAL_MEM_MB * 80 / 100))
if [ "$HEAP" -lt 256 ]; then HEAP=256; fi
if [ "$HEAP" -gt 400 ]; then HEAP=400; fi
echo "  [cpanel-build] Container memory limit: ${TOTAL_MEM_MB:-unknown}MB → starting V8 heap cap: ${HEAP}MB"
echo "  [cpanel-build] Diagnostics: $(free -m 2>/dev/null | awk '/^Mem:/{print $2"MB total, "$7"MB available"}') | ulimit -v: $(ulimit -v 2>/dev/null) | ulimit -u: $(ulimit -u 2>/dev/null)"

# ── cPanel symlinks node_modules into ~/nodevenv (OUTSIDE the app root).
#    Webpack tolerates crossing symlinks, but Turbopack refuses with
#    "Symlink [project]/node_modules is invalid, it points out of the filesystem
#    root". Materialize a REAL copy once so Turbopack's resolver accepts it.
echo "  [cpanel-build] node_modules symlink check..."
if [ -L node_modules ]; then
  echo "  [cpanel-build] node_modules is a symlink → $(readlink node_modules)"
  echo "  [cpanel-build] Replacing it with a real copy (one-time; may take a few minutes for a large tree)..."
  cp -rL node_modules "node_modules.real.$$" && rm -f node_modules && mv "node_modules.real.$$" node_modules
  if [ -d node_modules/next ]; then
    echo "  [cpanel-build] ✓ node_modules dereferenced"
  else
    echo "  [cpanel-build] WARNING: dereference may have failed; continuing anyway"
  fi
else
  echo "  [cpanel-build] node_modules is a real directory ✓"
fi

# ── Build strategy for memory-constrained cPanel LVE environments ──
#
# HISTORY: Both Turbopack and Webpack builds have been OOM-killed (exit 137)
# at heap caps from 400-768 MB. The LVE is hard-capped below what Next.js 16
# needs for compilation of this app (~900 MB peak). Building on this host is
# a last-resort only; the recommended path is GitHub Actions → artifact upload.
#
# We attempt ONE Turbopack in-process build (Rust allocates outside V8 heap
# so it's more memory-efficient than webpack). NEXT_TURBOPACK_USE_WORKER=0
# prevents a second Node process spawn (EAGAIN on this host).
BUILD_EXIT=1

echo "  ── BuildRunner attempt 1/2: Turbopack in-process (heap cap ${HEAP}MB) ──"
echo "  [cpanel-build] NOTE: If this is OOM-killed (exit 137), the LVE memory"
echo "  [cpanel-build] limit is too low for this app. Use local/CI build instead."
unset NEXT_DISABLE_TURBOPACK
export NEXT_TURBOPACK_USE_WORKER=0
NODE_OPTIONS="--max-old-space-size=${HEAP} --expose-gc --max-semi-space-size=16" node node_modules/next/dist/bin/next build
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 137 ]; then
  # OOM-killed by the kernel — no point retrying with same or lower heap
  echo ""
  echo "  [cpanel-build] Build was OOM-killed (exit 137). The CloudLinux LVE"
  echo "  [cpanel-build] memory cap is lower than the ~900 MB this build needs."
  echo "  [cpanel-build] Skipping webpack fallback (it would also OOM)."
elif [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "  [cpanel-build] Turbopack failed (exit $BUILD_EXIT) — trying webpack fallback."
  echo "  ── BuildRunner attempt 2/2: Webpack (heap cap ${HEAP}MB) ──"
  export NEXT_DISABLE_TURBOPACK=1
  NODE_OPTIONS="--max-old-space-size=${HEAP} --expose-gc --max-semi-space-size=16" node node_modules/next/dist/bin/next build --webpack
  BUILD_EXIT=$?
fi
echo "  Build finished at: $(date)"

if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "  [ERROR] Build failed with exit code $BUILD_EXIT."
  echo ""
  echo "  ════════════════════════════════════════════════════════════════"
  echo "  RECOMMENDED FIX: Build off-box and upload a prebuilt artifact"
  echo "  ════════════════════════════════════════════════════════════════"
  echo ""
  echo "  Option A — Build locally on your Windows machine (easiest):"
  echo "    1. Open PowerShell in the project root"
  echo "    2. Run:  powershell -File scripts/local-build-for-cpanel.ps1"
  echo "         or  pwsh scripts/local-build-for-cpanel.ps1  (if PowerShell Core 7 is installed)"
  echo "    3. Upload the generated  latexify-next.tar.gz  via cPanel File Manager"
  echo "       to  /home/latexify/latexify/latexify-next.tar.gz"
  echo "    4. In cPanel Terminal run:  bash scripts/cpanel-build.sh"
  echo "       (the script detects the .tar.gz and installs it without building)"
  echo ""
  echo "  Option B — GitHub Actions CI (automatic on git push to main):"
  echo "    The workflow .github/workflows/build-deploy.yml builds with 8 GB"
  echo "    RAM on ubuntu-latest. Download the artifact from the Actions tab"
  echo "    and upload it to the path above, then run step 4."
  echo ""
  echo "  Option C — Raise cPanel LVE limit:"
  echo "    WHM → Modify Account → Resource Limits → set PMEM ≥ 1536 MB"
  echo ""
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
