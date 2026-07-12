import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await prisma.adminLiveStatus.findUnique({
      where: { id: "singleton" }
    });
    if (!status) {
      return NextResponse.json({ success: true, isLive: false });
    }
    // Active if updated in last 45 seconds and marked isLive
    const isLive = status.isLive && (Date.now() - new Date(status.lastSeenAt).getTime() < 45 * 1000);
    return NextResponse.json({ success: true, isLive });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
