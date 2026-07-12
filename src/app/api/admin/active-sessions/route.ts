import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all sessions that are not expired
    const activeSessions = await prisma.userSession.findMany({
      where: {
        expiresAt: { gte: new Date() },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Map to custom details requested by user:
    const sessionsList = [];
    for (const s of activeSessions) {
      let userName = "Unknown User";
      let userEmail = "";
      if (s.userId) {
        try {
          const u = await prisma.user.findUnique({ where: { id: s.userId } });
          if (u) {
            userName = u.name || "Unknown User";
            userEmail = u.email || "";
          }
        } catch {}
      }
      sessionsList.push({
        id: s.id,
        name: userName,
        username: userEmail ? userEmail.split("@")[0] : "unknown",
        email: userEmail,
        ip: s.ipAddress || "Unknown IP",
        location: s.location || "Unknown Location",
        sessionStartTime: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        machineId: s.machineId || "",
      });
    }

    return NextResponse.json({ success: true, sessions: sessionsList });
  } catch (error: any) {
    console.error("[ACTIVE_SESSIONS_GET_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    // Delete user session
    await prisma.userSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true, message: "Session terminated successfully" });
  } catch (error: any) {
    console.error("[ACTIVE_SESSIONS_DELETE_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
