import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMatchingRule } from "@/lib/aiCapRules";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const userEmail = session.user.email as string | undefined;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiCapPlanId: true,
        aiDailyCapOverride: true,
        aiAgentReactivatesAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let planId = user.aiCapPlanId;
    let plan = planId
      ? await prisma.aiCapPlan.findUnique({ where: { id: planId } })
      : null;

    if (!plan) {
      const freePlan = await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      if (freePlan) {
        plan = freePlan;
        planId = freePlan.id;
        await prisma.user.update({
          where: { id: userId },
          data: { aiCapPlanId: freePlan.id }
        });
      }
    }

    const dailyCap = user.aiDailyCapOverride || plan?.dailyTokenCap || 0;
    const planName = plan?.label ?? "None";

    const today = new Date().toISOString().slice(0, 10);

    // Check for active capping rules matching user's email
    let ruleMatch = null;
    if (userEmail) {
      try {
        ruleMatch = await findMatchingRule({ email: userEmail });
      } catch {
        // fail-silent for rule check
      }
    }

    const effectiveDailyCap = ruleMatch?.matched && ruleMatch.capType === 'daily_tokens' && ruleMatch.capValue !== undefined
      ? Math.min(dailyCap || Infinity, ruleMatch.capValue)
      : dailyCap;

    const isRuleBlocked = ruleMatch?.matched && ruleMatch.capType === 'block';

    const summary = await prisma.aiUsageDailySummary.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const usedToday = summary?.totalTokens ?? 0;
    const remaining = Math.max(0, effectiveDailyCap - usedToday);
    const isCapped = (remaining === 0 && effectiveDailyCap > 0) || !!isRuleBlocked;

    const reactivatesAt = isCapped ? user.aiAgentReactivatesAt : null;

    let agentBreakdown: Record<string, number> = {};
    if (summary?.agentBreakdown) {
      try {
        agentBreakdown = JSON.parse(summary.agentBreakdown);
      } catch {
        agentBreakdown = {};
      }
    }

    // Calculate when the daily quota resets — always midnight UTC of next calendar day
    const nowMs = Date.now();
    const todayUtcMidnight = new Date(today + 'T00:00:00.000Z');
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000); // +1 day

    return NextResponse.json({
      isCapped,
      dailyCap: effectiveDailyCap,
      usedToday,
      remaining,
      reactivatesAt,
      planName,
      agentBreakdown,
      ruleName: ruleMatch?.matched ? ruleMatch.ruleName : null,

      // Aliases for compatibility with AiCapWarning.tsx CapStatus type
      used: usedToday,
      limit: effectiveDailyCap,
      percentage: effectiveDailyCap > 0 ? (usedToday / effectiveDailyCap) * 100 : 0,
      reactivateAt: reactivatesAt,

      // Quota scheduling — when does the daily token count reset?
      // quotaResetAt: always next UTC midnight (daily counter resets regardless of block status)
      quotaResetAt: nextResetUtc.toISOString(),
      // capExpiresAt: the block/rule override expires at this time (null if not admin-blocked)
      capExpiresAt: reactivatesAt ? reactivatesAt.toISOString() : null,
      // msUntilReset: milliseconds until quota resets (client can derive countdown)
      msUntilReset: nextResetUtc.getTime() - nowMs,
    });
  } catch (error: any) {
    console.error("[AI_CAP_STATUS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
