/**
 * PocketBase Auth — replaces NextAuth for user authentication.
 *
 * Flow:
 *   1. User logs in via POST /api/auth/pb-login  →  pb.collection('users').authWithPassword()
 *   2. Server stores the returned token in an HTTP-only cookie "pb_token"
 *   3. Subsequent requests read the cookie and rehydrate pb.authStore
 *   4. pb.authStore.isValid / pb.authStore.record.id identifies the user
 */

import { cookies, headers } from 'next/headers';
import { createPb, authFromToken } from './pb';
import { prisma } from './prisma';

const TOKEN_COOKIE = 'pb_token';

/** Authenticate a user by email + password. Returns the PocketBase client with auth. */
export async function loginUser(email: string, password: string) {
  const pb = createPb();
  await pb.collection('users').authWithPassword(email, password);
  return pb;
}

/** Get a PocketBase client rehydrated from the request cookie. */
export async function getAuthPb() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return createPb();
  return authFromToken(token);
}

/** Get the currently authenticated user ID from the cookie, or null. */
export async function getUserId(): Promise<string | null> {
  try {
    const pb = await getAuthPb();
    if (!pb.authStore.isValid) return null;
    return pb.authStore.record?.id || null;
  } catch (err) {
    return null;
  }
}

/** Set the auth cookie on the response (call after successful login). */
export function setAuthCookie(token: string) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Clear the auth cookie (call on logout). */
export function clearAuthCookie() {
  return `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Drop-in replacement for NextAuth's getServerSession(authOptions).
 *
 * Usage (in API routes):
 *   import { getServerSession } from "@/lib/auth-pb";
 *   const session = await getServerSession();
 *   if (!session) return new Response("Unauthorized", { status: 401 });
 *   const userId = session.user.id;
 *
 * Returns { user: { id, email, name, image, points, theme, membership, role } }
 * or null if not authenticated.
 */
export interface PbSessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  points: number;
  theme: string;
  membership: string;
  role: string;
}

export interface PbServerSession {
  user: PbSessionUser;
}

export async function getServerSession(): Promise<PbServerSession | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(TOKEN_COOKIE)?.value;

    // Fallback: accept Bearer token from Authorization header (client-side
    // hooks send this when the httpOnly cookie isn't available).
    if (!token) {
      try {
        const hdrs = await headers();
        const authHeader = hdrs.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim() || undefined;
        }
      } catch {}
    }

    if (!token) return null;

    // ── Parallel auth: PB token validation + DB session lookup ────────────
    // The DB row is the source of truth for active sessions (makes logout
    // stick), but PB authRefresh can validate the token directly when the DB
    // adapter is temporarily unreachable. Try both and merge results.
    let pb: Awaited<ReturnType<typeof authFromToken>> | null = null;
    let sessionRecord: any = null;

    const pbPromise = authFromToken(token).catch((err) => {
      console.warn("[AUTH] authFromToken failed:", err?.message || err);
      return null;
    });

    const dbPromise = prisma.userSession.findUnique({
      where: { sessionToken: token },
      include: { user: true }
    }).catch((dbErr: any) => {
      console.error("[AUTH] Database session validation query failed:", dbErr?.message || dbErr);
      return null;
    });

    [pb, sessionRecord] = await Promise.all([pbPromise, dbPromise]);

    const pbRecord: any = pb?.authStore?.record;

    // ── Auto-heal: session row missing but JWT may still be valid ─────────
    if (!sessionRecord && pbRecord) {
      try {
        const userId = pbRecord.id;
        const payloadStr = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
        const expiresAt = new Date((payload?.exp || Date.now() / 1000 + 86400) * 1000);

        let targetUser = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
        if (!targetUser) {
          targetUser = await prisma.user.upsert({
            where: { id: userId },
            update: { email: pbRecord.email },
            create: {
              id: userId,
              email: pbRecord.email,
              name: pbRecord.name || pbRecord.email?.split('@')[0] || '',
              membership: 'free',
              role: 'user',
              points: 50,
            }
          }).catch(() => null);
        }

        if (targetUser) {
          await prisma.userSession.upsert({
            where: { sessionToken: token },
            update: { lastActiveAt: new Date(), expiresAt },
            create: {
              userId,
              sessionToken: token,
              machineId: 'auto_healed',
              ipAddress: '127.0.0.1',
              location: 'Auto-healed',
              userAgent: 'auto-heal',
              lastActiveAt: new Date(),
              expiresAt,
            }
          }).catch(() => {});

          sessionRecord = await prisma.userSession.findUnique({
            where: { sessionToken: token },
            include: { user: true }
          }).catch(() => null);
        }
      } catch (e) {
        console.warn("[AUTH] Auto-heal failed:", e);
      }
    }

    // ── Build session from whichever auth source succeeded ────────────────
    // If we have a PB record, use it as the identity source.
    // If we have a DB session record, check expiry and use its user data.
    // Only fail if BOTH are missing.
    if (!pbRecord && (!sessionRecord || !sessionRecord.user)) {
      console.warn("[AUTH] No valid auth from PB or DB — returning null");
      return null;
    }

    // If DB record exists, verify it hasn't expired (logout sets expiresAt in the past)
    if (sessionRecord?.expiresAt && new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
      return null;
    }

    let record: any = pbRecord;
    if (!record && sessionRecord?.user) {
      const dbUser = sessionRecord.user;
      record = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || dbUser.email.split("@")[0] || "",
        avatar: dbUser.avatar,
        theme: dbUser.theme || "dark",
        points: dbUser.points ?? 50,
        membership: dbUser.membership || "free",
        role: dbUser.role || "user",
      };
    }

    const user: PbSessionUser = {
      id: record.id,
      email: record.email || "",
      name: record.name || record.email?.split("@")[0] || "",
      image: record.avatar && pb ? pb.files.getUrl(record, record.avatar) : null,
      points: record.points ?? 50,
      theme: record.theme || "dark",
      membership: record.membership || "free",
      role: record.role || "user",
    };

    return { user };
  } catch (outerErr) {
    console.warn("[AUTH] getServerSession failed unexpectedly:", outerErr);
    return null;
  }
}