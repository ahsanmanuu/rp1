import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { sendTicketStatusEmail, sendTicketReplyEmail, sendTicketCreatedEmail } from "@/lib/ticketNotifications";

export const dynamic = 'force-dynamic';

// Seed initial support tickets if the table is empty
async function ensureTicketsSeeded() {
  const count = await prisma.supportTicket.count();
  if (count === 0) {
    const seeds = [
      { ticketId: "LX-4902", subject: "LaTeX Compile Error: pdflatex timeout", description: "Compilation fails consistently with timeout error on large documents containing custom packages.", status: "open", priority: "P1", userName: "Prof. Aris", userEmail: "aris@university.edu" },
      { ticketId: "LX-4899", subject: "API Key validation failing on Diagram Gen", description: "When using diagram generator tool, API validation returns 401 Unauthorized for custom API tokens.", status: "open", priority: "P2", userName: "DevStudio", userEmail: "dev@studio.io" },
      { ticketId: "LX-4891", subject: "Template upload limit inquiry", description: "How can we request a limit increase for publishing templates? Current limit is 10 templates.", status: "open", priority: "P3", userName: "Sarah L.", userEmail: "sarah@latexify.io" },
      { ticketId: "LX-4885", subject: "Typography request: New font face", description: "Can we install the computer modern sans serif font package on compile workers?", status: "open", priority: "P4", userName: "Admin UX", userEmail: "ux-admin@latexify.io" },
      { ticketId: "LX-4879", subject: "Doc2LaTeX conversion table alignment broken", description: "Multi-column tables in DOCX render with misaligned columns after conversion. Affects 3 recent projects.", status: "in_progress", priority: "P2", userName: "Dr. Meera K.", userEmail: "meera.k@research-lab.org" },
      { ticketId: "LX-4872", subject: "AI Peer Reviewer score discrepancy", description: "The reviewer gave a score of 4.2 on a resubmission but the original was 8.1. No significant changes between versions.", status: "in_progress", priority: "P1", userName: "Postdoc Wang", userEmail: "wang@cs.uni.edu" },
    ];
    for (const s of seeds) {
      try { await prisma.supportTicket.create({ data: s }); } catch {}
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    try { await ensureTicketsSeeded(); } catch { /* seed non-fatal */ }
    const tickets = await prisma.supportTicket.findMany({
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" }
      ]
    });

    // Bulk fetch matched customer profiles
    const emails = tickets.map((t: any) => t.userEmail).filter(Boolean);
    const matchedUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        membership: true,
        points: true,
        status: true,
        _count: {
          select: { projects: true }
        }
      }
    });

    const userMap = new Map(matchedUsers.map((u: any) => [u.email, {
      customerId: u.id,
      email: u.email,
      membership: u.membership,
      points: u.points,
      status: u.status,
      projectCount: u._count?.projects ?? 0
    }]));

    const ticketsWithCustomerInfo = tickets.map((t: any) => {
      const customer = userMap.get(t.userEmail);
      return {
        ...t,
        customerDetails: customer || null
      };
    });

    const metrics = {
      urgent: tickets.filter((t: any) => t.priority === "P1" && t.status !== "resolved").length,
      totalOpen: tickets.filter((t: any) => t.status === "open").length,
      inProgress: tickets.filter((t: any) => t.status === "in_progress").length,
      totalResolved: tickets.filter((t: any) => t.status === "resolved").length,
      archived: tickets.filter((t: any) => t.archivedAt !== null).length
    };

    return NextResponse.json({ success: true, tickets: ticketsWithCustomerInfo, metrics });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { subject, description, priority, userName, userEmail } = body;

    if (!subject || !description || !userName || !userEmail) {
      return NextResponse.json({ error: "Missing required fields: subject, description, userName, userEmail" }, { status: 400 });
    }

    // Auto-generate unique ticketId formatted like LX-XXXX
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `LX-${randomNum}`;

    // Lookup customer ID to link
    const matchedUser = await prisma.user.findFirst({
      where: { email: userEmail },
      select: { id: true }
    });

    const newTicket = await prisma.supportTicket.create({
      data: {
        ticketId,
        subject,
        description,
        priority: priority || "P4",
        status: "open",
        userName,
        userEmail,
        customerId: matchedUser?.id || null
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "CREATE_SUPPORT_TICKET",
        targetTable: "support_tickets",
        targetId: newTicket.id,
        newValue: JSON.stringify(newTicket),
      }
    });

    // Send notification + email to user if they have a registered account
    if (matchedUser?.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: matchedUser.id,
            type: "ticket_created",
            title: "New Support Ticket Created",
            body: `A support ticket "${subject}" has been created for you by our support team. Ticket ID: ${ticketId}`,
            ticketId: newTicket.id,
          },
        });
      } catch (notifErr) {
        console.error("Notification fire failed (non-blocking):", notifErr);
      }
    }

    // Send email to the user regardless of account status
    sendTicketCreatedEmail(userEmail, userName, subject, ticketId, matchedUser?.id || null).catch(console.error);

    return NextResponse.json({ success: true, ticket: newTicket }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status, priority, subject, description, reason } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
    }

    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    const statusChanged = existing && status && existing.status !== status;
    const reasonChanged = existing && reason !== undefined && existing.reason !== reason;

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        priority,
        subject,
        description,
        reason
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "UPDATE_SUPPORT_TICKET",
        targetTable: "support_tickets",
        targetId: updatedTicket.id,
        newValue: JSON.stringify(updatedTicket),
      }
    });

    // Fire notifications + emails asynchronously (non-blocking)
    if (existing?.customerId) {
      try {
        const notificationPromises: Promise<any>[] = [];

        if (statusChanged) {
          notificationPromises.push(
            prisma.notification.create({
              data: {
                userId: existing.customerId,
                type: "ticket_status_change",
                title: `Ticket ${status === "resolved" ? "Resolved" : "Updated"}`,
                body: `Your ticket "${existing.subject}" is now ${status === "resolved" ? "resolved" : status === "in_progress" ? "in progress" : "open"}.`,
                ticketId: existing.id,
              },
            })
          );
          notificationPromises.push(
            sendTicketStatusEmail(
              existing.userEmail,
              existing.userName,
              existing.subject,
              existing.ticketId,
              status,
              existing.customerId
            ).catch(console.error)
          );
        }

        if (reasonChanged && reason) {
          notificationPromises.push(
            prisma.notification.create({
              data: {
                userId: existing.customerId,
                type: "ticket_reply",
                title: "New Reply on Your Ticket",
                body: `Support replied to "${existing.subject}": ${reason.slice(0, 120)}${reason.length > 120 ? "..." : ""}`,
                ticketId: existing.id,
              },
            })
          );
          notificationPromises.push(
            sendTicketReplyEmail(
              existing.userEmail,
              existing.userName,
              existing.subject,
              existing.ticketId,
              reason,
              existing.customerId
            ).catch(console.error)
          );
        }

        if (notificationPromises.length > 0) {
          await Promise.allSettled(notificationPromises);
        }
      } catch (notifErr) {
        console.error("Notification fire failed (non-blocking):", notifErr);
      }
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing ticket id query parameter" }, { status: 400 });
    }

    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    await prisma.supportTicket.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "DELETE_SUPPORT_TICKET",
        targetTable: "support_tickets",
        targetId: id,
        previousValue: JSON.stringify(existing),
      }
    });

    return NextResponse.json({ success: true, message: "Ticket deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
