import { prisma } from "@/lib/prisma";
import { syncUserToPb } from "@/lib/pb-sync";

const DAY_MS = 1000 * 60 * 60 * 24;

export interface AiPlanActivation {
  planId: string;
  startsAt: Date;
  expiresAt: Date;
}

/**
 * Activates an AI plan for a user with compounding expiry:
 * extends from current expiry when already active, otherwise from now.
 * Propagates to PocketBase for realtime subscribers.
 */
export async function provisionAiPlan(
  userId: string,
  plan: { id: string; name: string; label: string },
  durationMonths: number
): Promise<AiPlanActivation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiPlanStartsAt: true, aiPlanExpiresAt: true },
  });
  if (!user) throw new Error("User not found");

  const now = new Date();
  const durationMs = durationMonths * 30 * DAY_MS;

  const currentExpiry = user.aiPlanExpiresAt && new Date(user.aiPlanExpiresAt) > now
    ? new Date(user.aiPlanExpiresAt)
    : null;

  const startsAt = currentExpiry ? user.aiPlanStartsAt || now : now;
  const expiresAt = new Date((currentExpiry || now).getTime() + durationMs);

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiCapPlanId: plan.id,
      aiPlanStartsAt: startsAt,
      aiPlanExpiresAt: expiresAt,
      aiPlanExpiryWarnedAt: null,
    },
  });

  await prisma.userAiCap.upsert({
    where: { userId_planId: { userId, planId: plan.id } },
    update: { customDailyCap: null, assignedBy: "self-service" },
    create: { userId, planId: plan.id, customDailyCap: null, assignedBy: "self-service" },
  }).catch(() => {});

  await syncUserToPb(userId, {
    aiCapPlanId: plan.id,
    aiPlanStartsAt: startsAt.toISOString(),
    aiPlanExpiresAt: expiresAt.toISOString(),
  }).catch(() => {});

  return { planId: plan.id, startsAt, expiresAt };
}
