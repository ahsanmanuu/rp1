import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const info: any = {};
  
  // Basic info
  info.cwd = process.cwd();
  info.env = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOSTNAME: process.env.HOSTNAME,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(not set)',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '(set)' : '(NOT SET - MISSING!)',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
  };
  
  // Check startup.log at both possible locations
  const logPaths = [
    path.resolve(process.cwd(), 'startup.log'),
    path.resolve(process.cwd(), '..', 'startup.log'),
    path.resolve(process.cwd(), '..', '..', 'startup.log'),
  ];
  for (const lp of logPaths) {
    if (fs.existsSync(lp)) {
      info.startupLog = { path: lp, content: fs.readFileSync(lp, 'utf8').slice(-3000) };
      break;
    }
  }
  if (!info.startupLog) {
    info.startupLog = { error: 'Not found at any of: ' + logPaths.join(', ') };
  }

  // Check runtime.log
  const runtimeLogPaths = [
    path.resolve(process.cwd(), 'runtime.log'),
    path.resolve(process.cwd(), '..', 'runtime.log'),
    path.resolve(process.cwd(), '..', '..', 'runtime.log'),
  ];
  for (const lp of runtimeLogPaths) {
    if (fs.existsSync(lp)) {
      info.runtimeLog = { path: lp, content: fs.readFileSync(lp, 'utf8').slice(-10000) };
      break;
    }
  }
  if (!info.runtimeLog) {
    info.runtimeLog = { error: 'Not found at any of: ' + runtimeLogPaths.join(', ') };
  }
  
  // Check DB file
  const dbUrl = process.env.DATABASE_URL || '';
  const dbFilePath = dbUrl.replace(/^file:/, '');
  info.db = { url: dbUrl, path: dbFilePath };
  if (dbFilePath) {
    info.db.exists = fs.existsSync(dbFilePath);
    if (info.db.exists) {
      info.db.sizeBytes = fs.statSync(dbFilePath).size;
      // Try raw SQLite query to check tables
      try {
        const Database = (await import('better-sqlite3')).default;
        const sqlite = new Database(dbFilePath, { readonly: true });
        const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        info.db.tables = tables.map((t: any) => t.name);
        try {
          const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM "User"').get() as any;
          info.db.userCount = userCount.count;
          const projectCount = sqlite.prepare('SELECT COUNT(*) as count FROM "Project"').get() as any;
          info.db.projectCount = projectCount.count;
          const fileCount = sqlite.prepare('SELECT COUNT(*) as count FROM "ProjectFile"').get() as any;
          info.db.projectFileCount = fileCount.count;
        } catch (e: any) {
          info.db.userCountError = e.message;
        }
        sqlite.close();
      } catch (e: any) {
        info.db.queryError = e.message;
      }
    }
  }

  // Check directory structures
  const checkDirs = [
    'public',
    '.next',
    '.next/static',
    '.next/standalone',
    '.next/standalone/public',
    '.next/standalone/.next',
    '.next/standalone/.next/static',
  ];
  
  info.dirs = {};
  for (const dir of checkDirs) {
    const fullPath = path.resolve(process.cwd(), dir);
    const exists = fs.existsSync(fullPath);
    info.dirs[dir] = { exists, path: fullPath };
    if (exists) {
      try {
        const files = fs.readdirSync(fullPath);
        info.dirs[dir].filesCount = files.length;
        info.dirs[dir].sampleFiles = files.slice(0, 10);
      } catch (err: any) {
        info.dirs[dir].error = err.message;
      }
    }
  }

  // Find all dev.db files in /opt/render/project or process.cwd() parent directories
  const foundDbs: any[] = [];
  let DatabaseClient: any = null;
  try {
    DatabaseClient = (await import('better-sqlite3')).default;
  } catch (e) {}

  function scanForDbs(dirPath: string, depth = 0) {
    if (depth > 4) return;
    try {
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          if (file.name !== 'node_modules' && file.name !== '.git') {
            scanForDbs(fullPath, depth + 1);
          }
        } else if (file.name === 'dev.db') {
          const stats = fs.statSync(fullPath);
          const dbInfo: any = {
            path: fullPath,
            sizeBytes: stats.size,
            exists: true
          };
          // Try to inspect tables
          try {
            if (DatabaseClient) {
              const sqlite = new DatabaseClient(fullPath, { readonly: true });
              const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
              dbInfo.tables = tables.map((t: any) => t.name);
              sqlite.close();
            } else {
              dbInfo.error = "better-sqlite3 driver not available";
            }
          } catch (e: any) {
            dbInfo.error = e.message;
          }
          foundDbs.push(dbInfo);
        }
      }
    } catch (e) {}
  }

  // Scan from the parent project root
  const projectRoot = path.resolve(process.cwd(), '..', '..');
  scanForDbs(projectRoot);
  info.foundDbs = foundDbs;
  
  return NextResponse.json(info);
}
