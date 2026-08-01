import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";
import { syncUserToPb } from "@/lib/pb-sync";
import { ensureAiPlanCollections } from "@/lib/pbAiPlans";

export const dynamic = "force-dynamic";

const DAY_MS = 1000 * 60 * 60 * 24;

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function remainingDays(target: Date | null | undefined): number | null {
  if (!target) return null;
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / DAY_MS));
}

/**
 * Self-service AI subscription activation.
 * Sets aiCapPlanId + aiPlanStartsAt + aiPlanExpiresAt with compounding
 * (extends from the current expiry when the user is already active on an AI plan).
 * Free plans (priceINR = 0) activate instantly; paid plans require the
 * Cashfree order flow via /api/payments/ai-plan/create-order.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureAiPlanCollections();
    const session = await getServerSession().catch(() => null);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const body = await req.json().catch(() => ({}));
    const planName: string | undefined = body?.planName;
    const durationMonths: number = parseInt(body?.durationMonths, 10);

    if (!planName) {
      return NextResponse.json({ error: "Missing planName" }, { status: 400 });
    }
    if (!Number.isFinite(durationMonths) || durationMonths < 1 || durationMonths > 60) {
      return NextResponse.json({ error: "Invalid duration (1–60 months)" }, { status: 400 });
    }

    const plan = await prisma.aiCapPlan.findFirst({ where: { name: planName, isActive: true } });
    if (!plan) {
      return NextResponse.json({ error: "AI plan not found or inactive" }, { status: 404 });
    }

    // Paid plans must be purchased via the Cashfree flow — never activated for free.
    if (plan.priceINR && plan.priceINR > 0) {
      return NextResponse.json(
        {
          error: "PAYMENT_REQUIRED",
          message: `"${plan.label}" is a paid plan. Please complete payment to activate it.`,
          priceINR: plan.priceINR,
          totalINR: Math.round(plan.priceINR * durationMonths * 100) / 100,
          durationMonths,
          planName: plan.name,
        },
        { status: 402 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, aiCapPlanId: true, aiPlanStartsAt: true, aiPlanExpiresAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const durationMs = durationMonths * 30 * DAY_MS;

    // Compounding: extend from current expiry if the user is already on an active AI subscription
    const currentExpiry = user.aiPlanExpiresAt && new Date(user.aiPlanExpiresAt) > now
      ? new Date(user.aiPlanExpiresAt)
      : null;

    const startsAt = currentExpiry ? user.aiPlanStartsAt || now : now;
    const expiresAt = new Date((currentExpiry || now).getTime() + durationMs);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        aiCapPlanId: plan.id,
        aiPlanStartsAt: startsAt,
        aiPlanExpiresAt: expiresAt,
        aiPlanExpiryWarnedAt: null,
      },
      select: {
        id: true,
        aiCapPlanId: true,
        aiPlanStartsAt: true,
        aiPlanExpiresAt: true,
        aiDailyCapOverride: true,
        aiAgentReactivatesAt: true,
      },
    });

    // Track the assignment record (same shape the admin pipeline maintains)
    await prisma.userAiCap.upsert({
      where: { userId_planId: { userId, planId: plan.id } },
      update: { customDailyCap: null, assignedBy: "self-service" },
      create: { userId, planId: plan.id, customDailyCap: null, assignedBy: "self-service" },
    }).catch(() => {});

    // Propagate to PocketBase so realtime dashboard subscribers update silently
    await syncUserToPb(userId, {
      aiCapPlanId: plan.id,
      aiPlanStartsAt: startsAt.toISOString(),
      aiPlanExpiresAt: expiresAt.toISOString(),
    }).catch(() => {});

    const aiSummary = {
      planId: plan.id,
      planType: plan.name,
      planName: plan.label,
      planDescription: plan.description,
      priceINR: plan.priceINR ?? 0,
      status: "active",
      isPremiumTier: plan.name !== "free",
      startsAt: iso(startsAt),
      expiresAt: iso(expiresAt),
      remainingDays: remainingDays(expiresAt),
      durationDays: Math.round(durationMs / DAY_MS),
      dailyTokenCap: plan.dailyTokenCap,
      usedToday: 0,
      limit: plan.dailyTokenCap,
      remaining: plan.dailyTokenCap,
      percentage: 0,
      isCapped: false,
      reactivateAt: null,
      quotaResetAt: null,
      agentBreakdown: {},
      showReminder: false,
      daysLeft: undefined,
      expiryDate: expiresAt.toLocaleDateString(),
    };

    return NextResponse.json({
      success: true,
      message: `AI subscription "${plan.label}" activated for ${durationMonths} month${durationMonths > 1 ? 's' : ''}`,
      aiPlan: aiSummary,
    });
  } catch (error: any) {
    console.error("[AI_PLAN_SUBSCRIBE_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
