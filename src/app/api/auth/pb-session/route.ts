import { NextRequest, NextResponse } from "next/server";
import { getAuthPb } from "@/lib/auth-pb";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('pb_token')?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const pb = await getAuthPb();
  if (!pb.authStore.isValid || !pb.authStore.record) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Validate session exists in DB
  const sessionRecord = await prisma.userSession.findUnique({
    where: { sessionToken: token }
  }).catch(() => null);

  if (!sessionRecord || new Date(sessionRecord.expiresAt).getTime() < Date.now()) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.headers.append("Set-Cookie", "pb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return response;
  }

  // Dynamically detect user IP or location changes and update sessions
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

      // Update Prisma
      await prisma.userSession.update({
        where: { id: sessionRecord.id },
        data: {
          ipAddress: nextIp,
          location: nextLoc,
        }
      }).catch(() => null);

      // Update PocketBase
      try {
        const { pbAdmin } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        const pbRecord = await admPb.collection("user_sessions").getFirstListItem(`sessionToken = "${token}"`);
        if (pbRecord) {
          await admPb.collection("user_sessions").update(pbRecord.id, {
            ipAddress: nextIp,
            location: nextLoc,
          });
        }
      } catch (pbErr: any) {
        console.error("[SESSION] PocketBase user_sessions dynamic location update failed:", pbErr.message);
      }
    }
  } catch (err: any) {
    console.error("[SESSION] Live geolocation dynamic update failed:", err.message);
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

  return NextResponse.json({ user, token });
}
