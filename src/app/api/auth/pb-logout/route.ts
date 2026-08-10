import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const AUTH_COOKIE_NAMES = ['pb_token', 'admin_session', 'next-auth.session-token', '__Secure-next-auth.session-token'];

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  });

  // 1. Purging the auth cookies must NEVER be blocked by slow DB/PB work below —
  //    it happens first and unconditionally so sign-out can never hang.
  AUTH_COOKIE_NAMES.forEach(c => {
    try { cookieStore.delete(c); } catch {}
    response.cookies.set(c, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
  });

  // 2. Best-effort session revocation, run in the background so it cannot delay
  //    the response (a slow PocketBase admin refresh must not time out logout).
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;
    const token = cookieStore.get('pb_token')?.value || body?.token || headerToken;

    if (token) {
      void (async () => {
        // Delete session from Prisma (PB adapter)
        await prisma.userSession.deleteMany({
          where: { sessionToken: token },
        }).catch(() => null);

        // Delete session from PocketBase directly
        try {
          const { pbAdmin } = await import("@/lib/pb");
          const admPb = await pbAdmin();
          const records = await admPb.collection("user_sessions").getFullList({
            filter: `sessionToken = "${token}"`,
            requestKey: null,
            $autoCancel: false,
          });
          if (records.length > 0) {
            await Promise.all(records.map((r: any) => admPb.collection("user_sessions").delete(r.id)));
          }
        } catch {}
      })();
    }
  } catch (err) {
    console.error("[AUTH pb-logout] Error deleting sessions:", err);
  }

  return response;
}