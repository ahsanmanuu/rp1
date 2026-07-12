/**
 * /api/admin/users/detail
 *
 * GET ?type=<cardType>           → paginated list of users for that card with full details
 * GET ?userId=<id>               → single-user deep-dive (transactions, sessions, audit)
 *
 * Card types: total | active | abnormal | ai_overaccess | temp_locked | banned
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { seedUsersDemoData } from "@/lib/seedUsers";

export const dynamic = "force-dynamic";

function formatPlan(membership: string): string {
  const map: Record<string, string> = {
    free: "Free",
    premium_1m: "Pro – 1M",
    premium_3m: "Pro – 3M",
    premium_6m: "Pro – 6M",
    premium_12m: "Pro – 12M",
  };
  return map[membership] || membership;
}

// ── Full user detail builder ─────────────────────────────────────────────────
async function buildUserDetail(u: any, aiTokenMap: Record<string, number>) {
  const lastSession = u.sessionActivities?.[0] || null;
  const isTempBlocked =
    u.status !== "blacklisted" &&
    !!(u.blockedUntil && new Date(u.blockedUntil) > new Date());

  return {
    id: u.id,
    name: u.name || "Unnamed Scholar",
    email: u.email,
    role: u.role || "user",
    membership: formatPlan(u.membership || "free"),
    membershipRaw: u.membership || "free",
    membershipExpiresAt: u.membershipExpiresAt || null,
    points: u.points || 0,
    status: u.status || "active",
    blacklistReason: u.blacklistReason || null,
    blockedUntil: u.blockedUntil || null,
    isTempBlocked,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    // Metrics
    projectCount: u.projects?.length || 0,
    aiTokensUsed: aiTokenMap[u.id] || 0,
    totalSpentINR: (u.membershipTransactions || []).reduce(
      (s: number, t: any) => s + (t.paymentStatus === "paid" ? t.amount : 0),
      0
    ),
    // Last session
    lastIp: lastSession?.ipAddress || null,
    lastLocation: lastSession?.location || null,
    lastLatitude: lastSession?.latitude || null,
    lastLongitude: lastSession?.longitude || null,
    lastSeenAt: lastSession?.createdAt || null,
    // Nested collections (for deep-dive tab)
    sessions: u.sessionActivities || [],
    transactions: u.membershipTransactions || [],
    pointTransactions: u.transactions || [],
    blacklistHistory: u.blacklistRecords || [],
  };
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const userId = searchParams.get("userId");

  try {
    // Seed demo users if PocketBase is empty
    await seedUsersDemoData();
    // ── Single user deep-dive ────────────────────────────────────────────────
    if (userId) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          projects: { select: { id: true, title: true, createdAt: true, status: true, projectType: true } },
          sessionActivities: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, ipAddress: true, location: true, latitude: true, longitude: true, userAgent: true, createdAt: true },
          },
          membershipTransactions: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true, orderId: true, planType: true, amount: true,
              durationMonths: true, paymentStatus: true, expiresAt: true, createdAt: true,
            },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, amount: true, type: true, description: true, createdAt: true },
          },
          blacklistRecords: {
            orderBy: { createdAt: "desc" },
            select: { id: true, action: true, reason: true, adminEmail: true, createdAt: true },
          },
        },
      });

      if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const aiLog = await prisma.aiUsageLog.groupBy({
        by: ["userId"],
        where: { userId },
        _sum: { totalTokens: true },
      });
      const aiTokens = aiLog[0]?._sum?.totalTokens || 0;

      const tokenMap: Record<string, number> = { [userId]: aiTokens };
      const detail = await buildUserDetail(u, tokenMap);

      return NextResponse.json({ success: true, user: detail });
    }

    // ── Card-type multi-user list ────────────────────────────────────────────
    if (!type) return NextResponse.json({ error: "type or userId required" }, { status: 400 });

    const now = new Date();

    // Build where clause for each card type
    let whereClause: any = {};
    if (type === "total") {
      whereClause = {};
    } else if (type === "active") {
      whereClause = { status: { not: "blacklisted" } };
    } else if (type === "abnormal") {
      whereClause = { status: "abnormal" };
    } else if (type === "ai_overaccess") {
      // We'll filter after aggregating AI tokens — fetch all then filter
      whereClause = {};
    } else if (type === "temp_locked") {
      whereClause = {
        status: { not: "blacklisted" },
        blockedUntil: { gt: now },
      };
    } else if (type === "banned") {
      whereClause = { status: "blacklisted" };
    } else if (type === "expiring_soon") {
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      whereClause = {
        membership: { not: "free" },
        membershipExpiresAt: { gte: now, lte: sevenDaysLater },
      };
    } else if (type === "expired") {
      whereClause = {
        membership: { not: "free" },
        membershipExpiresAt: { lt: now },
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        projects: { select: { id: true } },
        sessionActivities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { ipAddress: true, location: true, createdAt: true },
        },
        membershipTransactions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, orderId: true, planType: true, amount: true,
            durationMonths: true, paymentStatus: true, expiresAt: true, createdAt: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, amount: true, type: true, description: true, createdAt: true },
        },
        blacklistRecords: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, action: true, reason: true, adminEmail: true, createdAt: true },
        },
      },
    });

    // Aggregate AI tokens for all users
    const aiLogs = await prisma.aiUsageLog.groupBy({
      by: ["userId"],
      _sum: { totalTokens: true },
    });
    const tokenMap: Record<string, number> = {};
    aiLogs.forEach((l: any) => {
      if (l.userId) tokenMap[l.userId] = l._sum.totalTokens || 0;
    });

    let rows = await Promise.all(users.map((u: any) => buildUserDetail(u, tokenMap)));

    // Post-filter for AI over-access (can't do in SQL easily without join)
    if (type === "ai_overaccess") {
      rows = rows.filter((r) => r.aiTokensUsed > 50000);
    }

    return NextResponse.json({ success: true, rows, total: rows.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
