// In-memory token-bucket rate limiter for the edge middleware.
//
// This is intentionally dependency-free (Web APIs only) and stores buckets on
// globalThis so they survive across requests within a single server instance.
// Limits are deliberately generous so normal multi-request workflows (dashboards,
// chat, compile, AI agents) are never throttled — only abusive traffic is.

export interface RateLimitConfig {
  // Maximum tokens the bucket can hold (burst capacity).
  burst: number;
  // Tokens refilled per window.
  refillPerWindow: number;
  // Length of the refill window in milliseconds.
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the next token is available
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const globalRef = globalThis as unknown as { __secRateLimitStore?: Map<string, Bucket> };
const store: Map<string, Bucket> = globalRef.__secRateLimitStore ?? (globalRef.__secRateLimitStore = new Map());

// Best-effort eviction so the map does not grow unbounded on long-lived nodes.
const MAX_KEYS = 200_000;
function maybeEvict(): void {
  if (store.size > MAX_KEYS) {
    const it = store.keys().next();
    if (!it.done) store.delete(it.value);
  }
}

export function checkRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const refillPerMs = cfg.refillPerWindow / cfg.windowMs;

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { tokens: cfg.burst, updatedAt: now };
    store.set(key, bucket);
    maybeEvict();
  }

  const elapsed = now - bucket.updatedAt;
  bucket.tokens = Math.min(cfg.burst, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 };
  }

  const needed = 1 - bucket.tokens;
  const retryAfter = Math.max(1, Math.ceil(needed / refillPerMs / 1000));
  return { allowed: false, remaining: 0, retryAfter };
}
