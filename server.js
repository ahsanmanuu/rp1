// Entry point for cPanel / Phusion Passenger hosting (Domainz.in)
// Imports start.js ES module runner
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.chdir(__dirname);
} catch (e) {
  console.error('Failed to chdir in server.js:', e);
}

import('./start.js').catch((err) => {
  console.error('[cPanel server.js Startup Error]', err);
});
