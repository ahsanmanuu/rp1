const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const publicDir = path.join(projectRoot, 'public');
const staticDir = path.join(projectRoot, '.next', 'static');
const outputTar = path.join(projectRoot, 'latexify-next.tar.gz');

if (!fs.existsSync(standaloneDir)) {
  console.error('[Packager] ERROR: .next/standalone directory not found. Please run next build first.');
  process.exit(1);
}

console.log('[Packager] Preparing static assets in standalone directory...');

// Copy public assets
if (fs.existsSync(publicDir)) {
  const destPublic = path.join(standaloneDir, 'public');
  fs.mkdirSync(destPublic, { recursive: true });
  fs.cpSync(publicDir, destPublic, { recursive: true, force: true });
  console.log('  ✓ Copied public/ assets');
}

// Copy static assets
if (fs.existsSync(staticDir)) {
  const destStatic = path.join(standaloneDir, '.next', 'static');
  fs.mkdirSync(destStatic, { recursive: true });
  fs.cpSync(staticDir, destStatic, { recursive: true, force: true });
  console.log('  ✓ Copied .next/static/ assets');
}

console.log('[Packager] Archiving .next/standalone to latexify-next.tar.gz...');

if (fs.existsSync(outputTar)) {
  try { fs.unlinkSync(outputTar); } catch (e) {}
}

const output = fs.createWriteStream(outputTar);
const archive = archiver('tar', {
  gzip: true,
  gzipOptions: { level: 6 }
});

output.on('close', () => {
  const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
  console.log('============================================');
  console.log(`[Packager] SUCCESS! Created latexify-next.tar.gz (${sizeMB} MB)`);
  console.log('============================================');
});

archive.on('error', (err) => {
  console.error('[Packager] Archive error:', err);
  process.exit(1);
});

archive.pipe(output);
archive.directory(standaloneDir, false);
archive.finalize();
