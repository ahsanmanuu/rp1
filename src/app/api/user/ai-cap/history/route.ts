import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const [user, summaries] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCapPlanId: true },
      }),
      prisma.aiUsageDailySummary.findMany({
        where: { userId, date: { gte: cutoffDate } },
        orderBy: { date: "desc" },
      }),
    ]);

    const planId = user?.aiCapPlanId;
    let plan = planId
      ? await prisma.aiCapPlan.findUnique({ where: { id: planId } })
      : null;

    if (!plan && userId) {
      const freePlan = await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      if (freePlan) {
        plan = freePlan;
        await prisma.user.update({
          where: { id: userId },
          data: { aiCapPlanId: freePlan.id }
        });
      }
    }

    return NextResponse.json({
      plan: plan
        ? { name: plan.label, dailyTokenCap: plan.dailyTokenCap }
        : null,
      history: summaries.map((s: any) => ({
        date: s.date,
        totalTokens: s.totalTokens,
        promptTokens: s.promptTokens,
        completionTokens: s.completionTokens,
        requestCount: s.requestCount,
        agentBreakdown: (() => {
          try {
            return JSON.parse(s.agentBreakdown);
          } catch {
            return {};
          }
        })(),
      })),
    });
  } catch (error: any) {
    console.error("[AI_CAP_HISTORY_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
