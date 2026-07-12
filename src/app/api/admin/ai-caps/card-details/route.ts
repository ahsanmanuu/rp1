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
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "capped" | "uncapped" | "approaching" | "top-users"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const today = new Date().toISOString().split("T")[0];

    if (!type) {
      return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
    }

    // Common search filter
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // ── Resolve canonical plan IDs ──
    const allPlans = await prisma.aiCapPlan.findMany({ orderBy: { createdAt: "asc" } });
    const freePlanIds = allPlans
      .filter((p: any) => p.name?.toLowerCase() === "free")
      .map((p: any) => p.id);
    const cappedPlanIds = allPlans
      .filter((p: any) => p.name?.toLowerCase() !== "free")
      .map((p: any) => p.id);

    if (type === "capped") {
      // Users on non-free cap plans (pro / enterprise / custom)
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: cappedPlanIds.length > 0
            ? { aiCapPlanId: { in: cappedPlanIds }, ...searchFilter }
            : { aiCapPlanId: { not: null }, ...searchFilter },
          select: {
            id: true,
            name: true,
            email: true,
            aiCapPlanId: true,
            aiDailyCapOverride: true,
            aiAgentReactivatesAt: true,
            aiCapPlan: { select: { name: true, dailyTokenCap: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        cappedPlanIds.length > 0
          ? prisma.user.count({ where: { aiCapPlanId: { in: cappedPlanIds }, ...searchFilter } })
          : Promise.resolve(0),
      ]);

      // Get today's usage for these users
      const userIds = users.map((u) => u.id);
      const todayUsage = await prisma.aiUsageDailySummary.findMany({
        where: { userId: { in: userIds }, date: today },
        select: { userId: true, totalTokens: true },
      });
      const usageMap: Record<string, number> = {};
      todayUsage.forEach((u) => { usageMap[u.userId] = u.totalTokens; });

      const enriched = users.map((u) => {
        const dailyCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;
        const used = usageMap[u.id] || 0;
        const isCapped = u.aiAgentReactivatesAt && new Date(u.aiAgentReactivatesAt) > new Date();
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          plan: u.aiCapPlan?.name || "Unknown",
          dailyCap,
          todayUsage: used,
          isCapped,
          percentUsed: dailyCap > 0 ? Math.round((used / dailyCap) * 100) : 0,
        };
      });

      return NextResponse.json({ success: true, type: "capped", users: enriched, total, page, limit });
    }

    if (type === "uncapped") {
      // Users on free plan or no plan
      // Use AND to avoid OR key collision with searchFilter
      const planFilter = freePlanIds.length > 0
        ? { OR: [{ aiCapPlanId: { in: freePlanIds } }, { aiCapPlanId: null }] }
        : {};
      const uncappedWhere = search
        ? { AND: [planFilter, searchFilter] }
        : planFilter;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: uncappedWhere,
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            points: true,
            membership: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where: uncappedWhere }),
      ]);

      return NextResponse.json({ success: true, type: "uncapped", users, total, page, limit });
    }

    if (type === "approaching") {
      // Users approaching cap (80-100%)
      const allUsersWithPlans = await prisma.user.findMany({
        where: { aiCapPlanId: { not: null }, ...searchFilter },
        select: {
          id: true,
          name: true,
          email: true,
          aiCapPlanId: true,
          aiDailyCapOverride: true,
          aiCapPlan: { select: { name: true, dailyTokenCap: true } },
        },
      });

      const todaySummaries = await prisma.aiUsageDailySummary.findMany({
        where: { date: today },
        select: { userId: true, totalTokens: true },
      });
      const usageMap: Record<string, number> = {};
      todaySummaries.forEach((s) => { usageMap[s.userId] = s.totalTokens; });

      const approaching = allUsersWithPlans
        .map((u) => {
          const effectiveCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;
          if (effectiveCap <= 0) return null;
          const used = usageMap[u.id] || 0;
          const percent = (used / effectiveCap) * 100;
          if (percent >= 80 && percent <= 100) {
            return {
              userId: u.id,
              name: u.name,
              email: u.email,
              plan: u.aiCapPlan?.name || "Unknown",
              dailyCap: effectiveCap,
              todayUsage: used,
              percentUsed: Math.round(percent),
            };
          }
          return null;
        })
        .filter(Boolean);

      // Paginate
      const paged = approaching.slice(skip, skip + limit);
      return NextResponse.json({ success: true, type: "approaching", users: paged, total: approaching.length, page, limit });
    }

    if (type === "top-users") {
      // Top users by today's token usage
      const [summaries, total] = await Promise.all([
        prisma.aiUsageDailySummary.findMany({
          where: { date: today },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                aiCapPlanId: true,
                aiDailyCapOverride: true,
                aiAgentReactivatesAt: true,
                aiCapPlan: { select: { name: true, dailyTokenCap: true } },
              },
            },
          },
          orderBy: { totalTokens: "desc" },
          skip,
          take: limit,
        }),
        prisma.aiUsageDailySummary.count({ where: { date: today } }),
      ]);

      const enriched = summaries.map((s) => {
        const u = s.user;
        const dailyCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          plan: u.aiCapPlan?.name || "None",
          dailyCap,
          todayUsage: s.totalTokens,
          promptTokens: s.promptTokens,
          completionTokens: s.completionTokens,
          requestCount: s.requestCount,
          percentUsed: dailyCap > 0 ? Math.round((s.totalTokens / dailyCap) * 100) : 0,
        };
      });

      return NextResponse.json({ success: true, type: "top-users", users: enriched, total, page, limit });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to fetch card details:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
