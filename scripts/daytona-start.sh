#!/usr/bin/env bash
# ==============================================================================
# Daytona Sandbox / Linux VPS Start Script for Latexify (rp1)
# ==============================================================================
# Usage:
#   bash scripts/daytona-start.sh          # Starts production orchestrator (start.js)
#   bash scripts/daytona-start.sh --dev    # Starts development server (dev.js)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Ensure binaries have executable permissions
if [ -f "./pocketbase" ]; then
    chmod +x ./pocketbase
fi
if [ -f "bin/tectonic" ]; then
    chmod +x bin/tectonic
fi

# Default environment variables
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
export POCKETBASE_URL="${POCKETBASE_URL:-http://127.0.0.1:8090}"

MODE="${1:-prod}"

if [ "${MODE}" = "--dev" ] || [ "${MODE}" = "dev" ]; then
    echo "🚀 Starting Latexify in Development Mode (dev.js)..."
    exec node dev.js
else
    echo "🚀 Starting Latexify in Production/Sandbox Mode (start.js)..."
    export NODE_ENV="production"
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024 --expose-gc}"
    exec node ${NODE_OPTIONS} start.js
fi
