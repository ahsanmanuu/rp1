import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn, ChildProcess } from 'child_process';
import dns from 'dns';

// Force IPv4-first DNS resolution
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

function log(msg: string, err: any = null) {
  const time = new Date().toISOString();
  const line = `[PB-Starter ${time}] ${msg}${err ? ' | ' + (err.stack || err.message || err) : ''}\n`;
  console.log(line.trim());
}

let pbProcessInstance: ChildProcess | null = null;
let starterPromise: Promise<boolean> | null = null;

export async function isPocketBaseHealthy(pbUrl: string = 'http://127.0.0.1:8090'): Promise<boolean> {
  try {
    const targetUrl = pbUrl.replace('localhost', '127.0.0.1');
    const res = await fetch(`${targetUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureBinary(): Promise<string | null> {
  const isWindows = process.platform === 'win32';
  const pbBinary = isWindows ? 'pocketbase.exe' : './pocketbase';
  const absBinary = path.resolve(process.cwd(), pbBinary);

  if (fs.existsSync(absBinary)) {
    if (!isWindows) {
      try { fs.chmodSync(absBinary, 0o755); } catch {}
    }
    return absBinary;
  }

  if (isWindows) {
    log('Windows detected and pocketbase.exe not found in working dir.');
    return null;
  }

  // Detect architecture
  const nodeArch = process.arch;
  let pbArch = 'amd64';
  if (nodeArch === 'arm64') pbArch = 'arm64';
  else if (nodeArch === 'arm') pbArch = 'armv7';

  const version = '0.27.0';
  const urls = [
    `https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_linux_${pbArch}.zip`,
    `https://pocketbase.io/downloads/v${version}/pocketbase_${version}_linux_${pbArch}.zip`
  ];

  const zipPath = path.resolve(process.cwd(), 'pocketbase.zip');

  for (const url of urls) {
    log(`Attempting PocketBase binary download from ${url}...`);
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) continue;
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(zipPath, buffer);

      // Try system unzip first, fallback to adm-zip
      let extracted = false;
      try {
        execSync(`unzip -o "${zipPath}" -d "${process.cwd()}" && chmod +x "${absBinary}" && rm -f "${zipPath}"`, { stdio: 'ignore' });
        extracted = true;
      } catch {
        log('System unzip failed or not installed. Extracting with adm-zip JS module...');
        // NOTE: `any` here is intentional — adm-zip is a CJS module and the
        // dynamic-import interop shape (`module.default || module`) cannot be
        // statically proven constructable under both `node` and `bundler`
        // module resolution settings.
        const AdmZipModule: any = await import('adm-zip');
        const AdmZip = AdmZipModule.default || AdmZipModule;
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(process.cwd(), true);
        fs.chmodSync(absBinary, 0o755);
        try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
        extracted = true;
      }

      if (extracted && fs.existsSync(absBinary)) {
        log('PocketBase binary downloaded and extracted successfully.');
        return absBinary;
      }
    } catch (err: any) {
      log(`Download failed from ${url}: ${err?.message || err}`);
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
    }
  }

  log('CRITICAL: Failed to acquire PocketBase binary from all sources.');
  return null;
}

export async function ensureAndStartPocketBase(): Promise<boolean> {
  const pbUrl = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace('localhost', '127.0.0.1');

  // Check if already healthy
  if (await isPocketBaseHealthy(pbUrl)) {
    return true;
  }

  if (starterPromise) return starterPromise;

  starterPromise = (async () => {
    try {
      const binaryPath = await ensureBinary();
      if (!binaryPath) {
        log(`No PocketBase binary available. Expecting external instance at ${pbUrl}`);
        return false;
      }

      let pbDataDir = process.env.PB_DATA_DIR || path.resolve(process.cwd(), 'pb_data');
      try {
        fs.mkdirSync(pbDataDir, { recursive: true });
      } catch {
        pbDataDir = path.join(os.tmpdir(), 'rp1_pb_data');
        fs.mkdirSync(pbDataDir, { recursive: true });
        log(`Default data dir unwritable, using fallback: ${pbDataDir}`);
      }

      const migrationsDir = path.resolve(process.cwd(), 'pb_migrations');
      try { fs.mkdirSync(migrationsDir, { recursive: true }); } catch {}

      // Run superuser upsert
      const emailsToCreate = Array.from(new Set([
        process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io',
        process.env.ADMIN_EMAIL || 'sid.ilm6@gmail.com'
      ].filter(Boolean)));
      let cliPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
      if (cliPassword === 'admin123456') cliPassword = undefined;
      const activePassword = cliPassword || 'Sczone@123';

      const isWindows = process.platform === 'win32';
      for (const email of emailsToCreate) {
        try {
          const cmd = isWindows
            ? `"${binaryPath}" superuser upsert ${email} ${activePassword} --dir="${pbDataDir}"`
            : `chmod +x "${binaryPath}" && "${binaryPath}" superuser upsert ${email} ${activePassword} --dir="${pbDataDir}"`;
          execSync(cmd, { stdio: 'ignore' });
        } catch {}
      }

      log(`Spawning PocketBase process from ${binaryPath}...`);
      pbProcessInstance = spawn(binaryPath, ['serve', '--http=0.0.0.0:8090', `--dir=${pbDataDir}`, `--migrationsDir=${migrationsDir}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      pbProcessInstance.stdout?.on('data', (d) => {
        const str = d.toString();
        if (process.env.DEBUG_PB) process.stdout.write(`[PB] ${str}`);
      });
      pbProcessInstance.stderr?.on('data', (d) => {
        const str = d.toString();
        if (process.env.DEBUG_PB) process.stderr.write(`[PB-ERR] ${str}`);
      });

      pbProcessInstance.on('exit', (code) => {
        log(`PocketBase process exited with code ${code}. Cleaning up reference.`);
        pbProcessInstance = null;
        starterPromise = null;
      });

      // Poll health endpoint for up to 15 seconds
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await isPocketBaseHealthy(pbUrl)) {
          log(`PocketBase successfully started and responsive at ${pbUrl}`);
          return true;
        }
      }

      log('PocketBase spawned but health check timed out after 15s.');
      return false;
    } catch (err: any) {
      log('Error during ensureAndStartPocketBase:', err);
      starterPromise = null;
      return false;
    }
  })();

  return starterPromise;
}
