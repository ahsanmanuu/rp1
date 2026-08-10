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

      // Update-only: never re-create a session row that was deleted by sign-out.
      await prisma.userSession.updateMany({
        where: { sessionToken: token },
        data: { lastActiveAt: now, expiresAt: newExpiresAt },
      }).catch((err: any) => {
        console.warn("[Heartbeat] Non-fatal update warning:", err?.message || err);
      });
    }

    return NextResponse.json({ success: true, authenticated: true });
  } catch (error: any) {
    console.warn("[Heartbeat] Transient failure:", error?.message || error);
    return NextResponse.json({ success: false, error: "Service temporarily unavailable" }, { status: 503 });
  }
}

