const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const standaloneDir = path.join(projectRoot, '.next', 'standalone');
  const publicDir = path.join(projectRoot, 'public');
  const staticDir = path.join(projectRoot, '.next', 'static');
  const outputTar = path.join(projectRoot, 'latexify-next.tar.gz');
  const outputTarAlt = path.join(projectRoot, 'latexify-next-build.tar.gz');

  if (!fs.existsSync(standaloneDir)) {
    console.error('[Packager] ERROR: .next/standalone directory not found. Please run next build first.');
    process.exit(1);
  }

  console.log('[Packager] Preparing static assets in standalone directory...');

  // Clean any auto-copied uploads from standalone/public before archiving
  const standaloneUploads = path.join(standaloneDir, 'public', 'uploads');
  if (fs.existsSync(standaloneUploads)) {
    try { fs.rmSync(standaloneUploads, { recursive: true, force: true }); } catch (e) {}
  }

  // Copy public assets (excluding uploads/)
  if (fs.existsSync(publicDir)) {
    const destPublic = path.join(standaloneDir, 'public');
    fs.mkdirSync(destPublic, { recursive: true });
    fs.cpSync(publicDir, destPublic, { 
      recursive: true, 
      force: true,
      filter: (src) => {
        const rel = path.relative(publicDir, src);
        if (rel === 'uploads' || rel.startsWith(`uploads${path.sep}`) || rel.startsWith('uploads/')) {
          return false;
        }
        return true;
      }
    });
    console.log('  ✓ Copied public/ assets (excluding uploads/)');
  }

  // Copy static assets
  if (fs.existsSync(staticDir)) {
    const destStatic = path.join(standaloneDir, '.next', 'static');
    fs.mkdirSync(destStatic, { recursive: true });
    fs.cpSync(staticDir, destStatic, { recursive: true, force: true });
    console.log('  ✓ Copied .next/static/ assets');
  }

  // Remove heavy dev artifacts copied into standalone by Next.js NFT module tracing
  const junkPatterns = [
    'dev.db', 'dev.db-journal', 'dev.db-shm', 'dev.db-wal',
    'pocketbase', 'pocketbase.exe', 'pb_data',
    'runtime.log', 'devserver.log', 'server.log', 'dev-output.log',
    'devrun_stdout.log', 'devrun_stderr.log', 'pb_stderr.log', 'pb_stdout.log',
    'build-artifact.zip', 'latexify-next.tar.gz', 'latexify-next-build.tar.gz',
    'scratch', 'scratch_project', 'tmp', 'bin', 'src', 'docs'
  ];

  junkPatterns.forEach(pattern => {
    const targetPath = path.join(standaloneDir, pattern);
    if (fs.existsSync(targetPath)) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`  ✓ Removed dev artifact from standalone: ${pattern}`);
      } catch (e) {}
    }
  });

  // Clean compiler build cache from standalone/.next (cache is only for compilation, not production execution)
  const standaloneCacheDir = path.join(standaloneDir, '.next', 'cache');
  if (fs.existsSync(standaloneCacheDir)) {
    try {
      fs.rmSync(standaloneCacheDir, { recursive: true, force: true });
      console.log('  ✓ Cleaned .next/cache build artifacts from standalone');
    } catch (e) {}
  }

  // Clean node_modules/.cache if present
  const nmCacheDir = path.join(standaloneDir, 'node_modules', '.cache');
  if (fs.existsSync(nmCacheDir)) {
    try {
      fs.rmSync(nmCacheDir, { recursive: true, force: true });
      console.log('  ✓ Cleaned node_modules/.cache from standalone');
    } catch (e) {}
  }

  // Clean database files from standalone/prisma
  const standalonePrismaDir = path.join(standaloneDir, 'prisma');
  if (fs.existsSync(standalonePrismaDir)) {
    try {
      for (const item of fs.readdirSync(standalonePrismaDir)) {
        if (item.endsWith('.db') || item.endsWith('.db-bak') || item.endsWith('.db-journal') || item.endsWith('.db-shm') || item.endsWith('.db-wal')) {
          fs.rmSync(path.join(standalonePrismaDir, item), { recursive: true, force: true });
          console.log(`  ✓ Cleaned DB file from standalone prisma: ${item}`);
        }
      }
    } catch (e) {}
  }

  // ── Step: Sanitize Windows hardcoded paths & backslashes for Linux runtime ──
  console.log('[Packager] Sanitizing Windows build paths and backslashes for Linux...');
  
  // 1. Sanitize server.js
  const serverJsPath = path.join(standaloneDir, 'server.js');
  if (fs.existsSync(serverJsPath)) {
    try {
      let serverJs = fs.readFileSync(serverJsPath, 'utf8');
      serverJs = serverJs.replace(/"outputFileTracingRoot"\s*:\s*"[^"]+"/g, '"outputFileTracingRoot":"."');
      serverJs = serverJs.replace(/"root"\s*:\s*"[A-Za-z]:\\[^"]+"/g, '"root":"."');
      fs.writeFileSync(serverJsPath, serverJs);
      console.log('  ✓ Sanitized server.js Windows paths');
    } catch (e) {}
  }

  // 2. Sanitize .next/required-server-files.json
  const reqFilesPath = path.join(standaloneDir, '.next', 'required-server-files.json');
  if (fs.existsSync(reqFilesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(reqFilesPath, 'utf8'));
      data.appDir = '.';
      data.relativeAppDir = '';
      if (data.config) {
        data.config.outputFileTracingRoot = '.';
        if (data.config.turbopack) data.config.turbopack.root = '.';
      }
      if (Array.isArray(data.files)) {
        data.files = data.files.map(f => typeof f === 'string' ? f.replace(/\\/g, '/') : f);
      }
      fs.writeFileSync(reqFilesPath, JSON.stringify(data, null, 2));
      console.log('  ✓ Sanitized required-server-files.json (appDir & POSIX slashes)');
    } catch (e) {}
  }

  // 3. Sanitize all JSON manifest files in standalone/.next (convert Windows \\ to POSIX /)
  const standaloneNextDir = path.join(standaloneDir, '.next');
  if (fs.existsSync(standaloneNextDir)) {
    const sanitizeManifests = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          sanitizeManifests(fullPath);
        } else if (entry.name.endsWith('.json')) {
          try {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('C:\\') || content.includes('C:/') || content.includes('\\\\')) {
              content = content.replace(/[A-Za-z]:\\\\[^\"]+/g, '.');
              content = content.replace(/[A-Za-z]:\/[^\"]+/g, '.');
              content = content.replace(/"\.next\\\\/g, '".next/');
              content = content.replace(/\\\\/g, '/');
              fs.writeFileSync(fullPath, content);
            }
          } catch (e) {}
        }
      }
    };
    sanitizeManifests(standaloneNextDir);
    console.log('  ✓ Sanitized all .next manifest JSON files to POSIX slashes');
  }

  console.log(`[Packager] Archiving .next/standalone to ${outputTar}...`);

  if (fs.existsSync(outputTar)) {
    try { fs.unlinkSync(outputTar); } catch (e) {}
  }
  if (fs.existsSync(outputTarAlt)) {
    try { fs.unlinkSync(outputTarAlt); } catch (e) {}
  }

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputTar);
    
    // Support archiver v8 export structure (CJS/ESM interop)
    const archiverMod = require('archiver');
    const archive = archiverMod.create 
      ? archiverMod.create('tar', { gzip: true, gzipOptions: { level: 6 } })
      : (typeof archiverMod === 'function'
          ? archiverMod('tar', { gzip: true, gzipOptions: { level: 6 } })
          : new archiverMod.TarArchive({ gzip: true, gzipOptions: { level: 6 } }));

    output.on('close', () => {
      if (!fs.existsSync(outputTar)) {
        reject(new Error(`File not found on disk after write stream close: ${outputTar}`));
        return;
      }
      const stats = fs.statSync(outputTar);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      // Also sync to latexify-next-build.tar.gz for complete backward compatibility
      try {
        fs.copyFileSync(outputTar, outputTarAlt);
      } catch (e) {}

      console.log('============================================');
      console.log(`[Packager] SUCCESS! Verified artifact on disk: ${outputTar} (${sizeMB} MB)`);
      console.log('============================================');
      resolve();
    });

    output.on('error', (err) => {
      console.error('[Packager] Output stream error:', err);
      reject(err);
    });

    archive.on('error', (err) => {
      console.error('[Packager] Archive error:', err);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(standaloneDir, false);
    archive.finalize();
  });
}

main().catch(err => {
  console.error('[Packager] Fatal error:', err);
  process.exit(1);
});
