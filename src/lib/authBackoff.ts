/**
 * Module-level singleton managing 401 Unauthorized backoff state.
 * Survives React component re-mounts and Fast Refresh / HMR cycles.
 * Automatically clears blocks when a new auth token is detected.
 */

const blockedEndpoints = new Map<string, number>(); // endpoint -> timestamp blocked
const BLOCK_DURATION_MS = 60_000; // 60s before retry after 401

let lastKnownToken: string | null = null;

/**
 * Check if the auth token has changed. If so, clears all active backoff blocks.
 */
export function checkTokenChange(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const currentToken = localStorage.getItem("auth-token");
    if (currentToken && currentToken !== lastKnownToken) {
      lastKnownToken = currentToken;
      blockedEndpoints.clear();
      return true;
    }
    if (!currentToken && lastKnownToken !== null) {
      lastKnownToken = null;
      blockedEndpoints.clear();
      return true;
    }
  } catch {}
  return false;
}

/**
 * Mark an endpoint as auth-blocked (received 401).
 */
export function markAuthFailed(endpoint: string): void {
  blockedEndpoints.set(endpoint, Date.now());
}

/**
 * Clear the auth block for a specific endpoint.
 */
export function clearAuthFailed(endpoint: string): void {
  blockedEndpoints.delete(endpoint);
}

/**
 * Clear all auth blocks (e.g. upon successful login or manual refresh).
 */
export function clearAllAuthFailed(): void {
  blockedEndpoints.clear();
}

/**
 * Check if an endpoint is currently auth-blocked.
 * Automatically clears block if BLOCK_DURATION_MS has elapsed or token changed.
 */
export function isAuthBlocked(endpoint: string): boolean {
  checkTokenChange();
  const blockedAt = blockedEndpoints.get(endpoint);
  if (!blockedAt) return false;
  if (Date.now() - blockedAt > BLOCK_DURATION_MS) {
    blockedEndpoints.delete(endpoint);
    return false;
  }
  return true;
}
