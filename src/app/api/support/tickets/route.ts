import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientGeoInfo } from "@/lib/clientGeo";
import { sendTicketCreatedEmail } from "@/lib/ticketNotifications";

import { getServerSession } from "@/lib/auth-pb";
function generateTicketId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `LX-${num}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";

    const where: any = { customerId: session.user.id, archivedAt: null };
    if (status && status !== "all") {
      where.status = status;
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" }
      ],
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const metrics = await prisma.supportTicket.groupBy({
      by: ["status"],
      where: { customerId: session.user.id, archivedAt: null },
      _count: { id: true }
    });

    const metricMap = { totalOpen: 0, inProgress: 0, totalResolved: 0, urgent: 0 };
    for (const m of metrics) {
      if (m.status === "resolved") {
        metricMap.totalResolved = m._count.id;
      } else if (m.status === "in_progress") {
        metricMap.inProgress = m._count.id;
      } else {
        metricMap.totalOpen += m._count.id;
      }
    }
    metricMap.urgent = await prisma.supportTicket.count({
      where: { customerId: session.user.id, priority: "P1", status: { not: "resolved" }, archivedAt: null }
    });

    return NextResponse.json({ success: true, tickets, metrics: metricMap });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { subject, description, priority } = body;

    if (!subject || !description) {
      return NextResponse.json({ error: "Subject and description are required" }, { status: 400 });
    }

    // Auto-capture client IP, geolocation, and user agent
    const geo = await getClientGeoInfo(req);

    let ticketId = generateTicketId();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.supportTicket.findUnique({ where: { ticketId } });
      if (!existing) break;
      ticketId = generateTicketId();
      attempts++;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketId,
        subject,
        description,
        priority: priority || "P4",
        userName: session.user.name || "User",
        userEmail: session.user.email || "",
        customerId: session.user.id,
        ipAddress: geo.ipAddress,
        location: geo.location,
        country: geo.country,
        userAgent: geo.userAgent,
      }
    });

    // Send confirmation email asynchronously
    sendTicketCreatedEmail(
      session.user.email || "",
      session.user.name || "User",
      subject,
      ticketId,
      session.user.id
    ).catch(console.error);

    // Notify admin that a new ticket was created
    try {
      await prisma.adminNotification.create({
        data: {
          type: "new_ticket",
          title: "New Support Ticket",
          body: `${session.user.name || "User"} created ticket "${subject}" (${ticketId})`,
          ticketId: ticket.id,
        },
      });
    } catch (notifErr) {
      console.error("Admin notification failed (non-blocking):", notifErr);
    }

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
