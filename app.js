// =============================================================================
// app.js — Phusion Passenger / LiteSpeed Reverse Proxy Bridge for cPanel Hosting
// =============================================================================

import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try { process.chdir(__dirname); } catch (e) {}

// Environment defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Capture Passenger target socket or port BEFORE modifying process.env.PORT
const passengerTarget = process.env.PORT || 3000;

// Helper: Find an unused local TCP port for Next.js standalone server
async function findFreePort(startPort = 3001) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

// Sync .htaccess to public_html on startup for LiteSpeed / cPanel
try {
  const cpanelUser = process.env.USER || (__dirname.match(/\/home\/([^\/]+)/) || [])[1];
  if (cpanelUser) {
    const publicHtml = `/home/${cpanelUser}/public_html`;
    if (fs.existsSync(publicHtml)) {
      const htSrc = path.resolve(__dirname, '.htaccess');
      if (fs.existsSync(htSrc)) fs.copyFileSync(htSrc, path.join(publicHtml, '.htaccess'));
      const oldIndex = path.join(publicHtml, 'index.html');
      if (fs.existsSync(oldIndex)) try { fs.unlinkSync(oldIndex); } catch (e) {}
    }
  }
} catch (e) {}

const standaloneServer = path.resolve(__dirname, '.next', 'standalone', 'server.js');

async function startApp() {
  if (fs.existsSync(standaloneServer)) {
    const standalonePort = await findFreePort(3005);
    console.log(`[app.js] Starting Next.js standalone server on 127.0.0.1:${standalonePort}...`);

    // Copy static assets into standalone directory before loading
    try {
      const srcPublic = path.resolve(__dirname, 'public');
      const destPublic = path.resolve(__dirname, '.next', 'standalone', 'public');
      const srcStatic = path.resolve(__dirname, '.next', 'static');
      const destStatic = path.resolve(__dirname, '.next', 'standalone', '.next', 'static');
      if (fs.existsSync(srcPublic)) try { fs.cpSync(srcPublic, destPublic, { recursive: true, force: true }); } catch (e) {}
      if (fs.existsSync(srcStatic)) try { fs.cpSync(srcStatic, destStatic, { recursive: true, force: true }); } catch (e) {}
    } catch (e) {}

    // Configure internal port for standalone server
    process.env.PORT = String(standalonePort);
    process.env.HOSTNAME = '127.0.0.1';

    // Start Next.js standalone server
    try {
      await import(pathToFileURL(standaloneServer).href);
    } catch (err) {
      try {
        require(standaloneServer);
      } catch (err2) {
        console.error('[app.js] Standalone Server Load Error:', err, err2);
      }
    }

    // Create Passenger reverse proxy server
    const proxyServer = http.createServer((req, res) => {
      const options = {
        hostname: '127.0.0.1',
        port: standalonePort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          'x-forwarded-host': req.headers.host || '',
          'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
        },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (err) => {
        console.error('[Passenger Proxy Error]', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Latexify.in - Service Starting</title>
  <meta http-equiv="refresh" content="3">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 520px; border: 1px solid #334155; }
    h1 { color: #38bdf8; font-size: 1.8rem; margin-top: 0; }
    p { color: #94a3b8; font-size: 1rem; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Latexify.in</h1>
    <p>Starting Next.js production service...</p>
    <p><small>This page will reload automatically in 3 seconds.</small></p>
  </div>
</body>
</html>`);
        }
      });

      req.pipe(proxyReq, { end: true });
    });

    // Handle WebSocket upgrades
    proxyServer.on('upgrade', (req, socket, head) => {
      const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: standalonePort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      });

      proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });

      proxyReq.on('error', () => {
        socket.destroy();
      });

      proxyReq.end();
    });

    // Bind Proxy Server to Passenger target socket/port
    proxyServer.listen(passengerTarget, () => {
      console.log(`[app.js] Passenger proxy listening on target ${passengerTarget} -> 127.0.0.1:${standalonePort}`);
    });

  } else {
    console.log('[app.js] Standalone build missing. Starting Passenger fallback server...');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Latexify.in - Build Required</title>
  <meta http-equiv="refresh" content="10">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 520px; border: 1px solid #334155; }
    h1 { color: #38bdf8; font-size: 1.8rem; margin-top: 0; }
    p { color: #94a3b8; font-size: 1rem; line-height: 1.6; }
    code { background: #334155; padding: 0.3em 0.6em; border-radius: 0.4em; font-size: 0.9rem; color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Latexify.in</h1>
    <p><strong>Next.js Production Build Required</strong></p>
    <p>Run the build script in cPanel Terminal to complete setup:</p>
    <p><code>cd ~/latexify && bash scripts/cpanel-build.sh</code></p>
  </div>
</body>
</html>`);
    });
    server.listen(passengerTarget);
  }
}

startApp().catch((err) => {
  console.error('[app.js Startup Error]', err);
});
