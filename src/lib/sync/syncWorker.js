import { FileWatcher } from "./fileWatcher.js";
import { enqueue, dequeue, getQueueLength, peek, markFailed, getAllEntries, clearQueue } from "./syncQueue.js";
import { checkConnectivity, isOnline } from "./connectivityChecker.js";
import { stageAll, commit, pull, push, getStatus, getCurrentBranch, getPendingCommitCount, hasRemoteOrigin } from "./gitManager.js";

export class SyncWorker {
  constructor(syncIntervalMs, retryIntervalMs) {
    this.fileWatcher = new FileWatcher();
    this.syncTimer = null;
    this.retryTimer = null;
    this.running = false;
    this.lastSync = null;
    this.lastSyncResult = null;
    this.syncInProgress = false;
    this.connectivityStatus = "unknown";
    this.connectivityInterval = null;
    this.syncIntervalMs = syncIntervalMs || 60000;
    this.retryIntervalMs = retryIntervalMs || 30000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log("[SyncWorker] Starting background sync worker...");

    this.fileWatcher.onDidChange((event) => {
      console.log(`[SyncWorker] File change detected: ${event.action} ${event.relativePath}`);
      enqueue({
        action: event.action,
        filePath: event.relativePath,
        relativePath: event.relativePath,
      });

      if (!this.syncInProgress) {
        this.performSyncCycle().catch(() => {});
      }
    });
    this.fileWatcher.start();

    this.connectivityInterval = setInterval(async () => {
      const online = await checkConnectivity();
      this.connectivityStatus = online ? "online" : "offline";
      if (online && getQueueLength() > 0 && !this.syncInProgress) {
        console.log(`[SyncWorker] Online restored with ${getQueueLength()} queued items. Starting sync...`);
        this.performSyncCycle().catch(() => {});
      }
    }, this.retryIntervalMs);

    checkConnectivity().then((online) => {
      this.connectivityStatus = online ? "online" : "offline";
    });

    this.syncTimer = setInterval(() => {
      if (!this.syncInProgress) {
        this.performSyncCycle().catch(() => {});
      }
    }, this.syncIntervalMs);

    console.log(`[SyncWorker] Started. Sync every ${this.syncIntervalMs}ms, retry every ${this.retryIntervalMs}ms`);
  }

  stop() {
    this.running = false;
    this.fileWatcher.stop();
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.connectivityInterval) {
      clearInterval(this.connectivityInterval);
      this.connectivityInterval = null;
    }
    console.log("[SyncWorker] Stopped.");
  }

  async performSyncCycle() {
    if (this.syncInProgress) {
      console.log("[SyncWorker] Sync already in progress, skipping...");
      return null;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      const online = await checkConnectivity();
      this.connectivityStatus = online ? "online" : "offline";
      if (!online) {
        console.log("[SyncWorker] Offline, skipping sync cycle.");
        this.lastSyncResult = "failure";
        this.lastSync = new Date().toISOString();
        return { success: false, action: "skip", details: "Offline", timestamp: Date.now() };
      }

      if (!hasRemoteOrigin()) {
        console.log("[SyncWorker] No remote origin configured, skipping git sync.");
        this.lastSyncResult = null;
        this.lastSync = new Date().toISOString();
        return { success: true, action: "noop", details: "No remote origin", timestamp: Date.now() };
      }

      console.log("[SyncWorker] Pulling latest from remote...");
      const pullOk = pull();
      if (!pullOk) {
        console.warn("[SyncWorker] Pull failed, will attempt push anyway.");
      }

      const status = getStatus();
      if (!status.hasChanges && getQueueLength() === 0) {
        console.log("[SyncWorker] No changes to sync.");
        this.lastSyncResult = "success";
        this.lastSync = new Date().toISOString();
        return { success: true, action: "noop", details: "No changes", timestamp: Date.now() };
      }

      console.log(`[SyncWorker] Staging ${status.files.length} changed files...`);
      const stageOk = stageAll();
      if (!stageOk) {
        throw new Error("Failed to stage files");
      }

      const fileSummary = status.files
        .slice(0, 10)
        .map((f) => `${f.status} ${f.path}`)
        .join(", ");
      const summary = status.files.length > 10
        ? `${fileSummary} +${status.files.length - 10} more`
        : fileSummary;
      const commitMsg = `auto-sync: ${status.files.length} file(s) changed — ${summary}`;
      console.log(`[SyncWorker] Committing: ${commitMsg}`);
      const commitOk = commit(commitMsg);
      if (!commitOk) {
        console.log("[SyncWorker] Nothing new to commit.");
      } else {
        console.log("[SyncWorker] Pushing to remote...");
        const pushOk = push();
        if (!pushOk) {
          console.warn("[SyncWorker] Push failed — will retry next cycle.");
          throw new Error("Push failed");
        }
        console.log("[SyncWorker] Push succeeded.");
      }

      clearQueue();

      this.lastSyncResult = "success";
      this.lastSync = new Date().toISOString();
      const elapsed = Date.now() - startTime;
      console.log(`[SyncWorker] Sync cycle completed in ${elapsed}ms`);

      return {
        success: true,
        action: "sync",
        details: `Committed ${status.files.length} file(s) in ${elapsed}ms`,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error("[SyncWorker] Sync cycle failed:", err.message);

      const queueEntries = getAllEntries();
      for (const entry of queueEntries) {
        markFailed(entry);
      }

      this.lastSyncResult = "failure";
      this.lastSync = new Date().toISOString();

      return {
        success: false,
        action: "error",
        details: err.message,
        timestamp: Date.now(),
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  triggerSync() {
    return this.performSyncCycle();
  }

  getStatus() {
    const gitStatus = getStatus();
    return {
      running: this.running,
      queueLength: getQueueLength(),
      lastSync: this.lastSync,
      lastSyncResult: this.lastSyncResult,
      connectivity: this.connectivityStatus,
      watching: this.fileWatcher.isWatching(),
      currentBranch: gitStatus.branch,
      pendingCommits: getPendingCommitCount(),
    };
  }

  isRunning() {
    return this.running;
  }
}

let _instance = null;

export function getSyncWorker() {
  if (!_instance) {
    _instance = new SyncWorker();
  }
  return _instance;
}

export function startSyncWorker() {
  const worker = getSyncWorker();
  worker.start();
  console.log("[SyncWorker] Background auto-sync initialized.");
}

export function stopSyncWorker() {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
