/**
 * PocketBase Auth — replaces NextAuth for user authentication.
 *
 * Flow:
 *   1. User logs in via POST /api/auth/pb-login  →  pb.collection('users').authWithPassword()
 *   2. Server stores the returned token in an HTTP-only cookie "pb_token"
 *   3. Subsequent requests read the cookie and rehydrate pb.authStore
 *   4. pb.authStore.isValid / pb.authStore.record.id identifies the user
 */

import { cookies } from 'next/headers';
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

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(jsonStr);
    if (payload && typeof payload === 'object' && payload.exp && payload.exp * 1000 > Date.now()) {
      return payload;
    }
  } catch {}
  return null;
}

export async function getServerSession(): Promise<PbServerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  let pb;
  try {
    pb = await getAuthPb();
  } catch (err) {
    console.warn("[AUTH] getAuthPb failed in getServerSession, falling back to DB lookup");
  }

  const pbValid = pb && pb.authStore && pb.authStore.isValid && pb.authStore.record;
  const jwtPayload = decodeJwtPayload(token);

  // Validate session exists in DB
  let sessionRecord = null;
  let dbError = false;
  try {
    sessionRecord = await prisma.userSession.findUnique({
      where: { sessionToken: token },
      include: { user: true }
    });
  } catch (dbErr) {
    console.error("[AUTH] Database session validation query failed:", dbErr);
    dbError = true;
  }

  // Only fail auth if PocketBase validation, DB session lookup, AND JWT decoding ALL fail
  if (!pbValid && !sessionRecord && !jwtPayload && !dbError) {
    return null;
  }

  // Check if session has expired (only fail if PocketBase token and JWT payload are also invalid)
  if (!pbValid && !jwtPayload && sessionRecord && new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    return null;
  }

  let record = pb?.authStore?.record;
  
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
    } as any;
  }

  // JWT Payload fallback if DB and PB client failed to rehydrate record
  if (!record && jwtPayload?.id) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: jwtPayload.id } });
      if (dbUser) {
        record = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name || dbUser.email.split("@")[0] || "",
          avatar: dbUser.avatar,
          theme: dbUser.theme || "dark",
          points: dbUser.points ?? 50,
          membership: dbUser.membership || "free",
          role: dbUser.role || "user",
        } as any;
      } else if (jwtPayload.email) {
        record = {
          id: jwtPayload.id,
          email: jwtPayload.email,
          name: jwtPayload.email.split("@")[0] || "",
          avatar: null,
          theme: "dark",
          points: 50,
          membership: "free",
          role: "user",
        } as any;
      }
    } catch (jwtErr) {
      console.warn("[AUTH] JWT payload user lookup failed (non-fatal):", jwtErr);
    }
  }

  if (!record) return null;

  // Auto-heal missing or expired DB userSession when PocketBase JWT / JWT payload is valid
  if ((pbValid || jwtPayload) && (!sessionRecord || new Date(sessionRecord.expiresAt).getTime() < Date.now())) {
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.userSession.upsert({
        where: { sessionToken: token },
        update: { expiresAt, lastActiveAt: new Date() },
        create: {
          userId: record.id,
          sessionToken: token,
          machineId: 'pb_auto_heal',
          ipAddress: '127.0.0.1',
          location: 'Auto-Healed Session',
          userAgent: 'PocketBase Auth',
          expiresAt,
          lastActiveAt: new Date(),
        }
      });
    } catch (healErr) {
      console.warn("[AUTH] Failed to auto-heal DB session record (non-fatal):", healErr);
    }
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
}
