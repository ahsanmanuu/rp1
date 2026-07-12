import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminSession = await getAdminSessionFromRequest(req);
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await prisma.adminLiveStatus.upsert({
      where: { id: "singleton" },
      update: {
        isLive: true,
        lastSeenAt: new Date()
      },
      create: {
        id: "singleton",
        isLive: true,
        lastSeenAt: new Date()
      }
    });

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
