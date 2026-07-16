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
    const today = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();

    const [user, summary, ruleMatch, freePlan, proPlan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          aiCapPlanId: true,
          aiDailyCapOverride: true,
          aiAgentReactivatesAt: true,
          membership: true,
          membershipExpiresAt: true,
        },
      }),
      prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      userEmail ? findMatchingRule({ email: userEmail }).catch(() => null) : Promise.resolve(null),
      prisma.aiCapPlan.findFirst({ where: { name: 'free' } }),
      prisma.aiCapPlan.findFirst({ where: { name: 'pro' } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let planId = user.aiCapPlanId;
    let plan = planId
      ? await prisma.aiCapPlan.findUnique({ where: { id: planId } })
      : null;

    // Check if user has an active premium subscription
    const now = new Date();
    const isPremiumMember = user.membership && user.membership !== 'free' && (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > now);

    if (isPremiumMember) {
      // Sync user to Pro AI plan if currently on Free plan or has no plan
      if (!plan || plan.name === 'free') {
        const targetPlan = proPlan || await prisma.aiCapPlan.findFirst({ where: { name: 'pro' } });
        if (targetPlan) {
          plan = targetPlan;
          planId = targetPlan.id;
          await prisma.user.update({
            where: { id: userId },
            data: { aiCapPlanId: targetPlan.id }
          });
        }
      }
    } else {
      // Sync user back to Free AI plan if premium subscription has expired or is free, and they are on pro plan
      if (!plan || plan.name === 'pro') {
        const targetPlan = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
        if (targetPlan) {
          plan = targetPlan;
          planId = targetPlan.id;
          await prisma.user.update({
            where: { id: userId },
            data: { aiCapPlanId: targetPlan.id }
          });
        }
      }
    }

    const dailyCap = user.aiDailyCapOverride || plan?.dailyTokenCap || 0;
    const planName = plan?.label ?? "None";

    const effectiveDailyCap = ruleMatch?.matched && ruleMatch.capType === 'daily_tokens' && ruleMatch.capValue !== undefined
      ? Math.min(dailyCap || Infinity, ruleMatch.capValue)
      : dailyCap;

    const isRuleBlocked = ruleMatch?.matched && ruleMatch.capType === 'block';

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

    const todayUtcMidnight = new Date(today + 'T00:00:00.000Z');
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

    return NextResponse.json({
      isCapped,
      dailyCap: effectiveDailyCap,
      usedToday,
      remaining,
      reactivatesAt,
      planName,
      agentBreakdown,
      ruleName: ruleMatch?.matched ? ruleMatch.ruleName : null,

      used: usedToday,
      limit: effectiveDailyCap,
      percentage: effectiveDailyCap > 0 ? (usedToday / effectiveDailyCap) * 100 : 0,
      reactivateAt: reactivatesAt,

      quotaResetAt: nextResetUtc.toISOString(),
      capExpiresAt: reactivatesAt ? reactivatesAt.toISOString() : null,
      msUntilReset: nextResetUtc.getTime() - nowMs,
    });
  } catch (error: any) {
    console.error("[AI_CAP_STATUS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
