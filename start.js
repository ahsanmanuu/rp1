import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import dns from 'dns';

// Ensure working directory is locked to the directory of start.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  process.chdir(__dirname);
} catch (e) {
  console.error('Failed to chdir in start.js:', e);
}

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

// Find valid npm executable in PATH or cPanel virtualenv
function findNpmBinary() {
  const cpanelUser = process.env.USER || (process.cwd().match(/\/home\/([^\/]+)/) || [])[1] || 'latexify';
  const possiblePaths = [
    `/home/${cpanelUser}/nodevenv/latexify/22/bin/npm`,
    `/home/${cpanelUser}/nodevenv/${path.basename(process.cwd())}/22/bin/npm`,
    'npm',
    '/usr/local/bin/npm',
    '/usr/bin/npm',
  ];
  for (const p of possiblePaths) {
    try {
      if (p === 'npm') return 'npm';
      if (fs.existsSync(p)) return `"${p}"`;
    } catch {}
  }
  return 'npm';
}

// ============================================================
// Auto-verify and build dependencies / Next.js production bundle if missing
// ============================================================
function ensureBuildAndDependencies() {
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  const nextBuildPath = path.resolve(process.cwd(), '.next');
  const standaloneServer = path.resolve(process.cwd(), '.next', 'standalone', 'server.js');
  const buildManifest = path.resolve(process.cwd(), '.next', 'build-manifest.json');

  if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(path.resolve(nodeModulesPath, 'next'))) {
    const npmBin = findNpmBinary();
    log(`node_modules missing or incomplete. Running ${npmBin} install...`);
    try {
      execSync(`${npmBin} install --production=false --no-audit`, { stdio: 'inherit', env: process.env });
      log('npm install completed successfully.');
    } catch (err) {
      log('npm install failed (non-fatal):', err);
    }
  }

  if (!fs.existsSync(nextBuildPath) || (!fs.existsSync(standaloneServer) && !fs.existsSync(buildManifest))) {
    const npmBin = findNpmBinary();
    log(`.next production build missing. Running ${npmBin} run build...`);
    try {
      execSync(`${npmBin} run build`, { stdio: 'inherit', env: process.env });
      log('npm run build completed successfully.');
    } catch (err) {
      log('npm run build failed (non-fatal):', err);
    }
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
ensureBuildAndDependencies();

// Default NODE_ENV to production if not set, since start.js is the standalone build runner
process.env.NODE_ENV = process.env.NODE_ENV || 'production';


// ============================================================
// Auto-download PocketBase binary if missing (Render deploy / VPS deploy)
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
    
    try {
      execSync(`unzip -o "${zipPath}" && chmod +x pocketbase && rm -f "${zipPath}"`, { stdio: 'inherit' });
    } catch (unzipErr) {
      log(`System unzip failed (${unzipErr.message}). Falling back to adm-zip JS module...`);
      const { default: AdmZip } = await import('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(process.cwd(), true);
      fs.chmodSync(pbBinary, 0o755);
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
    }

    log('PocketBase downloaded and extracted successfully.');
    return pbBinary;
  } catch (err) {
    log(`Failed to download PocketBase: ${err.message}`);
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
    return null;
  }
}

// ============================================================
// Start PocketBase as a child process
// ============================================================
async function startPocketBase() {
  const pbBinary = await ensurePocketBaseBinary();
  const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';

  if (!pbBinary) {
    log(`No PocketBase binary available. Ensure PocketBase is running externally at ${pbUrl}`);
    const hcInterval = setInterval(async () => {
      try {
        const resp = await fetch(pbUrl + '/api/health', { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
          log(`PocketBase is now reachable at ${pbUrl}`);
          clearInterval(hcInterval);
        }
      } catch {}
    }, 15000);
    hcInterval.unref();
    return;
  }

  // Pre-flight check: is PB already running at target URL?
  try {
    const checkResp = await fetch(pbUrl + '/api/health', { signal: AbortSignal.timeout(2000) });
    if (checkResp.ok) {
      log(`PocketBase is already running and reachable at ${pbUrl}`);
      return;
    }
  } catch {}

  const isWindows = process.platform === 'win32';

  return new Promise((resolve) => {
    const pbDataDir = process.env.PB_DATA_DIR || path.resolve(process.cwd(), 'pb_data');
    fs.mkdirSync(pbDataDir, { recursive: true });
    log(`[PB Startup] PocketBase data directory: ${pbDataDir}`);

    const emailsToCreate = Array.from(new Set([
      process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io',
      process.env.ADMIN_EMAIL || 'sid.ilm6@gmail.com'
    ].filter(Boolean)));
    let cliPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
    if (cliPassword === 'admin123456') cliPassword = undefined;
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

    const migrationsDir = path.resolve(process.cwd(), 'pb_migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });

    log(`Starting PocketBase from ${pbBinary}...`);

    let pbResolved = false;
    let pbProcess = null;

    function markReady() {
      if (!pbResolved) {
        pbResolved = true;
        log('PocketBase is ready.');
        resolve();
      }
    }

    function spawnPocketBase() {
      pbProcess = spawn(pbBinary, ['serve', '--http=127.0.0.1:8090', `--dir=${pbDataDir}`, `--migrationsDir=${migrationsDir}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      pbProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        process.stdout.write(`[PB] ${msg}`);
        if ((msg.includes('Server started') || msg.includes('http://')) && !pbResolved) {
          markReady();
        }
      });

      pbProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        process.stderr.write(`[PB] ${msg}`);
        if ((msg.includes('Server started') || msg.includes('http://')) && !pbResolved) {
          markReady();
        }
      });

      pbProcess.on('error', (err) => {
        log('Failed to start PocketBase process', err);
        markReady();
      });

      pbProcess.on('exit', (code) => {
        log(`PocketBase process exited with code ${code}`);
        pbProcess = null;
        if (!pbResolved) {
          log(`PocketBase exited before ready (code ${code}) — retrying in 3s...`);
        } else {
          log(`PocketBase exited unexpectedly (code ${code}) — restarting in 3s...`);
        }
        setTimeout(spawnPocketBase, 3000);
      });
    }

    spawnPocketBase();

    // Active health polling until PB becomes responsive
    const pollHealth = setInterval(async () => {
      if (pbResolved) {
        clearInterval(pollHealth);
        return;
      }
      try {
        const res = await fetch(pbUrl + '/api/health', { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          log('PocketBase health check succeeded.');
          clearInterval(pollHealth);
          markReady();
        }
      } catch {}
    }, 500);

    // Timeout: if PocketBase doesn't start within 30s, continue anyway
    setTimeout(() => {
      clearInterval(pollHealth);
      if (!pbResolved) {
        markReady();
        log('PocketBase startup timeout — continuing without confirmed readiness.');
      }
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
  log('Starting Next.js server...');
  if (global.passengerServer) {
    try {
      global.passengerServer.close();
      log('Closed temporary Passenger server for Next.js server binding.');
    } catch (e) {}
  }
  const port = process.env.PORT || 3000;
  const standaloneServer = path.resolve(process.cwd(), '.next', 'standalone', 'server.js');

  if (fs.existsSync(standaloneServer)) {
    log(`Launching Next.js standalone server from ${standaloneServer}...`);
    try {
      await import('./.next/standalone/server.js');
      return;
    } catch (importErr) {
      log('Failed to import standalone server:', importErr);
    }
  }

  const nextBin = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const buildManifest = path.resolve(process.cwd(), '.next', 'build-manifest.json');
  if (fs.existsSync(nextBin) && fs.existsSync(buildManifest)) {
    log('Launching next start CLI fallback...');
    spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '0.0.0.0'], {
      stdio: 'inherit',
      env: { ...process.env },
    });
    return;
  }

  // HTTP Fallback Server: Guarantees 200 OK & prevents 403 / 500 errors on cPanel Passenger while build initializes
  log('Starting HTTP fallback server on port ' + port + ' while build initializes...');
  try {
    const { createServer } = await import('http');
    const fallbackServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Latexify.in - System Setup</title>
  <meta http-equiv="refresh" content="10">
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
    <p><strong>System Initialization in Progress</strong></p>
    <p>The application is preparing dependencies and building production assets. This page will refresh automatically in 10 seconds.</p>
  </div>
</body>
</html>`);
    });
    fallbackServer.listen(port, '0.0.0.0', () => {
      log(`HTTP fallback server active and listening on port ${port}`);
    });
  } catch (fallbackErr) {
    log('Failed to start HTTP fallback server:', fallbackErr);
  }
});
