import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-pb";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, customerId: session.user.id }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, customerId: session.user.id }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "resolved") {
      return NextResponse.json({ error: "Cannot add messages to a resolved ticket" }, { status: 400 });
    }

    if (ticket.archivedAt) {
      return NextResponse.json({ error: "Cannot add messages to an archived ticket" }, { status: 400 });
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: session.user.id,
        senderType: "customer",
        message: message.trim(),
      }
    });

    await prisma.supportTicket.update({
      where: { id },
      data: { updatedAt: new Date() }
    });

    // Notify admin that customer sent a message
    try {
      await prisma.adminNotification.create({
        data: {
          type: "customer_message",
          title: "New Customer Message",
          body: `${ticket.userName} replied on "${ticket.subject}": ${message.trim().slice(0, 120)}${message.trim().length > 120 ? "..." : ""}`,
          ticketId: ticket.id,
        },
      });
    } catch (notifErr) {
      console.error("Admin notification failed (non-blocking):", notifErr);
    }

    return NextResponse.json({ success: true, newMessage }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

