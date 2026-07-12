import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { seedAiCapsDemoData } from "@/lib/seedAiCaps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seed demo data if PocketBase collections are empty
  await seedAiCapsDemoData();

  try {
    const today = new Date().toISOString().split("T")[0];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    // ── Fetch canonical plans first to determine which are "free" ──
    const allPlans = await prisma.aiCapPlan.findMany({
      orderBy: { createdAt: "asc" },
    });
    const freePlanIds = new Set(
      allPlans.filter((p: any) => p.name?.toLowerCase() === "free").map((p: any) => p.id)
    );
    const cappedPlanIds = allPlans
      .filter((p: any) => p.name?.toLowerCase() !== "free")
      .map((p: any) => p.id);

    const [
      totalUsers,
      todayUsage,
      topUsersToday,
      dailyTrend,
      agentBreakdown,
      allUsersWithPlans,
    ] = await Promise.all([
      // Total all users
      prisma.user.count({}),

      // Today's total tokens used across all users
      prisma.aiUsageDailySummary.aggregate({
        where: { date: today },
        _sum: { totalTokens: true },
      }),

      // Top 10 users by token usage today
      prisma.aiUsageDailySummary.findMany({
        where: { date: today },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              aiCapPlanId: true,
            },
          },
        },
        orderBy: { totalTokens: "desc" },
        take: 10,
      }),

      // Last 30 days daily token trend
      prisma.aiUsageDailySummary.groupBy({
        by: ["date"],
        where: { date: { gte: thirtyDaysAgoStr } },
        _sum: { totalTokens: true },
        orderBy: { date: "asc" },
      }),

      // Usage by agent breakdown today
      prisma.aiUsageDailySummary.findMany({
        where: { date: today },
        select: { agentBreakdown: true },
      }),

      // Users with non-free plans (for approaching-cap check)
      cappedPlanIds.length > 0
        ? prisma.user.findMany({
            where: { aiCapPlanId: { in: cappedPlanIds } },
            select: {
              id: true,
              name: true,
              email: true,
              aiCapPlanId: true,
              aiDailyCapOverride: true,
              aiCapPlan: {
                select: { dailyTokenCap: true, name: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const usersWithPlan = cappedPlanIds.length > 0
      ? await prisma.user.count({ where: { aiCapPlanId: { in: cappedPlanIds } } })
      : 0;
    const usersWithoutPlan = totalUsers - usersWithPlan;

    // Merge agent breakdowns
    const mergedAgentBreakdown: Record<string, number> = {};
    agentBreakdown.forEach((summary: any) => {
      try {
        const breakdown = JSON.parse(summary.agentBreakdown || "{}");
        for (const [agent, tokens] of Object.entries(breakdown)) {
          mergedAgentBreakdown[agent] = (mergedAgentBreakdown[agent] || 0) + (tokens as number);
        }
      } catch {
        // skip malformed JSON
      }
    });

    // Fetch today's usage per user for approaching-cap check
    const todayUserSummaries = await prisma.aiUsageDailySummary.findMany({
      where: { date: today },
      select: { userId: true, totalTokens: true },
    });

    const userTokensToday: Record<string, number> = {};
    todayUserSummaries.forEach((s: any) => {
      userTokensToday[s.userId] = s.totalTokens;
    });

    // Users approaching cap (80-100% of daily limit)
    const approachingCap = allUsersWithPlans
      .map((u: any) => {
        const effectiveCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;
        if (effectiveCap <= 0) return null;
        const used = userTokensToday[u.id] || 0;
        const percent = (used / effectiveCap) * 100;
        if (percent >= 80 && percent <= 100) {
          return {
            userId: u.id,
            name: u.name,
            email: u.email,
            planName: u.aiCapPlan?.name || "Unknown",
            dailyCap: effectiveCap,
            usedToday: used,
            percentUsed: Math.round(percent),
          };
        }
        return null;
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      stats: {
        usersWithPlan,
        usersWithoutPlan,
        totalTokensToday: todayUsage._sum.totalTokens || 0,
        topUsersToday,
        dailyTrend: dailyTrend.map((d: any) => ({
          date: d.date,
          totalTokens: d._sum.totalTokens || 0,
        })),
        agentBreakdown: mergedAgentBreakdown,
        approachingCap,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch AI caps dashboard:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
