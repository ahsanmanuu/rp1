const SYNC_INTERVAL_MS = 60000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let lastSync = 0;

export function startBackgroundSync(): void {
  if (syncTimer) return;
  syncTimer = setInterval(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/stats`,
        { method: 'GET', headers: { 'x-internal-sync': 'true' } }
      );
      if (res.ok) {
        lastSync = Date.now();
      }
    } catch {
      // Silently retry on next interval
    }
  }, SYNC_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

export function getLastSyncTime(): number {
  return lastSync;
}
