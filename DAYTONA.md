# Daytona Sandbox & Linux VPS Deployment Guide for Latexify (rp1)

This repository is fully configured for deployment on **Daytona Sandboxes**, **Daytona Workspaces**, and **generic Linux VPS environments** while maintaining **100% backward compatibility with Render (`render.yaml`)**, local Windows dev, and cPanel/Passenger.

---

## 🏗️ Architecture in Daytona & Linux VPS

Latexify runs a unified architecture inside the Daytona Sandbox VPS:
1. **Next.js Web Application & API Gateway**: Listens on `0.0.0.0:3000` (configurable via `$PORT` and `$HOSTNAME`).
2. **PocketBase Backend & Database**: Listens on `127.0.0.1:8090` (and `0.0.0.0:8090` in dev), storing collections and auth records in `pb_data/`.
3. **Tectonic Offline LaTeX Compilation Engine**: Installed in `bin/tectonic` for instant, local PDF compilation without external LaTeX dependencies.

---

## 🚀 Quick Start on Daytona

### Option 1: Automatic Daytona Workspace Creation
If you create a Daytona workspace from this repository, Daytona automatically detects `.devcontainer/devcontainer.json`:
```bash
daytona create https://github.com/ahsanmanuu/rp1.git
```
- Daytona spins up the Node.js 20 environment.
- Automatically executes `bash scripts/daytona-setup.sh` via `postCreateCommand`.
- Forwards ports `3000` (Web App) and `8090` (PocketBase Admin).

### Option 2: Manual / SSH Linux Sandbox VPS
Inside a fresh Daytona sandbox or Linux VPS terminal:
```bash
# 1. Run the one-command setup
bash scripts/daytona-setup.sh

# 2. Start the application
# For Development (hot-reloading Next.js dev server + PocketBase daemon):
npm run daytona:dev

# For Production / Standalone Sandbox (unified start.js orchestrator):
npm run daytona
```

---

## 🌐 Resolving "Localhost Works on VPS, but External Access Fails"

If you can access the app locally on the VPS (e.g. `curl http://localhost:3000` returns HTML), but external browsers cannot access it, this is caused by one of three things:

### 1. VPS Firewall (UFW / iptables) Blocking Port 3000
Ubuntu/Debian VPSs have UFW active with incoming traffic blocked by default.
Run the automated firewall unblock script:
```bash
npm run vps:firewall
# or: bash scripts/fix-vps-firewall.sh
```
This automatically allows incoming traffic on ports `3000`, `8090`, `80`, and `443`.

### 2. External Traffic Connects to Port 80 (Not 3000)
External visitors browse to `http://<your-vps-ip>` (port 80) rather than `http://<your-vps-ip>:3000`.
To set up an automated, production-grade Nginx reverse proxy that routes Port 80 to Next.js Port 3000 with WebSocket support:
```bash
npm run vps:nginx
# or: bash scripts/setup-nginx.sh
```
Once run, your application is immediately available on standard `http://<YOUR_VPS_IP>`.

### 3. Socket Binding (0.0.0.0 vs 127.0.0.1)
The application is now explicitly configured in `start.js`, `dev.js`, and `app.js` to bind to `0.0.0.0` (all network interfaces) so it accepts incoming external requests.

### 4. Updating Application & NextAuth URLs
In `.env.local` on your VPS, configure your public IP or domain:
```bash
NEXTAUTH_URL=http://<YOUR_VPS_IP>:3000
NEXT_PUBLIC_APP_URL=http://<YOUR_VPS_IP>:3000
HOSTNAME=0.0.0.0
PORT=3000
```
*(If using Nginx on port 80, omit `:3000` from the URLs)*.

---

## ⚠️ Resolving Git Pull, Warning & Vulnerability Cautions

### 1. Git Pull Line-Ending Warnings & Bad Interpreter Errors
- **Root Cause**: Scripts checked out or edited on Windows can carry CRLF (`\r\n`) line endings. On Linux, this causes `/bin/bash^M: bad interpreter` or syntax errors.
- **Fix Applied**: 
  - [`.gitattributes`](file:///.gitattributes) now enforces `eol=lf` across all `.sh`, `.service`, `.json`, `.js`, `.ts`, and config files.
  - [`scripts/daytona-setup.sh`](file:///scripts/daytona-setup.sh) automatically strips any carriage returns using `sed -i 's/\r$//'`.

### 2. Dependency Audit Warnings on Pull / Install
- **Root Cause**: Next.js 16 and React 19 utilize cutting-edge dependency trees. Running `npm audit fix --force` attempts to downgrade/upgrade Next.js and Prisma, which breaks the application.
- **Fix Applied**:
  - Automated deployment commands in `render.yaml` and `daytona-setup.sh` use `npm install --no-audit --no-fund` to suppress noisy audit banners.
  - Telemetry prompts from Prisma on headless VPSs are silenced via `PRISMA_TELEMETRY_DISABLE=1` and `CHECKPOINT_DISABLE=1`.

---

## 🛠️ Configuration & Helper Scripts

| File | Purpose |
|---|---|
| [`.devcontainer/devcontainer.json`](file:///.devcontainer/devcontainer.json) | Standard DevContainer config for Daytona with Node 20, ports 3000/8090, and extensions |
| [`daytona.yaml`](file:///daytona.yaml) | Daytona workspace manifest specifying ports, env, and lifecycle commands |
| [`scripts/daytona-setup.sh`](file:///scripts/daytona-setup.sh) | Idempotent setup script: installs system libs, PocketBase & Tectonic binaries, Prisma client, and `.env.local` |
| [`scripts/daytona-start.sh`](file:///scripts/daytona-start.sh) | Unified launcher supporting both production (`node start.js`) and development (`--dev`) modes |
| [`scripts/fix-vps-firewall.sh`](file:///scripts/fix-vps-firewall.sh) | Automatically inspects and unblocks ports 3000, 8090, 80, 443 in UFW and iptables |
| [`scripts/setup-nginx.sh`](file:///scripts/setup-nginx.sh) | One-command setup for Nginx reverse proxy (Port 80 -> Port 3000 with WebSockets) |
| [`scripts/nginx-latexify.conf`](file:///scripts/nginx-latexify.conf) | Nginx configuration template for Linux VPS |
| [`scripts/daytona-latexify.service`](file:///scripts/daytona-latexify.service) | Systemd unit template for 24/7 persistent background service on a Linux VPS |

---

## 🔌 Port Mapping & Access

| Service | Internal Port | Daytona / VPS Port | External URL |
|---|---|---|---|
| **Latexify Web App (Direct)** | `3000` | `3000` | `http://<VPS_IP>:3000` |
| **Latexify Web App (Via Nginx)** | `3000` | `80` | `http://<VPS_IP>` |
| **PocketBase Admin UI** | `8090` | `8090` | `http://<VPS_IP>:8090/_/` |

### Default PocketBase Admin Credentials
- **Email**: `admin@latexify.io`
- **Password**: `Sczone@123`

---

## 🐧 Persistent VPS Service (systemd)

To run Latexify as an always-on background system service on your Daytona Linux VPS:
```bash
sudo cp scripts/daytona-latexify.service /etc/systemd/system/latexify.service
sudo systemctl daemon-reload
sudo systemctl enable --now latexify
sudo systemctl status latexify
```
