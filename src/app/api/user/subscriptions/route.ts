import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAiPlanExpiryReminderEmail } from "@/lib/mailer";
import { ensureAiPlanCollections } from "@/lib/pbAiPlans";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

function isFreshRequest(req: NextRequest | undefined): boolean {
  return req?.nextUrl.searchParams.get("fresh") === "1";
}

// Per-user response cache to avoid re-running heavy queries on every poll
const SUBSCRIPTION_CACHE = new Map<string, { data: any; expiry: number }>();
const SUBSCRIPTION_CACHE_TTL = 15_000; // 15 seconds

const DAY_MS = 1000 * 60 * 60 * 24;

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function remainingDays(target: Date | null | undefined): number | null {
  if (!target) return null;
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / DAY_MS));
}

function durationDays(start: Date | null | undefined, end: Date | null | undefined): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS));
}

async function getMemberSince(userId: string): Promise<string | null> {
  try {
    const firstPaid = await prisma.membershipTransaction.findFirst({
      where: { userId, paymentStatus: "paid" },
      orderBy: { createdAt: 'asc' as const },
      select: { createdAt: true }
    });
    return firstPaid?.createdAt ? new Date(firstPaid.createdAt).toISOString() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureAiPlanCollections();

    const session = await getServerSession().catch(() => null);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;

    const fresh = isFreshRequest(req);
    const cached = SUBSCRIPTION_CACHE.get(userId);
    if (!fresh && cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const [user, summary, freePlan, proPlan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          membership: true,
          membershipExpiresAt: true,
          memberSince: true,
          createdAt: true,
          points: true,
          aiCapPlanId: true,
          aiDailyCapOverride: true,
          aiAgentReactivatesAt: true,
          aiPlanStartsAt: true,
          aiPlanExpiresAt: true,
          aiPlanExpiryWarnedAt: true,
        },
      }),
      prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
      }),
      prisma.aiCapPlan.findFirst({ where: { name: 'free' } }),
      prisma.aiCapPlan.findFirst({ where: { name: 'pro' } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── 1. Membership auto-expiry (mirrors check-membership pipeline) ──
    let membership = user.membership;
    let membershipExpiresAt = user.membershipExpiresAt;
    let membershipExpired = false;

    if (membership !== "free" && membershipExpiresAt && new Date(membershipExpiresAt) <= now) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { membership: "free", membershipExpiresAt: null }
        });
        try {
          await prisma.membershipLifecycleLog.create({
            data: { userId, fromPlan: membership, toPlan: "free", eventType: "expiry", source: "auto_expiry" }
          });
        } catch {}
      } catch {}
      membership = "free";
      membershipExpiresAt = null;
      membershipExpired = true;
    }

    // ── 2. AI plan auto-expiry + premium↔pro auto-sync (mirrors ai-cap/status pipeline) ──
    let aiPlanId = user.aiCapPlanId;
    let aiPlanStartsAt = user.aiPlanStartsAt;
    let aiPlanExpiresAt = user.aiPlanExpiresAt;
    let aiPlanExpired = false;

    if (aiPlanExpiresAt && new Date(aiPlanExpiresAt) <= now) {
      const targetPlan = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      aiPlanId = targetPlan?.id ?? null;
      aiPlanExpiresAt = null;
      aiPlanStartsAt = null;
      aiPlanExpired = true;
      await prisma.user.update({
        where: { id: userId },
        data: {
          aiCapPlanId: aiPlanId,
          aiPlanStartsAt: null,
          aiPlanExpiresAt: null,
          aiPlanExpiryWarnedAt: null,
        }
      }).catch(() => {});
    }

    let plan = aiPlanId ? await prisma.aiCapPlan.findUnique({ where: { id: aiPlanId } }) : null;

    const isPremiumMember = membership !== "free" && (!membershipExpiresAt || new Date(membershipExpiresAt) > now);

    if (isPremiumMember) {
      if (!plan || plan.name === 'free') {
        const targetPlan = proPlan || await prisma.aiCapPlan.findFirst({ where: { name: 'pro' } });
        if (targetPlan) {
          plan = targetPlan;
          aiPlanId = targetPlan.id;
          await prisma.user.update({ where: { id: userId }, data: { aiCapPlanId: targetPlan.id } }).catch(() => {});
        }
      }
    } else {
      if (!plan || plan.name === 'pro') {
        const targetPlan = freePlan || await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
        if (targetPlan) {
          plan = targetPlan;
          aiPlanId = targetPlan.id;
          await prisma.user.update({ where: { id: userId }, data: { aiCapPlanId: targetPlan.id } }).catch(() => {});
        }
      }
    }

    // ── 3. AI plan expiry reminder email (≤3 days, once per 24h) ──
    let aiReminderShown = false;
    let membershipReminderShown = false;

    if (aiPlanExpiresAt && plan && plan.name !== 'free') {
      const diffDays = remainingDays(aiPlanExpiresAt);
      if (diffDays !== null && diffDays <= 3 && diffDays > 0) {
        aiReminderShown = true;
        const lastWarned = user.aiPlanExpiryWarnedAt ? new Date(user.aiPlanExpiryWarnedAt) : null;
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (!lastWarned || lastWarned < oneDayAgo) {
          await sendAiPlanExpiryReminderEmail(
            user.email,
            diffDays,
            new Date(aiPlanExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            user.name,
            user.id
          ).catch(() => {});
          await prisma.user.update({ where: { id: userId }, data: { aiPlanExpiryWarnedAt: now } }).catch(() => {});
        }
      }
    }

    if (membership !== "free" && membershipExpiresAt) {
      const diffDays = remainingDays(membershipExpiresAt);
      if (diffDays !== null && diffDays <= 3 && diffDays > 0) {
        membershipReminderShown = true;
      }
    }

    // ── 4. Membership summary (mirrors check-membership shape) ──
    let memberSince = user.memberSince ? new Date(user.memberSince).toISOString() : null;
    if (!memberSince) {
      memberSince = await getMemberSince(userId);
      if (!memberSince) memberSince = iso(user.createdAt) || new Date().toISOString();
    }
    const totalDays = Math.max(0, Math.ceil((now.getTime() - new Date(memberSince).getTime()) / DAY_MS));

    const [subscriptionCount, projectCount, citationCount, reviewCount] = await Promise.all([
      prisma.membershipTransaction.count({ where: { userId, paymentStatus: "paid" } }),
      prisma.project.count({ where: { userId } }),
      prisma.citationProject.count({ where: { userId } }),
      prisma.paperReview.count({ where: { userId } }),
    ]);

    const membershipSummary = {
      planType: membership,
      planName: membership === "free" ? "Free Tier" : "Premium Access",
      status: membership === "free" ? "free" : (membershipExpired ? "expired" : "active"),
      expiresAt: iso(membershipExpiresAt),
      startsAt: memberSince,
      memberSince,
      joiningDate: memberSince,
      remainingDays: remainingDays(membershipExpiresAt),
      durationDays: durationDays(memberSince ? new Date(memberSince) : null, membershipExpiresAt),
      subscriptionCount,
      totalDays,
      projectsCount: projectCount + citationCount + reviewCount,
      points: user.points,
      showReminder: membershipReminderShown,
      daysLeft: membershipReminderShown ? remainingDays(membershipExpiresAt) : undefined,
      expiryDate: membershipExpiresAt
        ? new Date(membershipExpiresAt).toLocaleDateString()
        : undefined,
    };

    // ── 5. AI plan summary (mirrors ai-cap/status shape) ──
    const dailyCap = user.aiDailyCapOverride || plan?.dailyTokenCap || 0;
    const usedToday = summary?.totalTokens ?? 0;
    const remaining = Math.max(0, dailyCap - usedToday);
    const isCapped = remaining === 0 && dailyCap > 0;

    let agentBreakdown: Record<string, number> = {};
    if (summary?.agentBreakdown) {
      try { agentBreakdown = JSON.parse(summary.agentBreakdown); } catch { agentBreakdown = {}; }
    }

    const todayUtcMidnight = new Date(today + 'T00:00:00.000Z');
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000);

    const aiSummary = {
      planId: plan?.id ?? null,
      planType: plan?.name ?? "free",
      planName: plan?.label ?? "Free Tier",
      planDescription: plan?.description ?? null,
      priceINR: plan?.priceINR ?? 0,
      status: aiPlanExpired ? "expired" : (plan && plan.name !== "free" ? "active" : "free"),
      isPremiumTier: !!plan && plan.name !== "free",
      startsAt: iso(aiPlanStartsAt),
      expiresAt: iso(aiPlanExpiresAt),
      remainingDays: remainingDays(aiPlanExpiresAt),
      durationDays: durationDays(aiPlanStartsAt, aiPlanExpiresAt),
      dailyTokenCap: dailyCap,
      usedToday,
      limit: dailyCap,
      remaining,
      percentage: dailyCap > 0 ? (usedToday / dailyCap) * 100 : 0,
      isCapped,
      reactivateAt: isCapped && user.aiAgentReactivatesAt ? user.aiAgentReactivatesAt.toISOString() : null,
      quotaResetAt: nextResetUtc.toISOString(),
      agentBreakdown,
      showReminder: aiReminderShown,
      daysLeft: aiReminderShown ? remainingDays(aiPlanExpiresAt) : undefined,
      expiryDate: aiPlanExpiresAt
        ? new Date(aiPlanExpiresAt).toLocaleDateString()
        : undefined,
    };

    // ── 6. Available AI plans for the subscription-taking option ──
    const availableAiPlans = await prisma.aiCapPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, label: true, dailyTokenCap: true, priceINR: true, description: true, isActive: true },
    });

    const data = {
      success: true,
      membership: membershipSummary,
      aiPlan: aiSummary,
      availableAiPlans,
    };

    SUBSCRIPTION_CACHE.set(userId, { data, expiry: Date.now() + SUBSCRIPTION_CACHE_TTL });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' },
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTIONS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
