import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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

async function startPocketBase() {
  if (await isPortReachable(getPort(PB_URL))) {
    console.log(`\x1b[32mPocketBase already running at ${PB_URL}\x1b[0m`);
    return;
  }

  if (!fs.existsSync(pbBinary)) {
    console.log(`\x1b[33mPocketBase binary not found at ${pbBinary}\x1b[0m`);
    console.log(`\x1b[33mStart it manually or place ${pbBinary} in the project root.\x1b[0m`);
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
  console.log('\x1b[32mStarting Next.js dev server...\x1b[0m');
  const nextCommand = `npx next dev -p 3000 --turbopack ${process.argv.slice(2).join(' ')}`;
  const nextProc = spawn(nextCommand, [], { stdio: 'inherit', shell: true });

  nextProc.on('exit', (code) => {
    if (shuttingDown) return;
    // Next.js 16 restarts itself via memory watchdog — if it exits, re-spawn
    console.log(`\x1b[33mNext.js exited (code ${code}), re-spawning...\x1b[0m`);
    // Clear stale turbopack cache on restart to prevent build artifacts accumulation
    const devCache = path.resolve(process.cwd(), '.next', 'dev');
    try { if (fs.existsSync(devCache)) fs.rmSync(devCache, { recursive: true, force: true }); } catch {}
    startNext();
  });

  return nextProc;
}

async function main() {
  await startPocketBase();
  const nextProc = startNext();

  const cleanup = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (pbProcess && !pbProcess.killed) {
      pbProcess.kill();
      console.log('\x1b[33mPocketBase stopped\x1b[0m');
    }
    process.exit(code);
  };

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  process.on('SIGHUP', () => cleanup(0));
}

main();
