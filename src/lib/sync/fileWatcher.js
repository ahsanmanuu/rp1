import fs from "fs";
import path from "path";

const DEFAULT_WATCHED_PATHS = [
  "src",
  "scripts",
  "prisma/schema.prisma",
  "public",
  "next.config.ts",
  "package.json",
];

const IGNORED_PATTERNS = [
  /node_modules/,
  /\.next/,
  /pb_data/,
  /\.git/,
  /\.sync-queue\.json/,
  /startup\.log/,
  /prisma\/dev\.db/,
  /prisma\/migrations/,
  /\.env/,
  /public\/uploads/,
  /scratch/,
];

function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

function getRelativePath(absolutePath) {
  const cwd = process.cwd().replace(/\\/g, "/");
  const normalized = absolutePath.replace(/\\/g, "/");
  if (normalized.startsWith(cwd + "/")) {
    return normalized.slice(cwd.length + 1);
  }
  return normalized;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export class FileWatcher {
  constructor(watchedPaths, debounceMs) {
    this.watchers = [];
    this.callback = null;
    this.watching = false;
    this.debounceTimers = new Map();
    this.watchedPaths = watchedPaths || DEFAULT_WATCHED_PATHS;
    this.debounceMs = debounceMs || 2000;
  }

  onDidChange(callback) {
    this.callback = callback;
  }

  emitDebounced(relativePath, action) {
    const key = `${action}:${relativePath}`;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        if (this.callback) {
          this.callback({ relativePath, action, timestamp: Date.now() });
        }
      }, this.debounceMs)
    );
  }

  getResolvedPaths() {
    const cwd = process.cwd();
    const resolved = [];
    for (const p of this.watchedPaths) {
      const fullPath = path.resolve(cwd, p);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          resolved.push(fullPath);
        } else if (fs.statSync(fullPath).isFile()) {
          resolved.push(fullPath);
        }
      } catch {
      }
    }
    return resolved;
  }

  start() {
    if (this.watching) return;
    this.watching = true;

    const resolvedPaths = this.getResolvedPaths();
    console.log(`[FileWatcher] Watching ${resolvedPaths.length} paths for changes...`);

    for (const targetPath of resolvedPaths) {
      this.watchPath(targetPath);
    }
  }

  watchPath(targetPath) {
    try {
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        this.watchSingleFile(targetPath);
        return;
      }

      const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.resolve(targetPath, filename);
        const relativePath = getRelativePath(fullPath);

        if (shouldIgnore(relativePath)) return;
        if (relativePath === ".sync-queue.json") return;

        let action;
        switch (eventType) {
          case "rename":
            action = fileExists(fullPath) ? "added" : "deleted";
            break;
          case "change":
            action = "modified";
            break;
          default:
            action = "modified";
        }

        this.emitDebounced(relativePath, action);
      });

      watcher.on("error", (err) => {
        console.error(`[FileWatcher] Error watching ${targetPath}:`, err.message);
      });

      this.watchers.push(watcher);
    } catch (err) {
      console.error(`[FileWatcher] Failed to watch ${targetPath}:`, err.message);
    }
  }

  watchSingleFile(filePath) {
    try {
      const directory = path.dirname(filePath);
      const basename = path.basename(filePath);

      const watcher = fs.watch(directory, (eventType, filename) => {
        if (filename !== basename) return;
        const relativePath = getRelativePath(filePath);

        if (shouldIgnore(relativePath)) return;

        let action;
        switch (eventType) {
          case "rename":
            action = fileExists(filePath) ? "added" : "deleted";
            break;
          case "change":
            action = "modified";
            break;
          default:
            action = "modified";
        }

        this.emitDebounced(relativePath, action);
      });

      watcher.on("error", (err) => {
        console.error(`[FileWatcher] Error watching file ${filePath}:`, err.message);
      });

      this.watchers.push(watcher);
    } catch (err) {
      console.error(`[FileWatcher] Failed to watch file ${filePath}:`, err.message);
    }
  }

  stop() {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {}
    }
    this.watchers = [];
    this.watching = false;

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    console.log("[FileWatcher] Stopped.");
  }

  isWatching() {
    return this.watching;
  }
}
