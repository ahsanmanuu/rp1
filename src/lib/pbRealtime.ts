/**
 * Shared PocketBase realtime client manager.
 *
 * Consolidates all PB SSE subscriptions into ONE connection per auth token,
 * instead of every hook opening its own /api/realtime connection.
 *
 * Features:
 *  - Ref-counted subscriptions (multiple hooks on the same collection/topic
 *    share one PB subscribe).
 *  - Per-subscription token provider (pb_token cookie for users,
 *    latexify-admin-token for admin pages).
 *  - Automatic re-subscription when the auth token changes (PB tokens are JWTs;
 *    session refreshes produce a new token).
 *  - Automatic reconnect with backoff when the connection drops.
 *  - Cleanup on unsubscribe / hot reload.
 */

import { createPb } from './pb';

export interface RealtimeEvent {
  action: 'create' | 'update' | 'delete';
  record: any;
  [key: string]: any;
}

export type TokenProvider = () => string | null;

export interface PbSubscribeOptions {
  filter?: string;
  tokenProvider?: TokenProvider;
}

const DEFAULT_TOKEN_PROVIDER: TokenProvider = () => {
  if (typeof window === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)pb_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

/** Admin pages subscribe with the superuser token (localStorage) when available. */
export const adminTokenProvider: TokenProvider = () => {
  if (typeof window === 'undefined') return null;
  const t = localStorage.getItem('latexify-admin-token');
  if (t) return t;
  const m = document.cookie.match(/(?:^|;\s*)pb_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

interface RegisteredSub {
  collection: string;
  topic: string;
  filter?: string;
  providerId: number;
  handlers: Set<(e: RealtimeEvent) => void>;
  /** Per-connection unsubscribe returned by the PB SDK. */
  unsub?: () => void;
  /** Set when the SDK subscribe is in flight. */
  pending?: Promise<void>;
}

const subs = new Map<string, RegisteredSub>();
const providers = new Map<number, { tokenProvider: TokenProvider; client: any | null; lastToken: string | null }>();
let nextProviderId = 1;
let checkTimer: ReturnType<typeof setInterval> | null = null;
let disposed = false;

function providerIdFor(tokenProvider?: TokenProvider): number {
  const tp = tokenProvider || DEFAULT_TOKEN_PROVIDER;
  for (const [id, p] of providers) {
    if (p.tokenProvider === tp) return id;
  }
  const id = nextProviderId++;
  providers.set(id, { tokenProvider: tp, client: null, lastToken: null });
  return id;
}

function subKey(collection: string, topic: string, filter?: string, providerId?: number): string {
  return `${providerId ?? 0}|${collection}|${topic}|${filter || ''}`;
}

function ensureClient(provider: { tokenProvider: TokenProvider; client: any | null; lastToken: string | null }): { client: any | null; token: string | null } {
  const token = provider.tokenProvider();
  if (!token) return { client: null, token: null };
  if (provider.client && provider.lastToken === token) {
    return { client: provider.client, token };
  }
  // Token changed or first connect — (re)create the client with the new token.
  try {
    provider.client?.realtime?.unsubscribe?.();
  } catch {}
  provider.client = null;
  const pb = createPb();
  pb.authStore.save(token, null);
  provider.client = pb;
  provider.lastToken = token;
  return { client: pb, token };
}

async function activateSub(reg: RegisteredSub): Promise<void> {
  const provider = providers.get(reg.providerId);
  if (!provider) return;
  const { client, token } = ensureClient(provider);
  if (!client || !token) return;

  if (reg.unsub) return; // already active

  try {
    const opts: Record<string, any> = {};
    if (reg.filter) opts.filter = reg.filter;
    const unsub = await client.collection(reg.collection).subscribe(
      reg.topic,
      (e: any) => {
        const event: RealtimeEvent = { action: e.action, record: e.record, ...e };
        for (const handler of [...reg.handlers]) {
          try {
            handler(event);
          } catch (err) {
            console.warn(`[pbRealtime] handler error for ${reg.collection}:`, err);
          }
        }
      },
      reg.filter ? opts : undefined,
    );
    reg.unsub = unsub;
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Transient errors (network drop, socket closed) — polling fallback in the
    // hooks keeps data fresh; we retry on the next token check cycle.
    if (!/canceled|cancelled|aborted|collection|something went wrong|unauthorized/i.test(msg)) {
      console.warn(`[pbRealtime] subscribe failed for ${reg.collection}:${reg.topic}:`, msg);
    }
    // Retry once on the next cycle.
    reg.unsub = undefined;
  }
}

async function deactivateSub(reg: RegisteredSub): Promise<void> {
  const provider = providers.get(reg.providerId);
  if (reg.unsub) {
    try {
      reg.unsub();
    } catch {}
    reg.unsub = undefined;
  }
  // Close the shared SSE connection when the provider has no more subs.
  if (provider && subs.size === 0 && provider.client) {
    try {
      provider.client.realtime?.unsubscribe?.();
    } catch {}
    // Sweep dead providers so their clients/tokens don't accumulate.
    for (const [id, p] of providers) {
      try {
        p.client?.realtime?.unsubscribe?.();
      } catch {}
    }
    providers.clear();
  }
}

function scheduleCheck() {
  if (checkTimer || disposed) return;
  checkTimer = setInterval(() => {
    void runCheck();
  }, 10000);
}

async function runCheck() {
  if (disposed) return;
  let hasSubs = false;
  for (const reg of subs.values()) {
    hasSubs = true;
    const provider = providers.get(reg.providerId);
    if (!provider) continue;
    const token = provider.tokenProvider();
    if (token && token !== provider.lastToken) {
      // Token rotated — resubscribe everything for this provider.
      for (const r of subs.values()) {
        if (r.providerId === reg.providerId) {
          await deactivateSub(r);
        }
      }
    }
  }
  // (Re)activate any pending subs (first connect or retry after failures).
  for (const reg of subs.values()) {
    const provider = providers.get(reg.providerId);
    if (!provider || provider.lastToken === null) continue;
    if (!reg.unsub) {
      void activateSub(reg);
    }
  }
  // Stop the timer when nothing is subscribed.
  if (!hasSubs && checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

/**
 * Subscribe to a PocketBase collection's realtime stream.
 * Ref-counted: multiple callers on the same (collection, topic, filter, provider)
 * share a single PB connection.
 *
 * Returns an unsubscribe function.
 */
export function pbSubscribe(
  collection: string,
  topic: string,
  handler: (e: RealtimeEvent) => void,
  options?: PbSubscribeOptions,
): () => void {
  const providerId = providerIdFor(options?.tokenProvider);
  const filter = options?.filter;
  const key = subKey(collection, topic, filter, providerId);

  let reg = subs.get(key);
  if (!reg) {
    reg = {
      collection,
      topic,
      filter,
      providerId,
      handlers: new Set(),
    };
    subs.set(key, reg);
  }
  reg.handlers.add(handler);
  scheduleCheck();
  void activateSub(reg);

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    reg!.handlers.delete(handler);
    if (reg!.handlers.size === 0) {
      subs.delete(key);
      void deactivateSub(reg!);
    }
  };
}

/** Close everything (mainly for tests / full page teardown). */
export function disposePbRealtime() {
  disposed = true;
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  for (const reg of subs.values()) {
    try {
      reg.unsub?.();
    } catch {}
  }
  subs.clear();
  for (const p of providers.values()) {
    try {
      p.client?.realtime?.unsubscribe?.();
    } catch {}
  }
  providers.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => disposePbRealtime(), { once: true });

  const handleWakeReconnect = () => {
    setTimeout(() => {
      if (!disposed) {
        // Re-evaluate client and reconnect any dropped subscriptions after sleep
        void runCheck();
      }
    }, 1200);
  };

  window.addEventListener('online', handleWakeReconnect);
  window.addEventListener('focus', handleWakeReconnect);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handleWakeReconnect();
  });
}
