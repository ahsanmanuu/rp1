import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";
import { getEffectiveProjectCount } from "@/lib/projectLimits";
import { findMatchingRule } from "@/lib/aiCapRules";

export const runtime = "nodejs";

/**
 * GET /api/projects/limit-status
 * Returns project limit status (7-project cap for free users)
 * and LLM token exhaustion status for the current user.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email || "";

    // 1. Get effective non-decreasing project count across all tools
    const projectStatus = await getEffectiveProjectCount(userId);

    // 2. Check AI Token & LLM Cap status
    const today = new Date().toISOString().slice(0, 10);
    const [user, summary, ruleMatch, freePlan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          aiDailyCapOverride: true,
          aiAgentReactivatesAt: true,
          aiCapPlanId: true,
          aiCapPlan: { select: { name: true, dailyTokenCap: true, label: true } },
          points: true,
        },
      }),
      prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      userEmail ? findMatchingRule({ email: userEmail }).catch(() => null) : Promise.resolve(null),
      prisma.aiCapPlan.findFirst({ where: { name: "free" } }),
    ]);

    const defaultCap = user?.aiCapPlan?.name === "pro" ? 50000 : user?.aiCapPlan?.name === "enterprise" ? 200000 : 10000;
    const baseDailyCap = user?.aiDailyCapOverride || (user?.aiCapPlan?.dailyTokenCap && user.aiCapPlan.dailyTokenCap > 0 ? user.aiCapPlan.dailyTokenCap : defaultCap);

    const effectiveDailyCap = ruleMatch?.matched && ruleMatch.capType === "daily_tokens" && ruleMatch.capValue !== undefined
      ? Math.min(baseDailyCap || Infinity, ruleMatch.capValue)
      : baseDailyCap;

    const isRuleBlocked = ruleMatch?.matched && ruleMatch.capType === "block";
    const usedToday = summary?.totalTokens ?? 0;
    const aiRemaining = Math.max(0, effectiveDailyCap - usedToday);

    const now = new Date();
    const isReactivateBlocked = !!(user?.aiAgentReactivatesAt && new Date(user.aiAgentReactivatesAt) > now);

    const isAiTokensExhausted = (aiRemaining === 0 && effectiveDailyCap > 0) || isRuleBlocked || isReactivateBlocked;

    const todayUtcMidnight = new Date(today + "T00:00:00.000Z");
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

    const reactivateAt = user?.aiAgentReactivatesAt ? new Date(user.aiAgentReactivatesAt).toISOString() : null;

    return NextResponse.json({
      // Project Limit Status
      count: projectStatus.count,
      max: projectStatus.max,
      limitReached: projectStatus.limitReached,
      isProjectLimitReached: projectStatus.isProjectLimitReached,
      isPremium: projectStatus.isPremium,
      membership: projectStatus.membership,

      // AI Token & LLM Status
      isAiTokensExhausted,
      isCapped: isAiTokensExhausted,
      aiUsedToday: usedToday,
      aiDailyCap: effectiveDailyCap,
      aiRemaining,
      reactivateAt,
      quotaResetAt: nextResetUtc.toISOString(),
      points: user?.points ?? 50,
      isOutOfCredits: !projectStatus.isPremium && (user?.points ?? 0) <= 0,
    });
  } catch (error: any) {
    console.error("Limit status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
