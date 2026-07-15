import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPb } from "@/lib/auth-pb";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const pb = await getAuthPb();
    if (!pb.authStore.isValid || !pb.authStore.record) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = pb.authStore.record.id;
    const token = pb.authStore.token;
    if (!token) return NextResponse.json({ error: "No session token" }, { status: 400 });

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { count } = await prisma.userSession.updateMany({
      where: { sessionToken: token },
      data: { lastActiveAt: now, expiresAt: newExpiresAt },
    });

    // Session was deleted (force-logout from another device) — do NOT recreate
    if (count === 0) {
      return NextResponse.json({ success: false, error: "Session terminated" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
