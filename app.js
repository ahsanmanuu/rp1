// =============================================================================
// app.js — cPanel / Phusion Passenger entry point for Domainz.in hosting
// 
// This file is ONLY used on cPanel (Application Startup File = app.js).
// For localhost development, use: npm run dev  (or npm start → start.js)
//
// Design: Launches pre-built Next.js standalone server immediately.
// If standalone server is missing, triggers automated background build once.
// =============================================================================

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Lock working directory
try { process.chdir(__dirname); } catch (e) {}

// Load .env and .env.local
function loadEnvFile(filename) {
  try {
    const envPath = path.resolve(__dirname, filename);
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch (e) {}
}

loadEnvFile('.env.local');
loadEnvFile('.env');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOSTNAME = '0.0.0.0';

// Sync .htaccess and index.html to public_html
try {
  const cpanelUser = process.env.USER || (__dirname.match(/\/home\/([^\/]+)/) || [])[1];
  if (cpanelUser) {
    const publicHtml = `/home/${cpanelUser}/public_html`;
    if (fs.existsSync(publicHtml)) {
      const htSrc = path.resolve(__dirname, '.htaccess');
      const idxSrc = path.resolve(__dirname, 'index.html');
      if (fs.existsSync(htSrc)) fs.copyFileSync(htSrc, path.join(publicHtml, '.htaccess'));
      if (fs.existsSync(idxSrc)) fs.copyFileSync(idxSrc, path.join(publicHtml, 'index.html'));
    }
  }
} catch (e) {}

const port = process.env.PORT || 3000;
const standaloneServer = path.resolve(__dirname, '.next', 'standalone', 'server.js');

// ── Strategy 1: Launch Next.js standalone server immediately if built ──
if (fs.existsSync(standaloneServer)) {
  console.log(`[app.js] Launching Next.js standalone server from ${standaloneServer}`);

  // Copy static assets into standalone directory
  try {
    const srcPublic = path.resolve(__dirname, 'public');
    const destPublic = path.resolve(__dirname, '.next', 'standalone', 'public');
    const srcStatic = path.resolve(__dirname, '.next', 'static');
    const destStatic = path.resolve(__dirname, '.next', 'standalone', '.next', 'static');
    if (fs.existsSync(srcPublic)) try { fs.cpSync(srcPublic, destPublic, { recursive: true, force: true }); } catch (e) {}
    if (fs.existsSync(srcStatic)) try { fs.cpSync(srcStatic, destStatic, { recursive: true, force: true }); } catch (e) {}
  } catch (e) {}

  // Directly import standalone server so Next.js binds port without port conflict
  import('./.next/standalone/server.js').catch((err) => {
    console.error('[app.js] Error starting standalone server:', err);
  });

} else {
  // ── Strategy 2: Automatically trigger background build & serve progress page ──
  const lockFile = path.resolve(__dirname, 'tmp', 'building.lock');
  if (!fs.existsSync(lockFile)) {
    console.log('[app.js] Standalone build missing. Spawning automated background build...');
    triggerBackgroundBuild();
  } else {
    console.log('[app.js] Standalone build in progress (lockfile present)...');
  }

  startFallbackServer('Automated production build is in progress. Please wait 2-3 minutes while assets compile.');
}

function triggerBackgroundBuild() {
  try {
    const buildScript = path.resolve(__dirname, 'scripts', 'cpanel-build.sh');
    if (fs.existsSync(buildScript)) {
      const child = spawn('bash', [buildScript], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log('[app.js] Background build process spawned successfully.');
    }
  } catch (err) {
    console.error('[app.js] Failed to spawn background build:', err);
  }
}

function startFallbackServer(statusMessage) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Latexify.in - System Initialization</title>
  <meta http-equiv="refresh" content="10">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 520px; border: 1px solid #334155; }
    h1 { color: #38bdf8; font-size: 1.8rem; margin-top: 0; }
    p { color: #94a3b8; font-size: 1rem; line-height: 1.6; }
    .spinner { width: 40px; height: 40px; border: 4px solid #334155; border-top: 4px solid #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 1.5rem auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Latexify.in</h1>
    <div class="spinner"></div>
    <p><strong>System Setup in Progress</strong></p>
    <p>${statusMessage}</p>
    <p style="font-size:0.85rem; color:#64748b;">This page will auto-refresh every 10 seconds.</p>
  </div>
</body>
</html>`);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`[app.js] Fallback server listening on port ${port}`);
  });
}
