#!/usr/bin/env bash
# ==============================================================================
# Daytona Sandbox / Linux VPS Setup Script for Latexify (rp1)
# ==============================================================================
# This script prepares a fresh Linux sandbox/VPS environment:
# 1. Strips any CRLF carriage returns from shell scripts
# 2. Installs system-level packages (curl, unzip, tar, fontconfig, etc.)
# 3. Configures Linux firewall (UFW/iptables) to allow ports 3000, 8090, 80, 443
# 4. Generates .env.local if missing (with secure random secrets and 0.0.0.0 binding)
# 5. Downloads Linux PocketBase & Tectonic binaries (multi-arch: x86_64 / arm64)
# 6. Installs npm dependencies (--no-audit --no-fund) and generates Prisma clients
# 7. Configures PocketBase superuser and directories
#
# Safe to run multiple times (idempotent).
# Render deployments & existing workflows remain completely untouched.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Sanitize potential CRLF line-endings in shell scripts
find "${PROJECT_ROOT}/scripts" -type f -name "*.sh" -exec sed -i 's/\r$//' {} + 2>/dev/null || true

echo "================================================================"
echo "🚀 Initializing Daytona Sandbox / Linux VPS for Latexify"
echo "   Working Directory: ${PROJECT_ROOT}"
echo "================================================================"

# 1. System Packages Check & Installation (Debian/Ubuntu/Daytona container)
if command -v apt-get >/dev/null 2>&1; then
    echo "📦 Checking system packages (curl, unzip, tar, fontconfig, ca-certificates)..."
    MISSING_PKGS=()
    for pkg in curl unzip tar fontconfig libfontconfig1 ca-certificates; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            MISSING_PKGS+=("$pkg")
        fi
    done

    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
        echo "Installing missing system packages: ${MISSING_PKGS[*]}..."
        if [ "$(id -u)" -eq 0 ]; then
            apt-get update -qq && apt-get install -y -qq --no-install-recommends "${MISSING_PKGS[@]}"
        elif command -v sudo >/dev/null 2>&1; then
            sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends "${MISSING_PKGS[@]}"
        else
            echo "⚠️ Cannot install packages with root/sudo. Proceeding with existing system libraries..."
        fi
    else
        echo "✅ Required system packages are already installed."
    fi
fi

# 2. Firewall configuration for external accessibility
if command -v ufw >/dev/null 2>&1; then
    echo "🔒 Configuring Linux firewall (UFW) for public external access..."
    if [ "$(id -u)" -eq 0 ]; then
        ufw allow 3000/tcp comment "Latexify Next.js Web App" >/dev/null 2>&1 || true
        ufw allow 8090/tcp comment "PocketBase Admin Backend" >/dev/null 2>&1 || true
        ufw allow 80/tcp comment "HTTP Web" >/dev/null 2>&1 || true
        ufw allow 443/tcp comment "HTTPS Web" >/dev/null 2>&1 || true
        echo "✅ UFW firewall rules configured (ports 3000, 8090, 80, 443 allowed)."
    elif command -v sudo >/dev/null 2>&1; then
        sudo ufw allow 3000/tcp comment "Latexify Next.js Web App" >/dev/null 2>&1 || true
        sudo ufw allow 8090/tcp comment "PocketBase Admin Backend" >/dev/null 2>&1 || true
        sudo ufw allow 80/tcp comment "HTTP Web" >/dev/null 2>&1 || true
        sudo ufw allow 443/tcp comment "HTTPS Web" >/dev/null 2>&1 || true
        echo "✅ UFW firewall rules configured via sudo (ports 3000, 8090, 80, 443 allowed)."
    fi
fi

# 3. Architecture detection
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64)
        PB_ARCH="amd64"
        TECTONIC_ARCH="x86_64"
        ;;
    aarch64|arm64)
        PB_ARCH="arm64"
        TECTONIC_ARCH="aarch64"
        ;;
    *)
        echo "⚠️ Unknown architecture: ${ARCH}, defaulting to amd64 / x86_64"
        PB_ARCH="amd64"
        TECTONIC_ARCH="x86_64"
        ;;
esac
echo "ℹ️ Detected platform architecture: ${ARCH} (PB: ${PB_ARCH}, Tectonic: ${TECTONIC_ARCH})"

# 4. Detect VPS Public IP for accurate external URL display
PUBLIC_IP="$(curl -s4 --max-time 2 https://ifconfig.me 2>/dev/null || curl -s4 --max-time 2 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")"

# 5. Environment Configuration (.env.local)
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "⚙️ Creating .env.local with 0.0.0.0 host binding..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
    else
        cat << 'EOF' > .env.local
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=admin@latexify.io
POCKETBASE_ADMIN_PASSWORD=Sczone@123
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    fi

    # Generate a random 32-char hex secret for NextAuth if default placeholder exists
    RAND_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' 2>/dev/null || date +%s%N | sha256sum | head -c 32)"
    if grep -q "your-nextauth-secret" .env.local 2>/dev/null; then
        sed -i "s/your-nextauth-secret-min-32-chars/${RAND_SECRET}/" .env.local || true
    fi

    # Ensure HOSTNAME=0.0.0.0 is present
    if ! grep -q "HOSTNAME=" .env.local 2>/dev/null; then
        echo "HOSTNAME=0.0.0.0" >> .env.local
    fi
    echo "✅ .env.local initialized with external network support."
else
    echo "✅ Environment file (.env or .env.local) found."
    # Ensure HOSTNAME=0.0.0.0 is set in .env.local if not present
    if [ -f ".env.local" ] && ! grep -q "HOSTNAME=" .env.local; then
        echo "HOSTNAME=0.0.0.0" >> .env.local
    fi
fi

# 6. PocketBase Linux Binary
PB_VERSION="0.27.0"
mkdir -p pb_data pb_migrations

if [ ! -f "./pocketbase" ] || [ ! -x "./pocketbase" ]; then
    echo "📥 Downloading PocketBase v${PB_VERSION} for Linux (${PB_ARCH})..."
    PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
    curl -fsSL -o /tmp/pocketbase.zip "${PB_URL}"
    unzip -o /tmp/pocketbase.zip pocketbase
    chmod +x ./pocketbase
    rm -f /tmp/pocketbase.zip
    echo "✅ PocketBase binary installed successfully."
else
    chmod +x ./pocketbase
    echo "✅ PocketBase binary is present and executable."
fi

# 7. Tectonic LaTeX Engine Binary
mkdir -p bin
TECTONIC_VERSION="0.15.0"
if [ ! -f "bin/tectonic" ] || [ ! -x "bin/tectonic" ]; then
    echo "📥 Downloading Tectonic v${TECTONIC_VERSION} for Linux (${TECTONIC_ARCH})..."
    TECTONIC_URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${TECTONIC_ARCH}-unknown-linux-gnu.tar.gz"
    if curl -fsSL --retry 3 -o /tmp/tectonic.tar.gz "${TECTONIC_URL}"; then
        tar xzf /tmp/tectonic.tar.gz -C bin/
        chmod +x bin/tectonic
        rm -f /tmp/tectonic.tar.gz
        echo "✅ Tectonic engine installed successfully at bin/tectonic."
    else
        echo "⚠️ Failed to download Tectonic binary from ${TECTONIC_URL}. App will fall back to cloud compilers."
    fi
else
    chmod +x bin/tectonic
    echo "✅ Tectonic binary is present and executable at bin/tectonic."
fi

# 8. Install Node dependencies (silencing noise with --no-audit --no-fund)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies (--no-audit --no-fund)..."
    npm install --no-audit --no-fund
else
    echo "✅ node_modules directory already exists."
fi

# 9. Prisma Generate & Patches (disabling telemetry warnings)
echo "🔄 Generating Prisma Client and applying runtime patches..."
export PRISMA_TELEMETRY_DISABLE=1
export CHECKPOINT_DISABLE=1
npx prisma generate || true
if [ -f "scripts/fix-prisma-exports.js" ]; then
    node scripts/fix-prisma-exports.js || true
fi
if [ -f "scripts/patch-react-dom.js" ]; then
    node scripts/patch-react-dom.js || true
fi
if [ -f "scripts/patch-next-font.js" ]; then
    node scripts/patch-next-font.js || true
fi

# 10. Initialize PocketBase Superuser
echo "🔑 Initializing PocketBase superuser in pb_data..."
ADMIN_EMAIL="${POCKETBASE_ADMIN_EMAIL:-admin@latexify.io}"
ADMIN_PASS="${POCKETBASE_ADMIN_PASSWORD:-Sczone@123}"
if [ "${ADMIN_PASS}" = "admin123456" ]; then
    ADMIN_PASS="Sczone@123"
fi

./pocketbase superuser upsert "${ADMIN_EMAIL}" "${ADMIN_PASS}" --dir="./pb_data" >/dev/null 2>&1 || true

echo "================================================================"
echo "🎉 Daytona Sandbox / Linux VPS Setup Complete!"
echo "   - Web App Internal:   http://localhost:3000"
echo "   - Web App External:   http://${PUBLIC_IP}:3000"
echo "   - PocketBase Admin:   http://${PUBLIC_IP}:8090/_/"
echo "   - Admin Email:        ${ADMIN_EMAIL}"
echo "   - Bound Interface:    0.0.0.0 (Publicly Accessible)"
echo "   - Tectonic Engine:    bin/tectonic (Ready)"
echo ""
echo "Quick Commands:"
echo "   npm run dev           # Start full dev server (Next.js + PocketBase)"
echo "   npm start             # Start production server (start.js orchestrator)"
echo "   bash scripts/daytona-start.sh  # Launch Daytona start runner"
echo "================================================================"
