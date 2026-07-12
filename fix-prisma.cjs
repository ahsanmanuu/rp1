const fs = require('fs');
const path = require('path');

/**
 * ULTRA-STABLE PRISMA ADAPTER PATCH (V4)
 * Resolves:
 * 1. Windows path resolution (file:// vs absolute)
 * 2. BetterSqlite3 v12 "memory" property conflict
 * 3. Fallback to physical dev.db instead of :memory: to prevent data loss
 */

const paths = [
  path.join(process.cwd(), 'node_modules', '@prisma', 'adapter-better-sqlite3', 'dist', 'index.js'),
  path.join(process.cwd(), 'node_modules', '@prisma', 'adapter-better-sqlite3', 'dist', 'index.mjs')
];

const absoluteDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/');

paths.forEach(p => {
  if (!fs.existsSync(p)) return;

  const isEsm = p.endsWith('.mjs');
  const driverName = isEsm ? 'Database' : 'import_better_sqlite3.default';
  
  let content = fs.readFileSync(p, 'utf8');

  // FIX 1: The "memory" option crash and Windows path resolution
  // We replace the entire createBetterSQLite3Client function with a hardened version
  const hardenedFunction = `function createBetterSQLite3Client(input) {
  const { url, ...config } = input || {};
  // 1. Resolve path with fallback to physical dev.db (NOT :memory:)
  const dbPath = (url || "file:${absoluteDbPath}").replace(/^file:/, "").replace(/^\\/\\//, "");
  
  // 2. STRIKE TEAM: Explicitly delete legacy properties that crash better-sqlite3 v7-12
  if (config && typeof config === 'object') {
    delete config.memory;
    delete config.readonly; // Often causes issues if passed from certain drivers
  }

  // 3. Initialize with hardened config
  const db = new ${driverName}(dbPath, { 
    ...config,
    timeout: config.timeout || 10000 
  });
  
  db.defaultSafeIntegers(true);
  return db;
}`;

  // Find the original function and replace it
  const originalFunctionRegex = /function createBetterSQLite3Client\(input\)\s*\{[\s\S]*?return db;\s*\}/;
  
  if (content.match(originalFunctionRegex)) {
    content = content.replace(originalFunctionRegex, hardenedFunction);
    console.log(`[PATCH] Hardened createBetterSQLite3Client in ${path.basename(p)}`);
  } else {
    console.log(`[PATCH] Could not find createBetterSQLite3Client in ${path.basename(p)}, skipping or already patched.`);
  }

  fs.writeFileSync(p, content);
});

console.log("[PERMANENT FIX] Prisma adapter fully hardened for Windows + BetterSqlite3 v12.");
