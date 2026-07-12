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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type) {
      return NextResponse.json({ success: false, error: "Missing type parameter" }, { status: 400 });
    }

    if (type === "totalUsers") {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const detailedUsers = [];
      for (const u of users) {
        const latestSession = await prisma.userSession.findFirst({
          where: { userId: u.id },
          orderBy: { createdAt: "desc" },
        });
        detailedUsers.push({
          id: u.id,
          name: u.name || "Unknown User",
          email: u.email,
          status: u.status,
          role: u.role,
          membership: u.membership,
          membershipExpiresAt: u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toISOString() : null,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
          ipAddress: latestSession?.ipAddress || "N/A",
          location: latestSession?.location || "N/A",
          machineId: latestSession?.machineId || "N/A",
        });
      }
      return NextResponse.json({ success: true, data: detailedUsers });
    }

    if (type === "totalRevenue") {
      const recharges = await prisma.pointTransaction.findMany({
        where: { type: "recharge" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const memberships = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: "paid" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const list = [];
      for (const r of recharges) {
        let email = "N/A";
        let name = "N/A";
        if (r.userId) {
          const u = await prisma.user.findUnique({ where: { id: r.userId } });
          if (u) {
            email = u.email;
            name = u.name || "Unknown User";
          }
        }
        let inrAmount = 0;
        if (r.amount === 50) inrAmount = 415;
        else if (r.amount === 200) inrAmount = 1245;
        else if (r.amount === 1000) inrAmount = 4150;
        else inrAmount = r.amount * 8.3;

        list.push({
          id: r.id,
          email,
          name,
          type: "Points Recharge",
          amount: inrAmount,
          date: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        });
      }
      for (const m of memberships) {
        let email = "N/A";
        let name = "N/A";
        if (m.userId) {
          const u = await prisma.user.findUnique({ where: { id: m.userId } });
          if (u) {
            email = u.email;
            name = u.name || "Unknown User";
          }
        }
        list.push({
          id: m.id,
          email,
          name,
          type: `Membership Upgrade (${m.planType})`,
          amount: m.amount,
          date: m.createdAt ? new Date(m.createdAt).toISOString() : null,
        });
      }
      list.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
      return NextResponse.json({ success: true, data: list.slice(0, 100) });
    }

    if (type === "aiUsage") {
      const logs = await prisma.aiUsageLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const list = [];
      for (const l of logs) {
        let email = "N/A";
        let name = "N/A";
        if (l.userId) {
          const u = await prisma.user.findUnique({ where: { id: l.userId } });
          if (u) {
            email = u.email;
            name = u.name || "Unknown User";
          }
        }
        list.push({
          id: l.id,
          email,
          name,
          agent: l.agent,
          model: l.model,
          totalTokens: l.totalTokens,
          date: l.createdAt ? new Date(l.createdAt).toISOString() : null,
        });
      }
      return NextResponse.json({ success: true, data: list });
    }

    if (type === "premium") {
      const users = await prisma.user.findMany({
        where: {
          membership: { in: ["premium_1m", "premium_3m", "premium_6m", "premium_12m"] },
          membershipExpiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const list = [];
      for (const u of users) {
        const latestSession = await prisma.userSession.findFirst({
          where: { userId: u.id },
          orderBy: { createdAt: "desc" },
        });
        list.push({
          id: u.id,
          name: u.name || "Unknown User",
          email: u.email,
          membership: u.membership,
          membershipExpiresAt: u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toISOString() : null,
          ipAddress: latestSession?.ipAddress || "N/A",
          location: latestSession?.location || "N/A",
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        });
      }
      return NextResponse.json({ success: true, data: list });
    }

    if (type === "freeTier") {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { membership: "free" },
            { membershipExpiresAt: { lte: new Date() } },
            { membershipExpiresAt: null },
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const list = [];
      for (const u of users) {
        const latestSession = await prisma.userSession.findFirst({
          where: { userId: u.id },
          orderBy: { createdAt: "desc" },
        });
        list.push({
          id: u.id,
          name: u.name || "Unknown User",
          email: u.email,
          ipAddress: latestSession?.ipAddress || "N/A",
          location: latestSession?.location || "N/A",
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        });
      }
      return NextResponse.json({ success: true, data: list });
    }

    if (type === "blacklisted") {
      const users = await prisma.user.findMany({
        where: { status: "blacklisted" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const list = [];
      for (const u of users) {
        list.push({
          id: u.id,
          name: u.name || "Unknown User",
          email: u.email,
          blacklistReason: u.blacklistReason || "None specified",
          blockedUntil: u.blockedUntil ? new Date(u.blockedUntil).toISOString() : null,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        });
      }
      return NextResponse.json({ success: true, data: list });
    }

    if (type === "abnormal") {
      const users = await prisma.user.findMany({
        where: { status: "abnormal" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const list = [];
      for (const u of users) {
        list.push({
          id: u.id,
          name: u.name || "Unknown User",
          email: u.email,
          status: u.status,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        });
      }
      return NextResponse.json({ success: true, data: list });
    }

    if (type.startsWith("tickets")) {
      const statusFilter = type === "tickets_pending" ? "open"
                         : type === "tickets_in_progress" ? "in_progress"
                         : type === "tickets_resolved" ? "resolved"
                         : undefined;

      const where: any = {};
      if (statusFilter) {
        where.status = statusFilter;
      }
      if (type === "tickets_archived") {
        where.archivedAt = { not: null };
      } else {
        if (type !== "tickets") {
          where.archivedAt = null;
        }
      }

      const tickets = await prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return NextResponse.json({ success: true, data: tickets });
    }

    return NextResponse.json({ success: false, error: `Unsupported insight type: ${type}` }, { status: 400 });
  } catch (error: any) {
    console.error("[INSIGHT_GET_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
