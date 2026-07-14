import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import dns from 'dns';

// Force IPv4-first resolution to prevent ENETUNREACH errors on environments without IPv6 routing
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Setup file logger
const logPath = path.resolve(process.cwd(), 'startup.log');
fs.writeFileSync(logPath, `[Startup Started at ${new Date().toISOString()}]\n`);

function log(msg, err = null) {
  const time = new Date().toISOString();
  const output = `[${time}] ${msg}${err ? ' | Error: ' + err.stack || err.message || err : ''}\n`;
  fs.appendFileSync(logPath, output);
  if (err) {
    console.error(msg, err);
  } else {
    console.log(msg);
  }
}

// Manually load .env.local and .env files into process.env to ensure variables are available
// during local standalone execution.
function loadDotEnv() {
  const filenames = ['.env.local', '.env'];
  for (const filename of filenames) {
    try {
      const envPath = path.resolve(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    } catch (e) {
      log(`Failed to manually load ${filename}`, e);
    }
  }
}

loadDotEnv();

// Default NODE_ENV to production if not set, since start.js is the standalone build runner
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// ============================================================
// Auto-download PocketBase binary if missing (Render deploy)
// ============================================================
async function ensurePocketBaseBinary() {
  const isWindows = process.platform === 'win32';
  const pbBinary = isWindows ? 'pocketbase.exe' : './pocketbase';
  if (fs.existsSync(pbBinary)) return pbBinary;

  if (isWindows) {
    log('Windows detected — cannot auto-download PocketBase. Skipping.');
    return null;
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const version = '0.27.0';
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_linux_${arch}.zip`;
  const zipPath = path.resolve(process.cwd(), 'pocketbase.zip');

  log(`PocketBase binary not found. Downloading from ${url}...`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);
    execSync(`unzip -o "${zipPath}" && chmod +x pocketbase && rm "${zipPath}"`, { stdio: 'inherit' });
    log('PocketBase downloaded and extracted successfully.');
    return pbBinary;
  } catch (err) {
    log(`Failed to download PocketBase: ${err.message}`);
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
    return null;
  }
}

// ============================================================
// Start PocketBase as a child process (Linux/macOS only)
// ============================================================
async function startPocketBase() {
  // NOTE: The old database corruption check (checking for the custom
  // admin_users table before setup-pb.js runs) was removed because it
  // deleted the database on EVERY fresh deployment — admin_users is a
  // custom collection created by setup-pb.js, not a PB system table,
  // so it doesn't exist yet when this check runs.

  const pbBinary = await ensurePocketBaseBinary();
  if (!pbBinary) {
    const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
    log(`No PocketBase binary available. Ensure PocketBase is running externally at ${pbUrl}`);
    return;
  }

  const isWindows = process.platform === 'win32';
  const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';

  return new Promise((resolve, reject) => {

    // Use PB_DATA_DIR env var if set (Render persistent disk), otherwise default to ./pb_data
    const pbDataDir = process.env.PB_DATA_DIR || path.resolve(process.cwd(), 'pb_data');
    fs.mkdirSync(pbDataDir, { recursive: true });
    log(`[PB Startup] PocketBase data directory: ${pbDataDir}`);

    // Run superuser upsert via CLI before spawning the server to avoid database locked/WAL mode conflicts
    const emailsToCreate = Array.from(new Set([
      process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io',
      process.env.ADMIN_EMAIL || 'sid.ilm6@gmail.com'
    ].filter(Boolean)));
    let cliPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
    if (cliPassword === 'admin123456') cliPassword = undefined; // Ignore stale old default
    const activePassword = cliPassword || 'Sczone@123';

    for (const email of emailsToCreate) {
      try {
        log(`[PB Startup] Running CLI superuser upsert for ${email}...`);
        const cmd = isWindows
          ? `"${pbBinary}" superuser upsert ${email} ${activePassword} --dir="${pbDataDir}"`
          : `chmod +x "${pbBinary}" && "${pbBinary}" superuser upsert ${email} ${activePassword} --dir="${pbDataDir}"`;
        execSync(cmd, { stdio: 'inherit' });
        log(`[PB Startup] CLI superuser upsert succeeded for ${email}.`);
      } catch (err) {
        log(`[PB Startup] CLI superuser upsert failed for ${email}: ${err.message}`);
      }
    }

    // Ensure migrations directory exists (pointing to our tracked pb_migrations/)
    const migrationsDir = path.resolve(process.cwd(), 'pb_migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });

    log(`Starting PocketBase from ${pbBinary}...`);
    const pb = spawn(pbBinary, ['serve', '--http=0.0.0.0:8090', `--dir=${pbDataDir}`, `--migrationsDir=${migrationsDir}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    pb.stdout.on('data', (data) => {
      const msg = data.toString();
      process.stdout.write(`[PB] ${msg}`);
      if (msg.includes('Server started')) {
        log('PocketBase is ready.');
        resolve();
      }
    });

    pb.stderr.on('data', (data) => {
      process.stderr.write(`[PB] ${data.toString()}`);
    });

    pb.on('error', (err) => {
      log('Failed to start PocketBase process', err);
      resolve(); // Don't block startup — fall through to Next.js
    });

    pb.on('exit', (code) => {
      log(`PocketBase exited with code ${code}`);
    });

    // Timeout: if PocketBase doesn't start within 30s, continue anyway
    setTimeout(() => {
      log('PocketBase startup timeout — continuing without confirmed readiness.');
      resolve();
    }, 30000);
  });
}

// ============================================================
// Determine database path (SQLite fallback)
// ============================================================
const existingUrl = process.env.DATABASE_URL;
const isPostgres = existingUrl && (existingUrl.startsWith('postgres://') || existingUrl.startsWith('postgresql://'));

let dbPath = null;
if (isPostgres) {
  log('Using PostgreSQL database from environment.');
} else {
  dbPath = (existingUrl && existingUrl.startsWith('file:'))
    ? existingUrl.replace(/^file:/, '')
    : null;

  if (dbPath && path.isAbsolute(dbPath)) {
    log(`Using absolute database path from environment: ${dbPath}`);
  } else {
    // Standalone mode fallback
    const standaloneDir = path.resolve(process.cwd(), '.next', 'standalone');
    dbPath = path.resolve(standaloneDir, 'prisma', 'dev.db');
    process.env.DATABASE_URL = `file:${dbPath}`;
    log(`Setting database path to standalone local fallback: ${dbPath}`);
  }

  // Ensure the directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Copy pre-populated database if target file does NOT exist (initial seeding)
  if (!fs.existsSync(dbPath)) {
    try {
      const rootPrismaDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
      const rootDbPath = path.resolve(process.cwd(), 'dev.db');

      if (fs.existsSync(rootPrismaDbPath)) {
        log(`Seeding database: copying from ${rootPrismaDbPath} to ${dbPath}`);
        fs.copyFileSync(rootPrismaDbPath, dbPath);
      } else if (fs.existsSync(rootDbPath)) {
        log(`Seeding database: copying from ${rootDbPath} to ${dbPath}`);
        fs.copyFileSync(rootDbPath, dbPath);
      } else {
        log('No source database found to seed from.');
      }
    } catch (seedError) {
      log('Failed to seed database', seedError);
    }
  } else {
    log(`Database already exists at ${dbPath}, skipping seeding to prevent overwriting dynamic data.`);
  }
}

process.env.HOSTNAME = '0.0.0.0';
log('Overriding HOSTNAME to 0.0.0.0');

// Copy static assets into the standalone directory so Next.js server can serve them
try {
  const srcPublic = path.resolve(process.cwd(), 'public');
  const destPublic = path.resolve(process.cwd(), '.next/standalone/public');
  const srcStatic = path.resolve(process.cwd(), '.next/static');
  const destStatic = path.resolve(process.cwd(), '.next/standalone/.next/static');

  if (fs.existsSync(srcPublic)) {
    log('Copying public/ assets (excluding uploads) to standalone/public...');
    fs.cpSync(srcPublic, destPublic, {
      recursive: true,
      force: true,
      filter: (src) => {
        const basename = path.basename(src);
        return basename !== 'uploads';
      }
    });
  } else {
    log('Warning: srcPublic directory not found at ' + srcPublic);
  }
  
  if (fs.existsSync(srcStatic)) {
    log('Copying .next/static/ assets to standalone/.next/static...');
    fs.cpSync(srcStatic, destStatic, { recursive: true, force: true });
  } else {
    log('Warning: srcStatic directory not found at ' + srcStatic);
  }
  log('Static assets copied successfully!');
} catch (error) {
  log('Failed to copy static assets', error);
}

// Schema is managed by PocketBase. prisma db push is only relevant for SQLite standalone.
// Note: Commeted out to prevent non-fatal Prisma P1013 protocol errors in standalone mode since all queries mock to PocketBase.
// if (!isPostgres) {
//   try {
//     log('Programmatically syncing SQLite database schema using prisma db push...');
//     execSync('npx prisma db push --accept-data-loss', {
//       stdio: 'inherit',
//       env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
//     });
//     log('SQLite database schema synced successfully!');
//   } catch (error) {
//     log('Failed to sync SQLite database schema', error);
//   }
// }

// Wait for PocketBase to be ready (poll for TCP connectivity before running setup)
function waitForPocketBase(url, retries = 10, delay = 3000) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      fetch(url)
        .then((r) => { log('PocketBase reachable.'); resolve(true); })
        .catch(() => {
          if (attempts >= retries) { log('Giving up on PocketBase readiness check.'); resolve(false); return; }
          setTimeout(check, delay);
        });
    };
    check();
  });
}

// Start PocketBase first, then run setup, then launch Next.js
startPocketBase().then(async () => {
  const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
  await waitForPocketBase(pbUrl, 10, 3000);
  try {
    const { setupPocketBase } = await import('./scripts/setup-pb.js');
    await setupPocketBase();
  } catch (setupErr) {
    log('PocketBase auto-setup failed (non-fatal)', setupErr);
  }
  log('Starting background sync worker...');
  try {
    const { startSyncWorker } = await import('./src/lib/sync/syncWorker.js');
    startSyncWorker();
  } catch (syncErr) {
    log('Background sync worker failed to start (non-fatal)', syncErr);
  }
  log('Starting Next.js standalone server...');
  import('./.next/standalone/server.js');
});
