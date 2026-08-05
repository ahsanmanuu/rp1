import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ success: false, authenticated: false }, { status: 200 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('pb_token')?.value;

    if (token) {
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await prisma.userSession.upsert({
        where: { sessionToken: token },
        update: { lastActiveAt: now, expiresAt: newExpiresAt },
        create: {
          userId: session.user.id,
          sessionToken: token,
          machineId: 'pb_auto_heal',
          ipAddress: '127.0.0.1',
          location: 'Active Session',
          userAgent: 'PocketBase Heartbeat',
          expiresAt: newExpiresAt,
          lastActiveAt: now,
        }
      }).catch((err: any) => {
        console.warn("[Heartbeat] Non-fatal upsert warning:", err?.message || err);
      });
    }

    return NextResponse.json({ success: true, authenticated: true });
  } catch (error: any) {
    console.warn("[Heartbeat] Transient failure:", error?.message || error);
    return NextResponse.json({ success: false, error: "Service temporarily unavailable" }, { status: 503 });
  }
}

