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

# Thorough integrity check: test gzip payload + tar archive headers
if ! gzip -t "$ARTIFACT" >/dev/null 2>&1 || ! tar -tf "$ARTIFACT" >/dev/null 2>&1; then
  echo "[cpanel-deploy] ERROR: Corrupted or truncated archive file detected at ${ARTIFACT}"
  echo "[cpanel-deploy] Removing corrupted file. Please re-upload latexify-next.tar.gz once upload reaches 100%."
  rm -f "$ARTIFACT" 2>/dev/null || true
  exit 1
fi

echo "[cpanel-deploy] Installing prebuilt .next from $(basename "$ARTIFACT") into ${APP_DIR}"
cd "$APP_DIR"

# 1. Move the current build aside (kept for instant rollback if extraction fails)
HAS_BACKUP=false
if [ -d ".next" ]; then
  rm -rf "$BACKUP_DIR"
  mv .next "$BACKUP_DIR"
  HAS_BACKUP=true
  echo "[cpanel-deploy] Moved current .next to ${BACKUP_DIR}"
fi

# 2. Extract the standalone output into .next/standalone
mkdir -p .next/standalone
EXTRACT_SUCCESS=true
tar -xzf "$ARTIFACT" -C .next/standalone 2>/tmp/cpanel_deploy_tar_err.log || EXTRACT_SUCCESS=false

if [ "$EXTRACT_SUCCESS" = false ] || [ ! -f ".next/standalone/server.js" ]; then
  echo "[cpanel-deploy] ERROR: Extraction failed or server.js missing!"
  cat /tmp/cpanel_deploy_tar_err.log 2>/dev/null || true
  rm -f /tmp/cpanel_deploy_tar_err.log 2>/dev/null || true
  rm -rf .next
  if [ "$HAS_BACKUP" = true ] && [ -d "$BACKUP_DIR" ]; then
    mv "$BACKUP_DIR" .next
    echo "[cpanel-deploy] ROLLBACK SUCCESSFUL: Restored existing .next build."
  fi
  rm -f "$ARTIFACT" 2>/dev/null || true
  exit 1
fi
rm -f /tmp/cpanel_deploy_tar_err.log 2>/dev/null || true
echo "[cpanel-deploy] Extracted standalone output successfully."

# 3. Ensure static assets are present inside standalone directory
if [ -d "public" ] && [ -d ".next/standalone" ]; then
  mkdir -p .next/standalone/public
  cp -R public/* .next/standalone/public/ 2>/dev/null || true
fi
if [ -d ".next/static" ] && [ -d ".next/standalone" ]; then
  mkdir -p .next/standalone/.next/static
  cp -R .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
fi

# Clean up backup now that extraction succeeded
rm -rf "$BACKUP_DIR" 2>/dev/null || true
rm -f "$ARTIFACT" 2>/dev/null || true
echo "[cpanel-deploy] Removed artifact tarball"

# 4. Force cPanel Passenger / LiteSpeed to restart the Node app
mkdir -p tmp
touch tmp/restart.txt

echo "[cpanel-deploy] ✓ Deployed successfully. Standalone server.js:"
ls -la .next/standalone/server.js 2>/dev/null || echo "  (server.js not found)"
echo "[cpanel-deploy] Visit the site to confirm it's live."