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
          id: true,
          email: true,
          name: true,
          aiCapPlanId: true,
          aiDailyCapOverride: true,
          aiAgentReactivatesAt: true,
          membership: true,
          membershipExpiresAt: true,
          aiPlanStartsAt: true,
          aiPlanExpiresAt: true,
          aiPlanExpiryWarnedAt: true,
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

    const now = new Date();

    // 1. Process AI Plan Expiration
    let aiPlanExpiresAt = user.aiPlanExpiresAt;
    let aiPlanStartsAt = user.aiPlanStartsAt;
    let currentPlanId = user.aiCapPlanId;

    if (aiPlanExpiresAt && new Date(aiPlanExpiresAt) <= now) {
      // AI Plan has expired! Automatically convert to free plan
      const targetPlan = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      if (targetPlan) {
        currentPlanId = targetPlan.id;
        aiPlanExpiresAt = null;
        aiPlanStartsAt = null;
        await prisma.user.update({
          where: { id: userId },
          data: {
            aiCapPlanId: targetPlan.id,
            aiPlanStartsAt: null,
            aiPlanExpiresAt: null,
            aiPlanExpiryWarnedAt: null,
          }
        });
      }
    }

    let planId = currentPlanId;
    let plan = planId
      ? await prisma.aiCapPlan.findUnique({ where: { id: planId } })
      : null;

    // Check if user has an active premium subscription
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

    // 3. Process AI Plan Expiry Reminder (before 3 days)
    if (aiPlanExpiresAt && plan && plan.name !== 'free') {
      const expiryTime = new Date(aiPlanExpiresAt).getTime();
      const diffTime = expiryTime - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && diffDays > 0) {
        // Send email if not warned in the last 24h
        const lastWarned = user.aiPlanExpiryWarnedAt ? new Date(user.aiPlanExpiryWarnedAt) : null;
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        if (!lastWarned || lastWarned < oneDayAgo) {
          const { sendAiPlanExpiryReminderEmail } = await import("@/lib/mailer");
          await sendAiPlanExpiryReminderEmail(
            user.email,
            diffDays,
            new Date(aiPlanExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            user.name,
            user.id
          ).catch(console.error);

          await prisma.user.update({
            where: { id: userId },
            data: { aiPlanExpiryWarnedAt: now }
          }).catch(console.error);
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

    const remainingDays = aiPlanExpiresAt
      ? Math.max(0, Math.ceil((new Date(aiPlanExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

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

      aiPlanName: planName,
      aiPlanStartsAt: aiPlanStartsAt ? new Date(aiPlanStartsAt).toISOString() : null,
      aiPlanExpiresAt: aiPlanExpiresAt ? new Date(aiPlanExpiresAt).toISOString() : null,
      aiPlanRemainingDays: remainingDays,
    });
  } catch (error: any) {
    console.error("[AI_CAP_STATUS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
