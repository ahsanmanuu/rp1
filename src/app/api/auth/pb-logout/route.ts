import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;
    const token = cookieStore.get('pb_token')?.value || body?.token || headerToken;

    if (token) {
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
    }
  } catch (err) {
    console.error("[AUTH pb-logout] Error deleting sessions:", err);
  }

  // Delete cookies via Next.js cookies API
  const authCookieNames = ['pb_token', 'admin_session', 'next-auth.session-token', '__Secure-next-auth.session-token'];
  authCookieNames.forEach(c => {
    try { cookieStore.delete(c); } catch {}
  });

  const response = NextResponse.json({ success: true });
  authCookieNames.forEach(c => {
    response.cookies.set(c, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
  });

  return response;
}
