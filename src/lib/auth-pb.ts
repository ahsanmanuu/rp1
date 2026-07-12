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
  const pb = await getAuthPb();
  if (!pb.authStore.isValid) return null;
  return pb.authStore.record?.id || null;
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
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  const pb = await getAuthPb();
  if (!pb.authStore.isValid || !pb.authStore.record) return null;

  // Validate session exists in DB
  const sessionRecord = await prisma.userSession.findUnique({
    where: { sessionToken: token }
  }).catch(() => null);

  if (!sessionRecord || new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    return null;
  }

  const record = pb.authStore.record;
  const user: PbSessionUser = {
    id: record.id,
    email: record.email || "",
    name: record.name || record.email?.split("@")[0] || "",
    image: record.avatar ? pb.files.getUrl(record, record.avatar) : null,
    points: record.points ?? 50,
    theme: record.theme || "dark",
    membership: record.membership || "free",
    role: record.role || "user",
  };

  return { user };
}
