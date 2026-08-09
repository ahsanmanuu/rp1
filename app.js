// =============================================================================
// app.js — Phusion Passenger / LiteSpeed Entry Point for cPanel Hosting
// =============================================================================

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try { process.chdir(__dirname); } catch (e) {}

// Environment defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.HOSTNAME = '0.0.0.0';

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

if (fs.existsSync(standaloneServer)) {
  console.log(`[app.js] Loading standalone server from ${standaloneServer}`);
  
  // Copy static assets into standalone directory before loading
  try {
    const srcPublic = path.resolve(__dirname, 'public');
    const destPublic = path.resolve(__dirname, '.next', 'standalone', 'public');
    const srcStatic = path.resolve(__dirname, '.next', 'static');
    const destStatic = path.resolve(__dirname, '.next', 'standalone', '.next', 'static');
    if (fs.existsSync(srcPublic)) try { fs.cpSync(srcPublic, destPublic, { recursive: true, force: true }); } catch (e) {}
    if (fs.existsSync(srcStatic)) try { fs.cpSync(srcStatic, destStatic, { recursive: true, force: true }); } catch (e) {}
  } catch (e) {}

  // Load standalone server via dynamic ESM import with CJS fallback
  import(pathToFileURL(standaloneServer).href).catch((err) => {
    try {
      require(standaloneServer);
    } catch (e) {
      console.error('[app.js Standalone Load Error]', err, e);
    }
  });

} else {
  console.log('[app.js] Standalone build missing. Starting Passenger fallback server...');
  const port = process.env.PORT || 3000;
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
  server.listen(port);
}
