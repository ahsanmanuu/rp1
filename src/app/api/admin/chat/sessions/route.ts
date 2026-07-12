import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminSession = await getAdminSessionFromRequest(req);
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status"); // "open" or "history"

    const where: any = {};
    if (statusFilter === "open") {
      where.status = "open";
    } else if (statusFilter === "history") {
      where.status = { in: ["closed", "terminated", "aborted"] };
    }

    const sessions = await prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return NextResponse.json({ success: true, sessions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const adminSession = await getAdminSessionFromRequest(req);
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sessionId, status } = body; // status can be "closed", "terminated", "aborted"

    if (!sessionId || !status) {
      return NextResponse.json({ error: "sessionId and status are required" }, { status: 400 });
    }

    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status }
    });

    // Create system audit message inside the chat
    let systemText = `Session was marked as ${status.toUpperCase()} by admin.`;
    if (status === "aborted") {
      systemText = "Session aborted by admin.";
    } else if (status === "closed") {
      systemText = "Session closed by admin.";
    } else if (status === "terminated") {
      systemText = "Session terminated by admin.";
    }

    await prisma.chatMessage.create({
      data: {
        sessionId,
        senderType: "admin",
        content: `[SYSTEM_NOTIFICATION] ${systemText}`
      }
    });

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminSession = await getAdminSessionFromRequest(req);
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    await prisma.chatSession.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true, message: "Chat session and messages deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
