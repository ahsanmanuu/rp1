import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ARCHIVE_SECRET = process.env.CRON_SECRET || process.env.ADMIN_JWT_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!secret || secret !== ARCHIVE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find resolved tickets older than 30 days that haven't been archived yet
    const candidates = await prisma.supportTicket.findMany({
      where: {
        status: "resolved",
        archivedAt: null,
        updatedAt: { lt: thirtyDaysAgo },
      },
      select: { id: true, ticketId: true, subject: true, userEmail: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, archived: 0, message: "No tickets to archive" });
    }

    // Batch archive
    const result = await prisma.supportTicket.updateMany({
      where: {
        status: "resolved",
        archivedAt: null,
        updatedAt: { lt: thirtyDaysAgo },
      },
      data: { archivedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        adminId: "system-cron",
        action: "ARCHIVE_RESOLVED_TICKETS",
        targetTable: "support_tickets",
        targetId: `batch_${result.count}`,
        newValue: JSON.stringify({
          count: result.count,
          ticketIds: candidates.map((t: any) => t.ticketId),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      archived: result.count,
      tickets: candidates.map((t: any) => t.ticketId),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
