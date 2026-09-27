import { prisma } from "@/lib/prisma";

export const FREE_PROJECT_LIMIT = 7;

export interface ProjectLimitStatus {
  count: number;
  max: number | null;
  limitReached: boolean;
  isProjectLimitReached: boolean;
  isPremium: boolean;
  membership: string;
}

/**
 * Calculates the user's cumulative project count across all tools.
 * CRITICAL RULE: Project count MUST NEVER decrease when a user deletes a project.
 * It takes the maximum of lifetimeProjectsCount (cumulative creation counter)
 * and the current active projects count across Project, CitationProject, and PaperReview.
 */
export async function getEffectiveProjectCount(userId: string): Promise<ProjectLimitStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      membership: true,
      membershipExpiresAt: true,
      lifetimeProjectsCount: true,
    },
  });

  const now = new Date();
  let membership = user?.membership || "free";
  const isExpired = membership !== "free" && user?.membershipExpiresAt && new Date(user.membershipExpiresAt) <= now;

  if (isExpired) {
    await prisma.user.update({
      where: { id: userId },
      data: { membership: "free", membershipExpiresAt: null },
    }).catch(() => {});
    membership = "free";
  }

  const isPremium = membership !== "free" && (!user?.membershipExpiresAt || new Date(user.membershipExpiresAt) > now);

  const [projectCount, citationCount, reviewCount] = await Promise.all([
    prisma.project.count({ where: { userId } }).catch(() => 0),
    prisma.citationProject.count({ where: { userId } }).catch(() => 0),
    prisma.paperReview.count({ where: { userId } }).catch(() => 0),
  ]);

  const activeTotal = projectCount + citationCount + reviewCount;
  const lifetimeStored = user?.lifetimeProjectsCount || 0;
  const effectiveCount = Math.max(lifetimeStored, activeTotal);

  // If active projects exceed recorded lifetime count (e.g. existing projects before tracking field was added),
  // sync lifetimeProjectsCount upwards so it never regresses even after future deletions.
  if (activeTotal > lifetimeStored) {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeProjectsCount: activeTotal },
    }).catch(() => {});
  }

  const isProjectLimitReached = !isPremium && effectiveCount >= FREE_PROJECT_LIMIT;

  return {
    count: effectiveCount,
    max: isPremium ? null : FREE_PROJECT_LIMIT,
    limitReached: isProjectLimitReached,
    isProjectLimitReached,
    isPremium,
    membership,
  };
}

/**
 * Increments the user's lifetime cumulative projects count.
 * Called whenever a project, diagram, citation bibliography, or paper review is created.
 */
export async function recordProjectCreation(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeProjectsCount: true },
    });

    const currentCount = user?.lifetimeProjectsCount || 0;
    const newCount = currentCount + 1;

    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeProjectsCount: { increment: 1 } },
    });

    return newCount;
  } catch (error) {
    console.error(`[ProjectLimits] Error recording project creation for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Asserts whether a user is allowed to create a new project.
 * Throws or returns an error response object if the free 7-project limit is reached.
 */
export async function assertProjectCreationAllowed(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const status = await getEffectiveProjectCount(userId);
  if (status.isProjectLimitReached) {
    return {
      allowed: false,
      message: `Free membership is restricted to a total of ${FREE_PROJECT_LIMIT} projects across all tools. Please upgrade to Premium.`,
    };
  }
  return { allowed: true };
}
