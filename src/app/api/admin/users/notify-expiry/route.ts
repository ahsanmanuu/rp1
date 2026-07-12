import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringUsers = await prisma.user.findMany({
      where: {
        membershipExpiresAt: {
          gte: now,
          lte: threeDaysLater,
        },
        membership: { not: "free" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        membership: true,
        membershipExpiresAt: true,
      },
    });

    const result: any[] = [];

    for (const user of expiringUsers) {
      if (!user.membershipExpiresAt) continue;
      const expiresAt = new Date(user.membershipExpiresAt);
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const lastNotif = await prisma.emailLog.findFirst({
        where: {
          userId: user.id,
          emailType: "expiry_reminder",
          sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { sentAt: "desc" },
      });

      const notifiedToday = !!lastNotif;

      result.push({
        id: user.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name || "User",
        planType: user.membership,
        expiresAt: user.membershipExpiresAt,
        daysRemaining,
        lastNotifiedAt: lastNotif?.sentAt || null,
        notifiedCount: lastNotif ? 1 : 0,
        notifiedToday,
      });
    }

    return NextResponse.json({ success: true, expirations: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringUsers = await prisma.user.findMany({
      where: {
        membershipExpiresAt: {
          gte: now,
          lte: threeDaysLater,
        },
        membership: { not: "free" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        membership: true,
        membershipExpiresAt: true,
      },
    });

    const sent: { userId: string; email: string; daysRemaining: number }[] = [];
    const skipped: { userId: string; email: string; reason: string }[] = [];

    for (const user of expiringUsers) {
      if (!user.membershipExpiresAt) continue;
      const expiresAt = new Date(user.membershipExpiresAt);
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (!force) {
        const existingLog = await prisma.emailLog.findFirst({
          where: {
            userId: user.id,
            emailType: "expiry_reminder",
            sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { sentAt: "desc" },
        });
        if (existingLog) {
          skipped.push({ userId: user.id, email: user.email, reason: "Already notified today" });
          continue;
        }
      }

      await prisma.emailLog.create({
        data: {
          to: user.email,
          toName: user.name || "User",
          subject: `Your Latexify membership expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
          body: `Hi ${user.name || 'User'},\n\nYour ${user.membership} membership is expiring on ${expiresAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. That's ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} away!\n\nRenew now to keep accessing premium features.\n\n- Latexify Team`,
          emailType: "expiry_reminder",
          userId: user.id,
          status: "sent",
        },
      });

      const notifBody = `Your ${user.membership} membership expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}).`;
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "expiry_reminder",
          title: "Membership Expiring Soon",
          body: notifBody,
        },
      });

      await prisma.adminNotification.create({
        data: {
          type: "expiry_reminder",
          title: `Expiring: ${user.name || user.email}`,
          body: notifBody,
        },
      });

      sent.push({ userId: user.id, email: user.email, daysRemaining });
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: expiringUsers.length,
        sent: sent.length,
        skipped: skipped.length,
      },
      sent,
      skipped,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
