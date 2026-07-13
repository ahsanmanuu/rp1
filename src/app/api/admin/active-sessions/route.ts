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

    // Fetch non-expired sessions active within last 15 minutes
    const activeThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const activeSessions = await prisma.userSession.findMany({
      where: {
        lastActiveAt: { gte: activeThreshold },
        expiresAt: { gte: new Date() },
      },
      orderBy: {
        lastActiveAt: "desc",
      },
    });

    // Group sessions by userId: deduplicate so each user appears once
    // Keep the latest session per user, count how many sessions each user has
    const userSessionMap = new Map<string, { sessions: typeof activeSessions; latest: (typeof activeSessions)[number] }>();
    for (const s of activeSessions) {
      const existing = userSessionMap.get(s.userId);
      if (existing) {
        existing.sessions.push(s);
      } else {
        userSessionMap.set(s.userId, { sessions: [s], latest: s });
      }
    }

    // Batch fetch all unique users
    const uniqueUserIds = Array.from(userSessionMap.keys());
    type SessionUser = { id: string; name: string | null; email: string; };
    const users: SessionUser[] = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map<string, SessionUser>(users.map((u: SessionUser) => [u.id, u]));

    // Build deduplicated response — one entry per user
    const sessionsList: any[] = [];
    for (const [userId, group] of userSessionMap) {
      const u = userMap.get(userId);
      const userName = u?.name || "Unknown User";
      const userEmail = u?.email || "";
      const s = group.latest;
      sessionsList.push({
        id: s.id,
        name: userName,
        username: userEmail ? userEmail.split("@")[0] : "unknown",
        email: userEmail,
        ip: s.ipAddress || "Unknown IP",
        location: s.location || "Unknown Location",
        sessionStartTime: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        lastActiveAt: s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : null,
        machineId: s.machineId || "",
        activeSessionCount: group.sessions.length,
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
