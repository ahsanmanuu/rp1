import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  const token = bearerToken || cookieStore.get('pb_token')?.value;

  const noCacheHeaders = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "CDN-Cache-Control": "no-store"
  };

  if (!token) {
    const response = NextResponse.json({ user: null, authenticated: false });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // ── Source of truth: the DB UserSession row ────────────────────────────────
  let sessionRecord: Awaited<ReturnType<typeof prisma.userSession.findUnique>> = null;
  let dbError = false;
  try {
    sessionRecord = await prisma.userSession.findUnique({
      where: { sessionToken: token },
      include: { user: true }
    });
  } catch (dbErr) {
    console.error("[PB-Session API] Database session validation query failed:", dbErr);
    dbError = true;
  }

  // If DB returned null and didn't explicitly error, retry once (e.g. during HMR or PB reconnect)
  if (!sessionRecord && !dbError && token) {
    await new Promise(r => setTimeout(r, 400));
    try {
      sessionRecord = await prisma.userSession.findUnique({
        where: { sessionToken: token },
        include: { user: true }
      });
    } catch {
      dbError = true;
    }
  }

  // Check direct PocketBase token validation as fallback before deciding 401
  let pbDirectUser: any = null;
  if (!sessionRecord || dbError) {
    try {
      const { authFromToken } = await import("@/lib/pb");
      const pb = await authFromToken(token);
      if (pb?.authStore?.isValid && pb?.authStore?.record) {
        pbDirectUser = pb.authStore.record;
      }
    } catch (pbErr) {
      // Non-fatal
    }
  }

  // DB temporarily unavailable and direct PB validation didn't work: ask client to retry (503)
  if (dbError && !pbDirectUser) {
    const response = NextResponse.json({ error: "Authentication service temporarily unavailable" }, { status: 503 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  let dbUser = (sessionRecord as any)?.user;
  if (!dbUser && (sessionRecord as any)?.userId) {
    dbUser = await prisma.user.findUnique({
      where: { id: (sessionRecord as any).userId }
    }).catch(() => null);
  }

  // Fallback to pbDirectUser if DB user is missing
  if (!dbUser && pbDirectUser) {
    dbUser = {
      id: pbDirectUser.id,
      email: pbDirectUser.email,
      name: pbDirectUser.name || pbDirectUser.email?.split("@")[0] || "User",
      avatar: pbDirectUser.avatar,
      theme: pbDirectUser.theme || "dark",
      points: pbDirectUser.points ?? 50,
      membership: pbDirectUser.membership || "free",
      role: pbDirectUser.role || "user",
    };
  }

  const sessionActive =
    (!!sessionRecord && !!dbUser && new Date(sessionRecord.expiresAt).getTime() > Date.now()) ||
    (!!pbDirectUser && !!dbUser);

  // Logged out, expired, or truly invalid token → unauthenticated
  if (!sessionActive || !dbUser) {
    const response = NextResponse.json({ user: null, authenticated: false }, { status: 401 });
    const AUTH_COOKIE_NAMES = ['pb_token', 'admin_session', 'next-auth.session-token', '__Secure-next-auth.session-token'];
    AUTH_COOKIE_NAMES.forEach(c => {
      try { cookieStore.delete(c); } catch {}
      response.cookies.set(c, "", {
        path: "/",
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
    });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // ── Authenticated: resolve the user record ─────────────────────────────────
  const user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || dbUser.email.split("@")[0] || "User",
    image: dbUser.avatar || null,
    theme: dbUser.theme || "dark",
    points: dbUser.points ?? 50,
    membership: dbUser.membership || "free",
    role: dbUser.role || "user",
  };

  // Update IP/location and activity in background (non-blocking)
  if (sessionRecord?.id) {
    Promise.resolve().then(async () => {
      try {
        const { getClientGeoInfo } = await import("@/lib/clientGeo");
        const geo = await getClientGeoInfo(req);

        let nextIp = geo.ipAddress;
        if (!nextIp || nextIp === "127.0.0.1" || nextIp === "::1" || nextIp === "localhost") {
          const forwarded = req.headers.get("x-forwarded-for");
          nextIp = forwarded ? forwarded.split(",")[0].trim() : (sessionRecord?.ipAddress || "127.0.0.1");
        }
        let nextLoc = geo.location;
        if (!nextLoc || nextLoc === "Unknown Location") {
          nextLoc = "Localhost";
        }
        const userAgent = req.headers.get("user-agent") || "Unknown";

        prisma.userSession.update({
          where: { id: sessionRecord!.id },
          data: {
            ipAddress: nextIp,
            location: nextLoc,
            lastActiveAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }
        }).catch(() => null);

        // Always log activity
        const { logUserActivity } = await import("@/lib/security");
        const uid = user.id || sessionRecord!.userId || 'unknown';
        if (uid !== 'unknown') {
          logUserActivity(uid, nextIp || '127.0.0.1', nextLoc || 'Unknown', userAgent).catch(() => {});
        }

        // Update PocketBase user_sessions if exists
        import("@/lib/pb").then(({ pbAdmin }) =>
          pbAdmin().then(admPb =>
            admPb.collection("user_sessions").getFirstListItem(`sessionToken = "${token}"`)
              .then(pbRecord => {
                if (pbRecord) {
                  admPb.collection("user_sessions").update(pbRecord.id, {
                    ipAddress: nextIp, location: nextLoc,
                  }).catch(() => null);
                }
              })
          )
        ).catch(() => null);
      } catch (e) {
        console.warn("[PB-Session API] Failed to update session details:", e);
      }
    });
  }

  // Re-issue the cookie to keep the sliding 7-day window
  cookieStore.set("pb_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
  });

  const response = NextResponse.json({ user, token });
  Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}