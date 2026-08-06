// Entry point for cPanel / Phusion Passenger hosting (Domainz.in)
// Boots PocketBase database & launches Next.js server
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lock working directory to application root
try {
  process.chdir(__dirname);
} catch (e) {
  console.error('Failed to chdir to app root:', e);
}

// Launch start.js application launcher
import('./start.js').catch((err) => {
  console.error('[cPanel server.js Fatal Startup Error]', err);
});
