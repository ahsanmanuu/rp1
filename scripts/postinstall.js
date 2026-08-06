import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('[Postinstall] Starting safe deployment postinstall script...');

// 1. Run Prisma generate if schema exists and prisma is usable
try {
  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    console.log('[Postinstall] Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
    console.log('[Postinstall] Prisma client generated successfully.');
  }
} catch (err) {
  console.warn('[Postinstall] Non-fatal warning during prisma generate:', err.message);
}

// 2. Run fix-prisma-exports.js
try {
  const fixScript = path.resolve(process.cwd(), 'scripts', 'fix-prisma-exports.js');
  if (fs.existsSync(fixScript)) {
    console.log('[Postinstall] Executing fix-prisma-exports.js...');
    execSync(`node "${fixScript}"`, { stdio: 'inherit', env: process.env });
    console.log('[Postinstall] fix-prisma-exports.js executed successfully.');
  }
} catch (err) {
  console.warn('[Postinstall] Non-fatal warning during fix-prisma-exports:', err.message);
}

console.log('[Postinstall] Postinstall completed successfully.');
process.exit(0);
