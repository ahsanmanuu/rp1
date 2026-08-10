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

  // Auto-healing fallback: if initial session DB row miss occurs right after login
  if (!sessionRecord && !dbError) {
    try {
      // Decode JWT token payload directly to verify token validity
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadStr);
        if (payload && payload.id && payload.exp && payload.exp * 1000 > Date.now()) {
          const userId = payload.id;
          const expiresAt = new Date(payload.exp * 1000);
          
          // Verify user exists or sync
          let targetUser = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
          if (!targetUser) {
            try {
              const { createPb } = await import("@/lib/pb");
              const pb = createPb();
              pb.authStore.save(token, null);
              const authData = await pb.collection("users").authRefresh().catch(() => null);
              if (authData?.record) {
                const rec = authData.record;
                targetUser = await prisma.user.upsert({
                  where: { id: userId },
                  update: { email: rec.email },
                  create: {
                    id: userId,
                    email: rec.email,
                    name: rec.name || rec.email?.split("@")[0] || "",
                    membership: "free",
                    role: "user",
                    points: 50,
                  }
                }).catch(() => null);
              }
            } catch {}
          }

          if (targetUser) {
            await prisma.userSession.upsert({
              where: { sessionToken: token },
              update: { lastActiveAt: new Date(), expiresAt },
              create: {
                userId,
                sessionToken: token,
                machineId: "auto_healed",
                ipAddress: "127.0.0.1",
                location: "Unknown Location",
                userAgent: req.headers.get("user-agent") || "unknown",
                lastActiveAt: new Date(),
                expiresAt,
              }
            }).catch(() => {});

            sessionRecord = await prisma.userSession.findUnique({
              where: { sessionToken: token },
              include: { user: true }
            }).catch(() => null);
          }
        }
      }
    } catch (healErr) {
      console.warn("[PB-Session API] Auto-heal session check failed:", healErr);
    }
  }

  // DB temporarily unavailable: do not confirm or kill the session, ask the client to retry
  if (dbError) {
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

  const sessionActive =
    !!sessionRecord &&
    !!dbUser &&
    new Date(sessionRecord.expiresAt).getTime() > Date.now();

  // Logged out, expired, or unknown token → unauthenticated
  if (!sessionActive || !dbUser) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null, authenticated: false });
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