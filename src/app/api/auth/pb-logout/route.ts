import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  try {
    const token = cookieStore.get('pb_token')?.value;

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
  try {
    cookieStore.delete('pb_token');
    cookieStore.delete('admin_session');
  } catch (err) {
    console.error("[AUTH pb-logout] Error deleting cookies via cookieStore:", err);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("pb_token", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  response.cookies.set("admin_session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}
