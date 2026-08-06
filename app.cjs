// Entry point for cPanel / Phusion Passenger hosting (Domainz.in)
// Pure CommonJS entrypoint for Phusion Passenger CJS loader compatibility
const http = require('http');
const path = require('path');
const fs = require('fs');

try {
  process.chdir(__dirname);
} catch (e) {
  console.error('Failed to chdir in app.cjs:', e);
}

const port = process.env.PORT || 3000;

// Create temporary HTTP server so Phusion Passenger registers an active listener immediately
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Latexify.in - Application Starting</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 500px; border: 1px solid #334155; }
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
    <p><strong>Application Initializing</strong></p>
    <p>Loading application server. Page will refresh automatically.</p>
  </div>
</body>
</html>`);
});

global.passengerServer = server;

server.listen(port, '0.0.0.0', () => {
  console.log(`[Passenger] Server listening on port ${port}`);
});

// Asynchronously launch start.js ES module runner
import('./start.js').catch((err) => {
  console.error('[cPanel Startup Error]', err);
});
