import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId query parameter" }, { status: 400 });
    }

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { ticketId, message } = body;

    if (!ticketId || !message) {
      return NextResponse.json({ error: "Missing required fields: ticketId, message" }, { status: 400 });
    }

    const existingTicket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: session.email || "admin",
        senderType: "admin",
        message,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "TICKET_ADMIN_REPLY",
        targetTable: "ticket_messages",
        targetId: newMessage.id,
        newValue: JSON.stringify(newMessage),
      },
    });

    if (existingTicket.customerId) {
      try {
        await prisma.notification.create({
          data: {
            userId: existingTicket.customerId,
            type: "ticket_reply",
            title: "New Reply on Your Ticket",
            body: `Support replied to "${existingTicket.subject}": ${message.slice(0, 120)}${message.length > 120 ? "..." : ""}`,
            ticketId: existingTicket.id,
          },
        });
      } catch {}
    }

    if (existingTicket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "in_progress" },
      });
    }

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
