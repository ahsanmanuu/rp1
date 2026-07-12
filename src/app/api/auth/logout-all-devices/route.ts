import { NextRequest, NextResponse } from "next/server";
import { createPb } from "@/lib/pb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Missing email or password" },
        { status: 400 }
      );
    }

    // Authenticate via PocketBase to verify credentials and get user ID
    const pb = createPb();
    let userId: string;
    try {
      const authData = await pb.collection("users").authWithPassword(email, password);
      userId = authData.record.id;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Delete ALL UserSession records for this user from Prisma
    // This invalidates all existing PB session tokens tracked in our DB
    const { count } = await prisma.userSession.deleteMany({
      where: { userId },
    });

    try {
      const { pbAdmin } = await import("@/lib/pb");
      const admPb = await pbAdmin();
      const list = await admPb.collection("user_sessions").getFullList({
        filter: `userId = "${userId}"`,
        requestKey: null
      });
      for (const s of list) {
        await admPb.collection("user_sessions").delete(s.id);
      }
    } catch (pbErr: any) {
      console.error("[LOGOUT_ALL_DEVICES] PocketBase session deletion failed:", pbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "Logged out from all devices successfully",
      sessionsTerminated: count,
    });
  } catch (error: any) {
    console.error("[LOGOUT_ALL_DEVICES_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to logout from all devices" },
      { status: 500 }
    );
  }
}
