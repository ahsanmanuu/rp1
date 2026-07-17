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

  // Validate session exists in DB first to handle database availability correctly
  let sessionRecord = null;
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
  if (dbError) {
    const response = NextResponse.json({ error: "Authentication service temporarily unavailable" }, { status: 503 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // Only fail auth and delete cookie if the database query explicitly succeeded and found no session record
  if (!sessionRecord) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // If expired, fail auth and delete cookie
  if (new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  const pb = await getAuthPb();
  let record = pb.authStore.record;

  // Heal/Restore session record from database if PocketBase failed to connect or refresh
  if (!record && sessionRecord.user) {
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

  if (!record) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
  const user = {
    id: record.id,
    email: record.email,
    name: record.name || record.email?.split("@")[0] || "",
    image: record.avatar ? pb.files.getUrl(record, record.avatar) : null,
    theme: record.theme || "dark",
    points: record.points ?? 50,
    membership: record.membership || "free",
    role: record.role || "user",
  };

  // Fire-and-forget: update IP/location in background (non-blocking)
  Promise.resolve().then(async () => {
    try {
      const { getClientGeoInfo } = await import("@/lib/clientGeo");
      const geo = await getClientGeoInfo(req);

      const currentIp = geo.ipAddress;
      const currentLoc = geo.location || "Unknown Location";

      const ipChanged = currentIp && currentIp !== sessionRecord.ipAddress;
      const locChanged = currentLoc && currentLoc !== "Unknown Location" && currentLoc !== sessionRecord.location;

      if (ipChanged || locChanged) {
        const nextIp = currentIp || sessionRecord.ipAddress;
        const nextLoc = (currentLoc && currentLoc !== "Unknown Location") ? currentLoc : sessionRecord.location;

        prisma.userSession.update({
          where: { id: sessionRecord.id },
          data: { ipAddress: nextIp, location: nextLoc }
        }).catch(() => null);

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
      }
    } catch {}
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
