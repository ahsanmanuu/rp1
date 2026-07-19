import toast from "react-hot-toast";

export interface OfflineSyncQueueEntry {
  id: string;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  attempts: number;
}

const QUEUE_KEY = "latexify_offline_sync_queue";
const CACHE_PREFIX = "latexify_get_cache_";

// Helper to check if a URL is syncable (mutating and part of standard workflows)
export function isSyncableUrl(url: string, method: string): boolean {
  const cleanUrl = url.split("?")[0];
  const mutableMethods = ["POST", "PUT", "DELETE", "PATCH"];
  
  if (!mutableMethods.includes(method.toUpperCase())) return false;

  // Syncable endpoints
  const syncablePatterns = [
    /^\/api\/projects/,
    /^\/api\/chat\/message/,
    /^\/api\/chat\/session/,
    /^\/api\/support\/tickets/,
    /^\/api\/admin\/help/,
    /^\/api\/admin\/offers/,
    /^\/api\/admin\/announcements/,
    /^\/api\/user\/check-membership/,
    /^\/api\/auth\/profile/
  ];

  return syncablePatterns.some(pattern => pattern.test(cleanUrl));
}

// Queue a mutating request to localStorage
export function enqueueRequest(url: string, method: string, body: any, headers: Record<string, string> = {}) {
  if (typeof window === "undefined") return;

  try {
    const queue = getSyncQueue();
    const entry: OfflineSyncQueueEntry = {
      id: "sync-" + Math.random().toString(36).substring(2) + "-" + Date.now(),
      url,
      method,
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        ...headers,
        "Content-Type": headers["Content-Type"] || "application/json",
      },
      timestamp: Date.now(),
      attempts: 0,
    };

    queue.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    toast.success("Working offline. Your changes will sync automatically once online.", {
      id: "offline-queue-toast",
      duration: 4000,
    });
    console.log("[OfflineSync] Request queued successfully:", entry);
  } catch (err) {
    console.error("[OfflineSync] Failed to enqueue request:", err);
  }
}

// Get all items in the queue
export function getSyncQueue(): OfflineSyncQueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Clear the queue
export function clearSyncQueue() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUEUE_KEY);
}

// Replay all queued requests sequentially
export async function replaySyncQueue() {
  if (typeof window === "undefined") return;

  const queue = getSyncQueue();
  if (queue.length === 0) return;

  console.log(`[OfflineSync] Found ${queue.length} queued operations. Starting background replay...`);
  const toastId = toast.loading(`Syncing ${queue.length} offline changes...`);

  let successCount = 0;
  const remainingQueue: OfflineSyncQueueEntry[] = [];

  for (const entry of queue) {
    entry.attempts += 1;
    try {
      // Re-trigger the fetch request using the original parameters.
      // We skip the monkey-patch check by calling window.fetch which is patched, 
      // but since navigator.onLine is true now, it will go through to the network.
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });

      if (response.ok) {
        successCount++;
        // Log sync event on the server database
        try {
          await fetch("/api/sync/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: `SYNC_${entry.method}_${entry.url.split("?")[0].replace(/\//g, "_").toUpperCase()}`,
              status: "SUCCESS",
              details: `Sync of offline operation to ${entry.url} succeeded after ${entry.attempts} attempt(s).`,
            }),
          });
        } catch (logErr) {
          console.warn("[OfflineSync] Failed to audit sync log to server:", logErr);
        }
      } else {
        console.warn(`[OfflineSync] Queue entry ${entry.id} failed with server status: ${response.status}`);
        remainingQueue.push(entry);
      }
    } catch (err: any) {
      console.error(`[OfflineSync] Failed to replay queue entry ${entry.id}:`, err);
      remainingQueue.push(entry);
    }
  }

  // Update the queue with remaining failed tasks
  if (remainingQueue.length > 0) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    toast.error(`Sync partially failed. ${remainingQueue.length} operations will be retried later.`, {
      id: toastId,
    });
  } else {
    localStorage.removeItem(QUEUE_KEY);
    toast.success(`Successfully synchronized all ${successCount} offline changes!`, {
      id: toastId,
    });
  }
}

// Cache a successful GET response
export function cacheGetResponse(url: string, data: any) {
  if (typeof window === "undefined" || !url) return;
  // Don't cache specific non-cacheable API endpoints
  if (url.includes("/api/auth/session") || url.includes("/api/chat/messages") || url.includes("/api/admin/chat/heartbeat")) {
    return;
  }
  try {
    const key = CACHE_PREFIX + url;
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    try {
      // Evict stale cache entries (older than 30 minutes) to free space
      const cutoff = Date.now() - 30 * 60 * 1000;
      const keysToEvict: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) || '{}');
            if (!parsed.timestamp || parsed.timestamp < cutoff) keysToEvict.push(k);
          } catch { keysToEvict.push(k); }
        }
      }
      keysToEvict.forEach(k => localStorage.removeItem(k));
      if (keysToEvict.length === 0) return; // Nothing to evict, give up
      // Retry after eviction
      const key = CACHE_PREFIX + url;
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // Still no space — silently skip
    }
  }
}

// Retrieve a cached GET response
export function getCachedGetResponse(url: string): any | null {
  if (typeof window === "undefined" || !url) return null;
  try {
    const key = CACHE_PREFIX + url;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    console.log(`[OfflineSync] Serving cached data for ${url} (Cached at: ${new Date(parsed.timestamp).toLocaleTimeString()})`);
    return parsed.data;
  } catch {
    return null;
  }
}
