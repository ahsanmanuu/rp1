import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-pb";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pb_token')?.value;

    if (token) {
      // Delete session from Prisma (PB adapter)
      await prisma.userSession.deleteMany({
        where: { sessionToken: token },
      });

      // Delete session from PocketBase directly
      try {
        const { pbAdmin } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        const records = await admPb.collection("user_sessions").getFullList({
          filter: `sessionToken = "${token}"`,
          requestKey: null,
        });
        for (const r of records) {
          await admPb.collection("user_sessions").delete(r.id);
        }
      } catch {}
    }
  } catch {}

  const response = NextResponse.json({ success: true });
  response.headers.append("Set-Cookie", clearAuthCookie());
  return response;
}
