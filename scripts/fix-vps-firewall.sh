#!/usr/bin/env bash
# ==============================================================================
# Linux VPS Firewall & Port Diagnostic & Fix Script
# ==============================================================================
# Resolves "not publicly accessible to external however on VPS localhost works"
# ==============================================================================

set -euo pipefail

echo "🔍 Diagnosing Linux VPS network bindings and firewall rules..."

# 1. Check listening sockets
echo "----------------------------------------------------------------"
echo "📡 Checking listening ports on the system:"
if command -v ss >/dev/null 2>&1; then
    ss -tlpn | grep -E "3000|8090|80|443" || echo "   (No active listeners found on 3000/8090/80/443)"
elif command -v netstat >/dev/null 2>&1; then
    netstat -tlpn | grep -E "3000|8090|80|443" || echo "   (No active listeners found on 3000/8090/80/443)"
fi
echo "----------------------------------------------------------------"

# 2. Check and fix UFW
if command -v ufw >/dev/null 2>&1; then
    echo "🔒 Checking UFW status:"
    UFW_STATUS="$(sudo ufw status 2>/dev/null || ufw status 2>/dev/null || echo "inactive")"
    echo "${UFW_STATUS}"
    if echo "${UFW_STATUS}" | grep -q "Status: active"; then
        echo "🔓 Unblocking incoming ports 3000, 8090, 80, 443 in UFW..."
        if [ "$(id -u)" -eq 0 ]; then
            ufw allow 3000/tcp comment "Latexify Next.js"
            ufw allow 8090/tcp comment "PocketBase Backend"
            ufw allow 80/tcp comment "HTTP Web"
            ufw allow 443/tcp comment "HTTPS Web"
            ufw reload
        elif command -v sudo >/dev/null 2>&1; then
            sudo ufw allow 3000/tcp comment "Latexify Next.js"
            sudo ufw allow 8090/tcp comment "PocketBase Backend"
            sudo ufw allow 80/tcp comment "HTTP Web"
            sudo ufw allow 443/tcp comment "HTTPS Web"
            sudo ufw reload
        fi
        echo "✅ UFW firewall ports successfully opened."
    fi
fi

# 3. Check and fix iptables if restrictive
if command -v iptables >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
        iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
        iptables -I INPUT -p tcp --dport 8090 -j ACCEPT 2>/dev/null || true
        iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
        iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    elif command -v sudo >/dev/null 2>&1; then
        sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
        sudo iptables -I INPUT -p tcp --dport 8090 -j ACCEPT 2>/dev/null || true
        sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
        sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    fi
fi

PUBLIC_IP="$(curl -s4 --max-time 2 https://ifconfig.me 2>/dev/null || echo "<YOUR_VPS_IP>")"
echo "================================================================"
echo "🎉 Firewall check and unblock complete!"
echo "   External URLs to test in your browser:"
echo "   - Web Application: http://${PUBLIC_IP}:3000"
echo "   - PocketBase UI:   http://${PUBLIC_IP}:8090/_/"
echo "================================================================"
