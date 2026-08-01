import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";

export const dynamic = "force-dynamic";

function isFreshRequest(req: NextRequest | undefined): boolean {
  return req?.nextUrl.searchParams.get("fresh") === "1";
}

function remainingDays(target: Date | null | undefined): number | null {
  if (!target) return null;
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const [user, usage, freePlan, proPlan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          membership: true,
          membershipExpiresAt: true,
          aiCapPlanId: true,
          aiPlanExpiresAt: true,
          aiPlanStartsAt: true,
          aiPlanExpiryWarnedAt: true,
          aiDailyCapOverride: true,
          aiAgentReactivatesAt: true,
        },
      }),
      prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      prisma.aiCapPlan.findFirst({ where: { name: 'free', isActive: true } }),
      prisma.aiCapPlan.findFirst({ where: { name: 'pro', isActive: true } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPremium = user.membership !== 'free' && user.membershipExpiresAt && new Date(user.membershipExpiresAt) > now;
    let effectiveAiPlanId = user.aiCapPlanId;
    let effectiveAiPlanExpiresAt = user.aiPlanExpiresAt;
    let effectiveAiPlanStartsAt = user.aiPlanStartsAt;

    if (user.aiPlanExpiresAt && new Date(user.aiPlanExpiresAt) <= now) {
      const targetPlan = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      effectiveAiPlanId = targetPlan?.id ?? null;
      effectiveAiPlanExpiresAt = null;
      effectiveAiPlanStartsAt = null;
      await prisma.user.update({
        where: { id: userId },
        data: { aiCapPlanId: effectiveAiPlanId, aiPlanStartsAt: null, aiPlanExpiresAt: null, aiPlanExpiryWarnedAt: null },
      }).catch(() => {});
    }

    if (isPremium) {
      if (!effectiveAiPlanId || ((await prisma.aiCapPlan.findUnique({ where: { id: effectiveAiPlanId } }))?.name === 'free')) {
        const pro = proPlan || await prisma.aiCapPlan.findFirst({ where: { name: 'pro' } });
        if (pro) {
          effectiveAiPlanId = pro.id;
          await prisma.user.update({ where: { id: userId }, data: { aiCapPlanId: pro.id } }).catch(() => {});
        }
      }
    } else {
      if (!effectiveAiPlanId || ((await prisma.aiCapPlan.findUnique({ where: { id: effectiveAiPlanId } }))?.name === 'pro')) {
        const free = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
        if (free) {
          effectiveAiPlanId = free.id;
          await prisma.user.update({ where: { id: userId }, data: { aiCapPlanId: free.id } }).catch(() => {});
        }
      }
    }

    const plan = effectiveAiPlanId ? await prisma.aiCapPlan.findUnique({ where: { id: effectiveAiPlanId } }) : null;

    const projectCount = await prisma.project.count({ where: { userId } });
    const citationCount = await prisma.citationProject.count({ where: { userId } });
    const reviewCount = await prisma.paperReview.count({ where: { userId } });
    const totalProjects = projectCount + citationCount + reviewCount;

    const dailyCap = user.aiDailyCapOverride || plan?.dailyTokenCap || 0;
    const usedToday = usage?.totalTokens ?? 0;
    const remaining = Math.max(0, dailyCap - usedToday);
    const isCapped = remaining === 0 && dailyCap > 0;

    const todayUtcMidnight = new Date(today + 'T00:00:00.000Z');
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

    const aiReminderShown = user.aiPlanExpiryWarnedAt ? new Date(user.aiPlanExpiryWarnedAt) > new Date(now.getTime() - 24 * 60 * 60 * 1000) : false;

    return NextResponse.json({
      success: true,
      membership: {
        planType: user.membership,
        expiresAt: iso(user.membershipExpiresAt),
        daysRemaining: remainingDays(user.membershipExpiresAt),
        isPremium,
      },
      projects: {
        count: totalProjects,
        max: user.membership === 'free' ? 7 : null,
        limitReached: user.membership === 'free' && totalProjects >= 7,
      },
      ai: {
        planId: plan?.id ?? null,
        planType: plan?.name ?? 'free',
        dailyTokenCap: dailyCap,
        usedToday,
        remaining,
        percentage: dailyCap > 0 ? (usedToday / dailyCap) * 100 : 0,
        isCapped,
        reactivateAt: isCapped && user.aiAgentReactivatesAt ? user.aiAgentReactivatesAt.toISOString() : null,
        quotaResetAt: nextResetUtc.toISOString(),
        showReminder: aiReminderShown,
      },
    });
  } catch (error: any) {
    console.error("[QUOTA_STATUS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}