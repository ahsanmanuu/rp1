import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";
import { getClientGeoInfo } from "@/lib/clientGeo";

export const dynamic = "force-dynamic";

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { "User-Agent": "Latexify/1.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    
    // Extract a clean city/town name
    const address = data?.address;
    if (address) {
      const city = address.city || address.town || address.village || address.municipality || address.suburb;
      if (city) return city;
    }
    
    if (data?.display_name) {
      const parts = data.display_name.split(",").map((p: string) => p.trim());
      if (parts.length > 1) return parts[1];
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  try {
    const latest = await prisma.userSessionActivity.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, latitude: true, longitude: true, location: true, ipAddress: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      location: latest
        ? {
            id: latest.id,
            latitude: latest.latitude,
            longitude: latest.longitude,
            locationName: latest.location,
            ipAddress: latest.ipAddress,
            updatedAt: latest.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { latitude, longitude } = body;

    let locationName = "Unknown Location";
    let lat: number | null = null;
    let lng: number | null = null;

    const geo = await getClientGeoInfo(req);

    if (latitude != null && longitude != null) {
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return NextResponse.json({ error: "latitude and longitude must be numbers" }, { status: 400 });
      }
      lat = latitude;
      lng = longitude;
      locationName = geo?.location || await reverseGeocode(lat, lng) || "Unknown Location";
    } else {
      locationName = geo?.location || "Unknown Location";
    }

    const record = await prisma.userSessionActivity.create({
      data: {
        userId,
        ipAddress: geo?.ipAddress || "0.0.0.0",
        location: locationName,
        latitude: lat,
        longitude: lng,
        userAgent: geo?.userAgent || null,
      },
      select: { id: true, latitude: true, longitude: true, location: true, createdAt: true },
    });

    // Real-time synchronization to PocketBase
    try {
      const { pbAdmin } = await import("@/lib/pb");
      const { ensurePbSessionActivitiesCollectionFields } = await import("@/lib/pb-sync");
      await ensurePbSessionActivitiesCollectionFields();

      const admPb = await pbAdmin();
      await admPb.collection("user_session_activities").create({
        userId,
        ipAddress: geo?.ipAddress || "0.0.0.0",
        location: locationName,
        latitude: lat,
        longitude: lng,
        userAgent: geo?.userAgent || null,
      });
    } catch (pbErr: any) {
      console.error("[LOCATION] Failed to sync session activity to PocketBase:", pbErr.message);
    }

    return NextResponse.json({
      success: true,
      location: {
        id: record.id,
        latitude: record.latitude,
        longitude: record.longitude,
        locationName: record.location,
        updatedAt: record.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
