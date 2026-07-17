import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  try {
    // Bypass PocketBase completely — read the session token from cookie directly.
    // getAuthPb() / authRefresh() can hang for 80+ seconds when PB is under load
    // (e.g. while handling realtime SSE connections). Using Prisma directly avoids that.
    const cookieStore = await cookies();
    const token = cookieStore.get('pb_token')?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { count } = await prisma.userSession.updateMany({
      where: {
        sessionToken: token,
        expiresAt: { gt: now }, // only update non-expired sessions
      },
      data: { lastActiveAt: now, expiresAt: newExpiresAt },
    });

    // Session was deleted (force-logout from another device) — do NOT recreate
    if (count === 0) {
      // Check if it exists but is expired vs. deleted
      const exists = await prisma.userSession.findUnique({
        where: { sessionToken: token },
        select: { id: true, expiresAt: true }
      });
      if (!exists) {
        return NextResponse.json({ success: false, error: "Session terminated" }, { status: 401 });
      }
      // Session expired — extend it anyway (user is actively using the app)
      await prisma.userSession.update({
        where: { sessionToken: token },
        data: { lastActiveAt: now, expiresAt: newExpiresAt },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Return 503 (transient) instead of 500 so client-side heartbeat knows to retry
    console.warn("[Heartbeat] Transient failure:", error?.message || error);
    return NextResponse.json({ success: false, error: "Service temporarily unavailable" }, { status: 503 });
  }
}

