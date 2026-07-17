import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { execSync } from 'child_process';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const pbBinary = process.platform === 'win32' ? 'pocketbase.exe' : './pocketbase';
let pbProcess = null;
let shuttingDown = false;

async function isPortReachable(port, host = '127.0.0.1') {
  try {
    const res = await fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

function getPort(url) {
  const m = url.match(/:(\d+)/);
  return m ? parseInt(m[1]) : 8090;
}

// Kill any process already bound to a TCP port (best-effort, Windows + *nix)
function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n');
      for (const line of out) {
        const m = line.match(new RegExp(`:${port}\\s+\\S+\\s+\\S+\\s+(\\d+)`));
        if (m) {
          try { execSync(`taskkill /PID ${m[1]} /F`, { stdio: 'ignore' }); } catch {}
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    }
  } catch {}
}

async function startPocketBase() {
  if (await isPortReachable(getPort(PB_URL))) {
    console.log(`\x1b[32mPocketBase already running at ${PB_URL}\x1b[0m`);
    return;
  }

  if (!fs.existsSync(pbBinary)) {
    console.log(`\x1b[33mPocketBase binary not found at ${pbBinary} — start it manually\x1b[0m`);
    return;
  }

  const pbDataDir = process.env.PB_DATA_DIR || path.resolve(process.cwd(), 'pb_data');
  const migrationsDir = path.resolve(process.cwd(), 'pb_migrations');
  fs.mkdirSync(pbDataDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });

  console.log('\x1b[32mStarting PocketBase...\x1b[0m');
  pbProcess = spawn(pbBinary, ['serve', '--http=127.0.0.1:8090', `--dir=${pbDataDir}`, `--migrationsDir=${migrationsDir}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pbProcess.stdout.on('data', (d) => process.stdout.write(`\x1b[90m[PB] \x1b[0m${d}`));
  pbProcess.stderr.on('data', (d) => process.stderr.write(`\x1b[90m[PB] \x1b[0m${d}`));

  for (let i = 0; i < 30; i++) {
    if (await isPortReachable(getPort(PB_URL))) {
      console.log(`\x1b[32mPocketBase ready at ${PB_URL}\x1b[0m`);
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\x1b[31mPocketBase failed to start within 30s\x1b[0m');
}

function startNext() {
  // Make sure nothing stale is holding port 3000
  freePort(3000);

  console.log('\x1b[32mStarting Next.js dev server...\x1b[0m');
  const useTurbo = process.argv.includes('--turbo') || process.argv.includes('--turbopack');
  const args = ['next', 'dev', '-p', '3000', ...(useTurbo ? ['--turbopack'] : ['--webpack']), ...process.argv.slice(2).filter(x => x !== '--turbo' && x !== '--turbopack')];
  const nextProc = spawn('npx', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' ? true : false,
    windowsHide: true,
  });

  let exited = false;
  nextProc.on('exit', (code, signal) => {
    if (shuttingDown || exited) return;
    exited = true;
    // Surface the real reason instead of blindly re-spawning into an EADDRINUSE loop
    console.log(`\x1b[31mNext.js dev server stopped (code ${code}, signal ${signal}).\x1b[0m`);
    console.log('\x1b[33mRun "npm run dev" again to restart. Press Ctrl+C to stop everything.\x1b[0m');
  });

  nextProc.on('error', (err) => {
    console.log(`\x1b[31mFailed to launch Next.js: ${err.message}\x1b[0m`);
    cleanup(1);
  });

  return nextProc;
}

function cleanup(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (pbProcess && !pbProcess.killed) {
    pbProcess.kill();
    console.log('\x1b[33mPocketBase stopped\x1b[0m');
  }
  process.exit(code);
}

async function main() {
  await startPocketBase();
  startNext();
  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  process.on('SIGHUP', () => cleanup(0));
}

main();
