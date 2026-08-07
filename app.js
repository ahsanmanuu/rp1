// Entry point for cPanel / Phusion Passenger hosting (Domainz.in)
// Imports start.js ES module runner
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.chdir(__dirname);
} catch (e) {
  console.error('Failed to chdir in app.js:', e);
}

// Automatically sync .htaccess and index.html to public_html on app startup
try {
  const cpanelUser = process.env.USER || (__dirname.match(/\/home\/([^\/]+)/) || [])[1];
  if (cpanelUser) {
    const publicHtml = `/home/${cpanelUser}/public_html`;
    if (fs.existsSync(publicHtml)) {
      const htaccessSrc = path.resolve(__dirname, '.htaccess');
      const indexSrc = path.resolve(__dirname, 'index.html');
      if (fs.existsSync(htaccessSrc)) fs.copyFileSync(htaccessSrc, path.join(publicHtml, '.htaccess'));
      if (fs.existsSync(indexSrc)) fs.copyFileSync(indexSrc, path.join(publicHtml, 'index.html'));
    }
  }
} catch (e) {
  console.warn('[app.js Sync Warning]', e);
}

import('./start.js').catch((err) => {
  console.error('[cPanel app.js Startup Error]', err);
});
