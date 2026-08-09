#!/bin/bash
# =============================================================================
# cpanel-deploy-artifact.sh — install a prebuilt .next/standalone artifact
#
# Usage: bash scripts/cpanel-deploy-artifact.sh /path/to/latexify-next.tar.gz
#
# The build happens on GitHub Actions (Linux, generous memory); this server
# does ONLY a lightweight extract + restart. Extremely low memory usage — a
# tiny tar is the only heavy step, which fits well inside the cPanel LVE pool.
# =============================================================================
set -euo pipefail

USER_NAME=$(whoami)
APP_DIR="/home/${USER_NAME}/latexify"
ARTIFACT="${1:-${APP_DIR}/latexify-next.tar.gz}"
BACKUP_DIR="${APP_DIR}/.next.bak"

if [ ! -f "$ARTIFACT" ]; then
  echo "[cpanel-deploy] ERROR: artifact not found at ${ARTIFACT}"
  exit 1
fi

if ! tar -tzf "$ARTIFACT" >/dev/null 2>&1; then
  echo "[cpanel-deploy] ERROR: Corrupted or truncated archive file detected at ${ARTIFACT}"
  echo "[cpanel-deploy] Removing corrupted file. Please re-upload latexify-next.tar.gz once upload reaches 100%."
  rm -f "$ARTIFACT" 2>/dev/null || true
  exit 1
fi

echo "[cpanel-deploy] Installing prebuilt .next from $(basename "$ARTIFACT") into ${APP_DIR}"
cd "$APP_DIR"

# 1. Move the current build aside (kept for instant rollback)
if [ -d ".next" ]; then
  rm -rf "$BACKUP_DIR"
  mv .next "$BACKUP_DIR"
  echo "[cpanel-deploy] Moved current .next to ${BACKUP_DIR}"
fi

# 2. Extract the standalone output — the tar is rooted at .next/standalone/*
mkdir -p .next/standalone
tar -xzf "$ARTIFACT" -C .next/standalone
echo "[cpanel-deploy] Extracted standalone output"

# 3. The standalone server expects its static files inside itself; the
#    artifact already bundles static + public, so nothing more to copy.

rm -f "$ARTIFACT"
echo "[cpanel-deploy] Removed artifact tarball"

# 4. Force cPanel Passenger / LiteSpeed to restart the Node app
mkdir -p tmp
touch tmp/restart.txt

echo "[cpanel-deploy] ✓ Deployed. Standalone server.js:"
ls -la .next/standalone/server.js 2>/dev/null || echo "  (server.js not found)"
echo "[cpanel-deploy] Visit the site to confirm it's live."