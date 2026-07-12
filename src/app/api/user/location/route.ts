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
    if (data?.display_name) return data.display_name;
    const parts: string[] = [];
    if (data?.address?.city) parts.push(data.address.city);
    if (data?.address?.state) parts.push(data.address.state);
    if (data?.address?.country) parts.push(data.address.country);
    return parts.length > 0 ? parts.join(", ") : null;
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

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude (numbers) required" }, { status: 400 });
    }

    const geo = await getClientGeoInfo(req);
    const locationName = geo?.location || await reverseGeocode(latitude, longitude) || "Unknown";

    const record = await prisma.userSessionActivity.create({
      data: {
        userId,
        ipAddress: geo?.ipAddress || "0.0.0.0",
        location: locationName,
        latitude,
        longitude,
        userAgent: geo?.userAgent || null,
      },
      select: { id: true, latitude: true, longitude: true, location: true, createdAt: true },
    });

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
