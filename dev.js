import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { spawn, execSync } from 'child_process';

// Force IPv4-first resolution to prevent localhost -> ::1 refusal on Windows
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const pbBinary = process.platform === 'win32' ? 'pocketbase.exe' : './pocketbase';
let pbProcess = null;
let nextProcess = null;
let shuttingDown = false;
let restartTimer = null;

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
        if (m && m[1] !== String(process.pid)) {
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
  pbProcess = spawn(pbBinary, ['serve', '--http=0.0.0.0:8090', `--dir=${pbDataDir}`, `--migrationsDir=${migrationsDir}`], {
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
  if (shuttingDown) return;

  // Make sure nothing stale is holding port 3000
  freePort(3000);

  console.log('\x1b[32mStarting Next.js dev server on http://localhost:3000 (0.0.0.0:3000)...\x1b[0m');
  const useTurbo = process.argv.includes('--turbo') || process.argv.includes('--turbopack');
  const args = ['next', 'dev', '-H', '0.0.0.0', '-p', '3000', ...(useTurbo ? ['--turbopack'] : ['--webpack']), ...process.argv.slice(2).filter(x => x !== '--turbo' && x !== '--turbopack')];
  
  const nextEnv = {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim()
  };

  nextProcess = spawn('npx', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' ? true : false,
    windowsHide: true,
    env: nextEnv,
  });

  nextProcess.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`\x1b[33mNext.js dev server exited (code ${code}, signal ${signal}). Self-healing restart in 1.5s...\x1b[0m`);
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!shuttingDown) startNext();
    }, 1500);
  });

  nextProcess.on('error', (err) => {
    console.log(`\x1b[31mNext.js process error: ${err.message}. Retrying in 2s...\x1b[0m`);
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!shuttingDown) startNext();
    }, 2000);
  });

  return nextProcess;
}

function cleanup(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (restartTimer) clearTimeout(restartTimer);
  
  if (nextProcess && !nextProcess.killed) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${nextProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        nextProcess.kill('SIGTERM');
      }
    } catch {}
  }
  
  if (pbProcess && !pbProcess.killed) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pbProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        pbProcess.kill('SIGTERM');
      }
      console.log('\x1b[33mPocketBase stopped\x1b[0m');
    } catch {}
  }

  freePort(3000);
  process.exit(code);
}

// Background liveness monitor to ensure PocketBase & Next.js remain responsive
function startSupervisorMonitor() {
  setInterval(async () => {
    if (shuttingDown) return;
    
    // Check PocketBase
    const pbOk = await isPortReachable(8090);
    if (!pbOk && !shuttingDown) {
      console.log('\x1b[33m[Supervisor] PocketBase unreachable, restarting...\x1b[0m');
      await startPocketBase();
    }
  }, 10000);
}

async function main() {
  await startPocketBase();
  startNext();
  startSupervisorMonitor();

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  process.on('SIGHUP', () => cleanup(0));
}

main();
