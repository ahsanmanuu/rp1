#!/usr/bin/env bash
# ==============================================================================
# One-Command Nginx Reverse Proxy Setup for Latexify VPS
# ==============================================================================
# Proxies standard Port 80 -> Next.js Port 3000 with WebSocket & 100MB body support
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🌐 Setting up Nginx Reverse Proxy on Linux VPS..."

# Check / install nginx
if ! command -v nginx >/dev/null 2>&1; then
    echo "📦 Installing Nginx..."
    if [ "$(id -u)" -eq 0 ]; then
        apt-get update -qq && apt-get install -y -qq nginx
    elif command -v sudo >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y -qq nginx
    else
        echo "❌ Root or sudo required to install Nginx."
        exit 1
    fi
fi

CONF_SRC="${PROJECT_ROOT}/scripts/nginx-latexify.conf"
CONF_DEST="/etc/nginx/sites-available/latexify.conf"

echo "⚙️ Installing Nginx configuration..."
if [ "$(id -u)" -eq 0 ]; then
    cp "${CONF_SRC}" "${CONF_DEST}"
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    ln -sf "${CONF_DEST}" /etc/nginx/sites-enabled/latexify.conf
    nginx -t
    systemctl restart nginx
    systemctl enable nginx
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
elif command -v sudo >/dev/null 2>&1; then
    sudo cp "${CONF_SRC}" "${CONF_DEST}"
    sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    sudo ln -sf "${CONF_DEST}" /etc/nginx/sites-enabled/latexify.conf
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    sudo ufw allow 80/tcp 2>/dev/null || true
    sudo ufw allow 443/tcp 2>/dev/null || true
fi

PUBLIC_IP="$(curl -s4 --max-time 2 https://ifconfig.me 2>/dev/null || echo "<YOUR_VPS_IP>")"
echo "================================================================"
echo "🎉 Nginx Reverse Proxy is active and running!"
echo "   You can now access Latexify directly on standard HTTP:"
echo "   👉 http://${PUBLIC_IP}"
echo "================================================================"
