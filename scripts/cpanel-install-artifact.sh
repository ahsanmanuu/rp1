#!/bin/bash
# =============================================================================
# cpanel-install-artifact.sh — Install a pre-built standalone artifact on cPanel
#
# Usage: cd ~/latexify && bash scripts/cpanel-install-artifact.sh [path/to/latexify-next.tar.gz]
# =============================================================================

USER_NAME=$(whoami)
APP_DIR="/home/${USER_NAME}/latexify"
PUBLIC_HTML="/home/${USER_NAME}/public_html"

ARTIFACT="${1:-}"

if [ -z "$ARTIFACT" ]; then
  ARTIFACT_LOCATIONS=(
    "${APP_DIR}/latexify-next.tar.gz"
    "/home/${USER_NAME}/latexify-next.tar.gz"
    "${APP_DIR}/latexify-next-build.tar.gz"
    "/home/${USER_NAME}/latexify-next-build.tar.gz"
    "${PUBLIC_HTML}/latexify-next.tar.gz"
  )
  for loc in "${ARTIFACT_LOCATIONS[@]}"; do
    if [ -f "$loc" ]; then
      ARTIFACT="$loc"
      break
    fi
  done
fi

if [ -z "$ARTIFACT" ] || [ ! -f "$ARTIFACT" ]; then
  echo "[cpanel-install] ERROR: Artifact not found."
  echo "                Upload latexify-next.tar.gz to ~/latexify/ via cPanel File Manager first."
  exit 1
fi

echo "============================================"
echo "[cpanel-install] Installing prebuilt artifact: $ARTIFACT"
echo "============================================"

exec bash scripts/cpanel-deploy-artifact.sh "$ARTIFACT"
