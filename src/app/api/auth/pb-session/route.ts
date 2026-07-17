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

  const pb = await getAuthPb();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    response.headers.append("Set-Cookie", "pb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return response;
  }

  // Validate session exists in DB
  let sessionRecord = null;
  let dbError = false;
  try {
    sessionRecord = await prisma.userSession.findUnique({
      where: { sessionToken: token }
    });
  } catch (dbErr) {
    console.error("[PB-Session API] Database session validation query failed:", dbErr);
    dbError = true;
  }

  // Only fail auth and delete cookie if the database query succeeded and found no session record
  if (!dbError && !sessionRecord) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    response.headers.append("Set-Cookie", "pb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return response;
  }

  // If expired, fail auth and delete cookie
  if (sessionRecord && new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    try { cookieStore.delete('pb_token'); } catch {}
    const response = NextResponse.json({ user: null }, { status: 401 });
    Object.entries(noCacheHeaders).forEach(([k, v]) => response.headers.set(k, v));
    response.headers.append("Set-Cookie", "pb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return response;
  }

  const record = pb.authStore.record;
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

  const response = NextResponse.json({ user, token });
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.append("Set-Cookie", setAuthCookie(token));
  return response;
}
