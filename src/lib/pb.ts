/**
 * PocketBase server-client singleton & helpers.
 *
 * Usage (server-side / API routes):
 *   import { pb } from '@/lib/pb';
 *   const records = await pb.collection('projects').getFullList();
 *
 * Auth flows:
 *   - User auth: pb.collection('users').authWithPassword(email, password)
 *   - Admin auth: await pbAdmin()
 *
 * After login, store pb.authStore.token / pb.authStore.record in a cookie
 * and rehydrate on each request via setToken().
 */

import PocketBase from 'pocketbase';

if (typeof window === 'undefined') {
  try {
    const { setGlobalDispatcher, Agent } = require('undici');
    setGlobalDispatcher(new Agent({
      connections: 50,
      pipelining: 5,
    }));
    console.log('[PB System] undici global connection pool size configured to 50');
  } catch (err: any) {
    console.warn('[PB System] Failed to configure undici global dispatcher:', err?.message || err);
  }
}

const PB_URL = process.env.POCKETBASE_URL || (typeof window !== 'undefined' ? '/pb' : 'http://127.0.0.1:8090');

/** Fresh unauthenticated client (use for public reads). */
export function createPb() {
  return new PocketBase(PB_URL);
}

const recordCache = new Map<string, { record: any; expiry: number }>();
const recordAuthPromises = new Map<string, Promise<any>>();

/**
 * Server-side PocketBase client rehydrated from an auth token cookie.
 * Automatically loads the user record so authStore.record is available.
 * Cached for 60 seconds to avoid redundant authRefresh calls during concurrent sub-requests.
 * Concurrent requests for the same token are deduplicated using in-flight record promises.
 * Always returns a fresh, independent PocketBase client instance to prevent request contamination.
 */
export async function authFromToken(token: string): Promise<PocketBase> {
  const now = Date.now();

  // Clean up cache if too large
  if (recordCache.size > 1000) {
    for (const [k, v] of recordCache.entries()) {
      if (v.expiry < now) recordCache.delete(k);
    }
  }

  // Create a fresh PocketBase client instance for this request
  const pb = new PocketBase(PB_URL);

  // 1. Check completed cache
  const cached = recordCache.get(token);
  if (cached && cached.expiry > now && cached.record) {
    Object.defineProperty(pb.authStore, 'isTokenExpired', {
      get() { return false; },
      configurable: true
    });
    Object.defineProperty(pb.authStore, 'isValid', {
      get() { return !!pb.authStore.token; },
      configurable: true
    });
    pb.authStore.save(token, cached.record);
    return pb;
  }

  // 2. Fetch session from database first to avoid token invalidation caused by PocketBase authRefresh
  try {
    const { prisma } = await import('./prisma');
    const sessionRecord = await prisma.userSession.findUnique({
      where: { sessionToken: token },
      include: { user: true }
    }).catch(() => null);

    if (sessionRecord && sessionRecord.user && new Date(sessionRecord.expiresAt).getTime() > now) {
      const dbUser = sessionRecord.user;
      const record = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || dbUser.email.split("@")[0] || "",
        avatar: dbUser.avatar,
        theme: dbUser.theme || "dark",
        points: dbUser.points ?? 50,
        membership: dbUser.membership || "free",
        role: dbUser.role || "user",
      };

      // Save to cache
      recordCache.set(token, { record, expiry: now + 60000 });

      Object.defineProperty(pb.authStore, 'isTokenExpired', {
        get() { return false; },
        configurable: true
      });
      Object.defineProperty(pb.authStore, 'isValid', {
        get() { return !!pb.authStore.token; },
        configurable: true
      });
      pb.authStore.save(token, record as any);
      return pb;
    }
  } catch (dbErr) {
    console.warn('[PB System] authFromToken database lookup failed, falling back to PB:', dbErr);
  }

  // 3. Fallback: Check in-flight promise to deduplicate concurrent requests for the same token
  let promise = recordAuthPromises.get(token);
  if (!promise) {
    // Create a temporary client instance just to fetch the record
    const tempPb = new PocketBase(PB_URL);
    
    // Override isValid and isTokenExpired on tempPb so it allows authRefresh even if token is JWT-expired
    Object.defineProperty(tempPb.authStore, 'isTokenExpired', {
      get() { return false; },
      configurable: true
    });
    Object.defineProperty(tempPb.authStore, 'isValid', {
      get() { return !!tempPb.authStore.token; },
      configurable: true
    });
    
    tempPb.authStore.save(token, null);

    promise = (async () => {
      try {
        // Disable auto-cancellation inside PocketBase SDK by setting requestKey: null
        const authData = await tempPb.collection('users').authRefresh({ requestKey: null });
        const record = authData.record;
        recordCache.set(token, { record, expiry: Date.now() + 60000 });
        return record;
      } catch (err: any) {
        if (err?.status === 401) {
          console.log('[PB System] Token is invalid or expired (401)');
        } else {
          console.warn('[PB System] authRefresh failed for token:', err?.message || err);
        }
        throw err;
      } finally {
        recordAuthPromises.delete(token);
      }
    })();
    recordAuthPromises.set(token, promise);
  }

  try {
    const record = await promise;
    Object.defineProperty(pb.authStore, 'isTokenExpired', {
      get() { return false; },
      configurable: true
    });
    Object.defineProperty(pb.authStore, 'isValid', {
      get() { return !!pb.authStore.token; },
      configurable: true
    });
    pb.authStore.save(token, record);
  } catch (err: any) {
    const status = err?.status;
    if (status === 400 || status === 401) {
      // Clear token only if it's explicitly invalid or expired
      pb.authStore.clear();
    } else {
      // Keep token for network/server errors to avoid sudden logouts
      console.warn('[PB System] authRefresh failed with transient/network error. Keeping token.', err?.message || err);
      Object.defineProperty(pb.authStore, 'isTokenExpired', {
        get() { return false; },
        configurable: true
      });
      Object.defineProperty(pb.authStore, 'isValid', {
        get() { return !!pb.authStore.token; },
        configurable: true
      });
      pb.authStore.save(token, null);
    }
  }

  return pb;
}

/**
 * Admin-authenticated PocketBase client.
 * Cached in-memory so we don't re-auth on every request.
 */
let _adminPb: PocketBase | null = null;
let _adminAuthPromise: Promise<PocketBase> | null = null;
let _adminPbFailureAt: number | null = null;
const ADMIN_PB_FAILURE_TTL = 30_000; // 30 seconds — cache "PB is down" state

/** Force-clear the cached admin client so the next pbAdmin() call re-authenticates. */
export function clearAdminCache() {
  _adminPb = null;
  _adminAuthPromise = null;
  _adminPbFailureAt = null;
}

/**
 * Refresh the admin auth by force-clearing cache and re-authenticating.
 * Useful after password changes or when the cached token becomes stale.
 */
export async function refreshAdminAuth(): Promise<PocketBase> {
  clearAdminCache();
  return pbAdmin();
}

/**
 * Get admin credentials — checks pb_data/admin_creds.json first,
 * then env vars, with correct hardcoded defaults as final fallback.
 */
function getAdminCredentials(): { email: string; password: string } {
  const defaultEmail = 'admin@latexify.io';
  const defaultPassword = 'Sczone@123';

  let email = defaultEmail;
  let password = defaultPassword;

  try {
    if (typeof window === 'undefined') {
      const fs = require('fs');
      const path = require('path');
      // Check PB_DATA_DIR first (Render persistent disk), then default pb_data, then root
      const pbDataDir = process.env.PB_DATA_DIR || path.join(process.cwd(), 'pb_data');
      const candidates = [
        path.join(pbDataDir, 'admin_creds.json'),
        path.join(process.cwd(), 'admin_creds.json'),
      ];
      for (const credsPath of candidates) {
        if (fs.existsSync(credsPath)) {
          const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
          if (data.email) email = data.email;
          if (data.password) password = data.password;
          return { email, password };
        }
      }
    }
  } catch (err) {
    // Non-fatal
  }

  // Fallback to env vars (ignore the stale old default 'admin123456')
  const envEmail = process.env.POCKETBASE_ADMIN_EMAIL;
  let envPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (envEmail) email = envEmail;
  if (envPassword) {
    if (envPassword === 'admin123456') envPassword = undefined;
    if (envPassword) password = envPassword;
  }

  return { email, password };
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

/** Quick health check — is PocketBase reachable? Avoids triggering a full auth flow. */
export async function isPocketBaseReachable(): Promise<boolean> {
  try {
    const res = await fetch(PB_URL + '/api/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pbAdmin(): Promise<PocketBase> {
  // Return cached valid client
  if (_adminPb) {
    if (_adminPb.authStore.isValid) {
      return _adminPb;
    }
    _adminPb = null;
    _adminAuthPromise = null;
  }

  // If a recent auth attempt failed, don't retry for a while
  if (_adminPbFailureAt && Date.now() - _adminPbFailureAt < ADMIN_PB_FAILURE_TTL) {
    throw new Error('PocketBase is unreachable (cached)');
  }

  // Deduplicate concurrent auth requests
  if (_adminAuthPromise) {
    return _adminAuthPromise;
  }

  const pb = new PocketBase(PB_URL);
  const { email, password } = getAdminCredentials();

  // Try to load cached token from disk first to bypass costly authWithPassword (bcrypt)
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const pbDataDir = process.env.PB_DATA_DIR || path.join(process.cwd(), 'pb_data');
      const tokenPath = path.join(pbDataDir, 'admin_token.json');
      if (fs.existsSync(tokenPath)) {
        const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (data.token && data.model && data.email === email) {
          const payload = JSON.parse(base64UrlDecode(data.token.split('.')[1]));
          const now = Date.now();
          if (payload.exp && payload.exp * 1000 > now) {
            pb.authStore.save(data.token, data.model);
            _adminPb = pb;
            return pb;
          }
        }
      }
    } catch {}
  }

  _adminAuthPromise = (async () => {
    // PocketBase v0.23+: admins are now _superusers collection
    await pb.collection('_superusers').authWithPassword(email, password);

    // Save token to disk for caching across hot-reloads
    if (typeof window === 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const pbDataDir = process.env.PB_DATA_DIR || path.join(process.cwd(), 'pb_data');
        const tokenPath = path.join(pbDataDir, 'admin_token.json');
        fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
        fs.writeFileSync(tokenPath, JSON.stringify({
          token: pb.authStore.token,
          model: pb.authStore.record,
          email,
        }, null, 2));
      } catch {}
    }

    _adminPb = pb;
    _adminAuthPromise = null;
    return pb;
  })().catch((err) => {
    _adminAuthPromise = null;
    _adminPbFailureAt = Date.now();
    throw err;
  });

  return _adminAuthPromise;
}

/** Reverse map: PB field name → Prisma relation name.
 *  PB stores relation fields as userId/aiCapPlanId, but Prisma refers to them as user/aiCapPlan.
 *  When PB returns expanded data under expand.userId, we rename it to user.
 */
const EXPAND_FIELD_REVERSE_MAP: Record<string, string> = {
  userId: 'user',
  aiCapPlanId: 'aiCapPlan',
};

function parseDate(val: any): any {
  if (typeof val === 'string' && val.length >= 10) {
    const isDatePattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (isDatePattern) {
      const d = new Date(val.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  return val;
}

/**
 * Convert PocketBase record list to plain objects with
 * id / created / updated mapped to the Prisma convention.
 */
export function mapRecord<T = any>(r: any): T {
  if (!r) return null as any;
  const o: Record<string, any> = { id: r.id };
  o.createdAt = r.created ? parseDate(r.created) : (r.updated ? parseDate(r.updated) : new Date());
  o.updatedAt = r.updated ? parseDate(r.updated) : o.createdAt;
  for (const k of Object.keys(r)) {
    if (!['id', 'collectionId', 'collectionName', 'created', 'updated', 'expand'].includes(k)) {
      const val = r[k];
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        o[k] = JSON.stringify(val);
      } else {
        o[k] = parseDate(val);
      }
    }
  }
  if (r.expand && typeof r.expand === 'object') {
    for (const [ek, ev] of Object.entries(r.expand)) {
      const prismaKey = EXPAND_FIELD_REVERSE_MAP[ek] || ek;
      o[prismaKey] = Array.isArray(ev) ? ev.map(mapRecord) : mapRecord(ev);
    }
  }
  if (o.collaborators === undefined) o.collaborators = [];
  if (o.files === undefined) o.files = [];
  return o as T;
}

export function mapList<T = any>(list: any[]): T[] {
  return list.map((r) => mapRecord<T>(r));
}
