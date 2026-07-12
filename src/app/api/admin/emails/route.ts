import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// ── Seed demo email logs when PocketBase is empty ──
async function seedDemoEmailLogs() {
  try {
    const count = await prisma.emailLog.count();
    if (count > 0) return;

    const now = new Date();
    const demoEmails = [
      { to: "demo.arjun@latexify.io", toName: "Arjun Sharma", emailType: "ticket_created", status: "sent", subject: "Ticket Received: LaTeX Compile Error — LX-4902", sentAt: new Date(now.getTime() - 2 * 86_400_000) },
      { to: "demo.amit@latexify.io", toName: "Prof. Amit Verma", emailType: "recovery", status: "sent", subject: "Restore Your Scholarly Access — Latexify Studio", sentAt: new Date(now.getTime() - 5 * 86_400_000) },
      { to: "demo.sneha@latexify.io", toName: "Sneha Gupta", emailType: "expiry_reminder", status: "sent", subject: "Your Premium Scholarly Access Expires in 3 Days — Latexify Studio", sentAt: new Date(now.getTime() - 1 * 86_400_000) },
      { to: "demo.priya@latexify.io", toName: "Priya Patel", emailType: "ticket_status", status: "sent", subject: "Ticket Update: Template Upload — Resolved — LX-4891", sentAt: new Date(now.getTime() - 3 * 86_400_000) },
      { to: "demo.neha@latexify.io", toName: "Neha Singh", emailType: "blacklist", status: "sent", subject: "Important: Your Latexify Account Has Been Suspended", sentAt: new Date(now.getTime() - 7 * 86_400_000) },
      { to: "demo.vikram@latexify.io", toName: "Vikram Reddy", emailType: "reactivation", status: "sent", subject: "Good News: Your Latexify Account Has Been Reactivated", sentAt: new Date(now.getTime() - 4 * 86_400_000) },
      { to: "demo.rajesh@latexify.io", toName: "Dr. Rajesh Kumar", emailType: "ticket_reply", status: "sent", subject: "New Reply: API Key Validation — LX-4899", sentAt: new Date(now.getTime() - 6 * 86_400_000) },
      { to: "demo.ananya@latexify.io", toName: "Ananya Joshi", emailType: "ticket_created", status: "failed", subject: "Ticket Received: Font Installation Request — LX-4885", errorMsg: "Connection refused to SMTP server after 3 retries", sentAt: new Date(now.getTime() - 12 * 86_400_000) },
      { to: "unknown@old-email.com", toName: null, emailType: "recovery", status: "failed", subject: "Restore Your Scholarly Access — Latexify Studio", errorMsg: "Mailbox not found: 550 5.1.1", sentAt: new Date(now.getTime() - 20 * 86_400_000) },
      { to: "demo.neha@latexify.io", toName: "Neha Singh", emailType: "expiry_reminder", status: "failed", subject: "Your Premium Scholarly Access Expires Tomorrow — Latexify Studio", errorMsg: "Temporary SMTP rate limit exceeded", sentAt: new Date(now.getTime() - 10 * 86_400_000) },
    ];

    for (const e of demoEmails) {
      try {
        await prisma.emailLog.create({
          data: {
            to: e.to,
            toName: e.toName || null,
            subject: e.subject,
            body: `<html><body><p>This is a placeholder body for: ${e.subject}</p></body></html>`,
            emailType: e.emailType,
            status: e.status,
            userId: null,
            errorMsg: (e as any).errorMsg || null,
            sentAt: e.sentAt,
          },
        });
      } catch { /* skip */ }
    }
  } catch (err) {
    console.warn("[EMAIL_LOGS] Seed error (non-fatal):", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Seed demo email logs if empty
    try { await seedDemoEmailLogs(); } catch { /* seed non-fatal */ }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const type = searchParams.get("type") || null;
    const status = searchParams.get("status") || null;
    const search = searchParams.get("search") || null;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.emailType = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { to: { contains: search, mode: "insensitive" } },
        { toName: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const [emails, total, stats] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          to: true,
          toName: true,
          subject: true,
          emailType: true,
          status: true,
          userId: true,
          errorMsg: true,
          sentAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
      prisma.emailLog.groupBy({
        by: ["emailType", "status"],
        _count: { id: true },
      }),
    ]);

    const typeStats: Record<string, { sent: number; failed: number }> = {};
    for (const s of stats) {
      if (!typeStats[s.emailType]) typeStats[s.emailType] = { sent: 0, failed: 0 };
      if (s.status === "sent") typeStats[s.emailType].sent = s._count.id;
      else typeStats[s.emailType].failed = s._count.id;
    }

    return NextResponse.json({
      success: true,
      emails,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: typeStats,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
