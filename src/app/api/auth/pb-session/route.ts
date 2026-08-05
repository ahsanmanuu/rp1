import { NextRequest, NextResponse } from "next/server";
import { getAuthPb, setAuthCookie } from "@/lib/auth-pb";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('pb_token')?.value;

  const noCacheHeaders = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "CDN-Cache-Control": "no-store"
  };

  if (!token) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  const decodeJwtPayload = (jwt: string): any => {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;
      const jsonStr = Buffer.from(parts[1], 'base64').toString('utf-8');
      const payload = JSON.parse(jsonStr);
      if (payload && typeof payload === 'object' && payload.exp && payload.exp * 1000 > Date.now()) {
        return payload;
      }
    } catch {}
    return null;
  };

  const jwtPayload = decodeJwtPayload(token);

  // Fast-path: if valid JWT token, resolve user directly via Prisma index (1-2ms)
  // to prevent PocketBase authRefresh network timeouts under high CPU load.
  if (jwtPayload && (jwtPayload.id || jwtPayload.email)) {
    try {
      let dbUser = jwtPayload.id ? await prisma.user.findUnique({ where: { id: jwtPayload.id } }) : null;
      if (!dbUser && jwtPayload.email) {
        dbUser = await prisma.user.findFirst({ where: { email: jwtPayload.email } });
      }
      const user = {
        id: dbUser?.id || jwtPayload.id || "user_session",
        email: dbUser?.email || jwtPayload.email || "",
        name: dbUser?.name || (dbUser?.email || jwtPayload.email || "").split("@")[0] || "User",
        image: dbUser?.avatar || null,
        theme: dbUser?.theme || "dark",
        points: dbUser?.points ?? 50,
        membership: dbUser?.membership || "free",
        role: dbUser?.role || "user",
      };
      const response = NextResponse.json({ user, token });
      Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (fastErr) {
      console.warn("[PB-Session API] Fast-path lookup warning:", fastErr);
    }
  }

  // 1. Try PocketBase token authentication
  let pb;
  try {
    pb = await getAuthPb();
  } catch (err) {
    console.warn("[PB-Session API] getAuthPb failed, falling back to DB lookup");
  }

  const pbValid = pb && pb.authStore && pb.authStore.isValid && pb.authStore.record;

  // 2. Try DB session lookup
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

  // If database query failed temporarily, return 503 Service Unavailable (keep current client session active)
  if (dbError && !pbValid && !jwtPayload) {
    const response = NextResponse.json({ error: "Authentication service temporarily unavailable" }, { status: 503 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // Only fail auth and delete cookie if ALL validation mechanisms (PB, DB, JWT Payload) fail!
  if (!pbValid && !sessionRecord && !jwtPayload) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // If DB session expired AND PocketBase token / JWT payload are invalid, fail auth and delete cookie
  if (!pbValid && !jwtPayload && sessionRecord && new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  let record = pb?.authStore?.record;

  // Heal/Restore session record from database if PocketBase failed to connect or refresh
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
      console.warn("[PB-Session API] JWT user lookup failed (non-fatal):", jwtErr);
    }
  }

  if (!record) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // Auto-heal missing or expired DB userSession when PocketBase JWT or JWT payload is valid
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
      console.warn("[PB-Session API] Auto-heal userSession failed (non-fatal):", healErr);
    }
  }

  const user = {
    id: record.id,
    email: record.email,
    name: record.name || record.email?.split("@")[0] || "",
    image: record.avatar ? pb?.files?.getUrl(record, record.avatar) : null,
    theme: record.theme || "dark",
    points: record.points ?? 50,
    membership: record.membership || "free",
    role: record.role || "user",
  };

  // Update IP/location and activity in background (non-blocking)
  Promise.resolve().then(async () => {
    try {
      const { getClientGeoInfo } = await import("@/lib/clientGeo");
      const geo = await getClientGeoInfo(req);

      let nextIp = geo.ipAddress;
      if (!nextIp || nextIp === "127.0.0.1" || nextIp === "::1" || nextIp === "localhost") {
        const forwarded = req.headers.get("x-forwarded-for");
        nextIp = forwarded ? forwarded.split(",")[0].trim() : (sessionRecord.ipAddress || "127.0.0.1");
      }
      let nextLoc = geo.location;
      if (!nextLoc || nextLoc === "Unknown Location") {
        nextLoc = "Localhost";
      }
      const userAgent = req.headers.get("user-agent") || "Unknown";

      // Always update session in DB — and ROLL the expiry window forward so a
      // long-running operation (e.g. a big DOCX upload + AI analysis that takes
      // 10-30 minutes) can never expire the session mid-flight. The client polls
      // this endpoint every 30s, so this is effectively a sliding 7-day session.
      prisma.userSession.update({
        where: { id: sessionRecord.id },
        data: {
          ipAddress: nextIp,
          location: nextLoc,
          lastActiveAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
      }).catch(() => null);

      // Always log activity
      const { logUserActivity } = await import("@/lib/security");
      const uid = (sessionRecord!.userId ?? sessionRecord!.id ?? 'unknown') as string;
      logUserActivity(uid, nextIp || '127.0.0.1', nextLoc || 'Unknown', userAgent).catch(() => {});

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

  cookieStore.set("pb_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
  });

  const response = NextResponse.json({ user, token });
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("CDN-Cache-Control", "no-store");
  return response;
}
