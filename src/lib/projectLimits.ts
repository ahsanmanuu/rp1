import { prisma } from "@/lib/prisma";
import { syncUserToPb } from "@/lib/pb-sync";

export const FREE_PROJECT_LIMIT = 7;

export interface ProjectLimitStatus {
  count: number;
  max: number | null;
  limitReached: boolean;
  isProjectLimitReached: boolean;
  isPremium: boolean;
  membership: string;
}

function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
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
      countedProjectIds: true,
      deletedProjectIds: true,
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

  const deletedIds = new Set(parseJsonArray(user?.deletedProjectIds));

  const [rawProjects, rawCitations, rawReviews] = await Promise.all([
    prisma.project.findMany({ where: { userId }, select: { id: true } }).catch(() => [] as { id: string }[]),
    prisma.citationProject.findMany({ where: { userId }, select: { id: true } }).catch(() => [] as { id: string }[]),
    prisma.paperReview.findMany({ where: { userId }, select: { id: true } }).catch(() => [] as { id: string }[]),
  ]);

  // Strictly filter out any project ID marked deleted (deleted projects must NEVER have a counter)
  const activeProjects = rawProjects.filter((p: { id: string }) => !deletedIds.has(p.id));
  const activeCitations = rawCitations.filter((c: { id: string }) => !deletedIds.has(c.id));
  const activeReviews = rawReviews.filter((r: { id: string }) => !deletedIds.has(r.id));

  const activeTotal = activeProjects.length + activeCitations.length + activeReviews.length;
  const lifetimeStored = user?.lifetimeProjectsCount || 0;
  const effectiveCount = Math.max(lifetimeStored, activeTotal);

  // If active projects exceed recorded lifetime count, sync lifetimeProjectsCount upwards
  // so it never regresses even after future deletions.
  if (activeTotal > lifetimeStored) {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeProjectsCount: activeTotal },
    }).catch(() => {});

    syncUserToPb(userId, { lifetimeProjectsCount: activeTotal }).catch(() => {});
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
 * Freezes the user's project counter before a project is deleted.
 * CRITICAL RULE: When a user deletes an active project, the dashboard counter MUST NOT CHANGE (never auto-decrease).
 * Also marks the projectId as permanently deleted so it cannot be counted in any active view.
 */
export async function freezeProjectCountOnDeletion(userId: string, projectId: string): Promise<number> {
  try {
    const currentStatus = await getEffectiveProjectCount(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeProjectsCount: true, deletedProjectIds: true },
    });

    const deletedIds = parseJsonArray(user?.deletedProjectIds);
    if (projectId && !deletedIds.includes(projectId)) {
      deletedIds.push(projectId);
    }

    // Freeze lifetimeProjectsCount to at least the current count before row deletion
    const frozenCount = Math.max(user?.lifetimeProjectsCount || 0, currentStatus.count);

    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimeProjectsCount: frozenCount,
        deletedProjectIds: JSON.stringify(deletedIds),
      },
    });

    await syncUserToPb(userId, {
      lifetimeProjectsCount: frozenCount,
      deletedProjectIds: JSON.stringify(deletedIds),
    }).catch(() => {});

    return frozenCount;
  } catch (error) {
    console.error(`[ProjectLimits] Error freezing count on deletion for user ${userId}:`, error);
    const fallbackStatus = await getEffectiveProjectCount(userId).catch(() => ({ count: 0 }));
    return fallbackStatus.count;
  }
}

/**
 * Counts a project when a user stays > 1 second on any tool,
 * or triggers build, compile, draw, search citation.
 * CRITICAL: Deleted projects must NEVER be counted.
 */
export async function countProjectActivity({
  userId,
  projectId,
  tool,
  action,
}: {
  userId: string;
  projectId?: string | null;
  tool: string;
  action: string;
}): Promise<{
  success: boolean;
  counted: boolean;
  count: number;
  max: number | null;
  limitReached: boolean;
  deleted?: boolean;
  alreadyCounted?: boolean;
  message?: string;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lifetimeProjectsCount: true,
        countedProjectIds: true,
        deletedProjectIds: true,
      },
    });

    if (!user) {
      return { success: false, counted: false, count: 0, max: 7, limitReached: false, message: 'User not found' };
    }

    const deletedIds = new Set(parseJsonArray(user.deletedProjectIds));

    // Guard: if this project was marked deleted, refuse to count it
    if (projectId && deletedIds.has(projectId)) {
      const currentStatus = await getEffectiveProjectCount(userId);
      return {
        success: false,
        counted: false,
        deleted: true,
        count: currentStatus.count,
        max: currentStatus.max,
        limitReached: currentStatus.limitReached,
        message: 'Deleted project cannot be counted',
      };
    }

    // Verify project exists and belongs to user if projectId is provided
    if (projectId) {
      const [proj, citation, review] = await Promise.all([
        prisma.project.findFirst({ where: { id: projectId, userId } }).catch(() => null),
        prisma.citationProject.findFirst({ where: { id: projectId, userId } }).catch(() => null),
        prisma.paperReview.findFirst({ where: { id: projectId, userId } }).catch(() => null),
      ]);

      if (!proj && !citation && !review) {
        // Project doesn't exist or was already deleted — do not count
        const currentStatus = await getEffectiveProjectCount(userId);
        return {
          success: false,
          counted: false,
          deleted: true,
          count: currentStatus.count,
          max: currentStatus.max,
          limitReached: currentStatus.limitReached,
          message: 'Project does not exist or has been deleted',
        };
      }
    }

    const countedIds = parseJsonArray(user.countedProjectIds);

    // If projectId is provided and already counted:
    if (projectId && countedIds.includes(projectId)) {
      const currentStatus = await getEffectiveProjectCount(userId);
      return {
        success: true,
        counted: true,
        alreadyCounted: true,
        count: currentStatus.count,
        max: currentStatus.max,
        limitReached: currentStatus.limitReached,
      };
    }

    // New project activity to record into lifetime counter
    if (projectId && !countedIds.includes(projectId)) {
      countedIds.push(projectId);
    }

    const currentStatus = await getEffectiveProjectCount(userId);
    const newCount = Math.max(currentStatus.count, (user.lifetimeProjectsCount || 0) + (projectId ? 1 : 0));

    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimeProjectsCount: newCount,
        countedProjectIds: JSON.stringify(countedIds),
      },
    });

    syncUserToPb(userId, {
      lifetimeProjectsCount: newCount,
      countedProjectIds: JSON.stringify(countedIds),
    }).catch(() => {});

    const updatedStatus = await getEffectiveProjectCount(userId);

    return {
      success: true,
      counted: true,
      count: updatedStatus.count,
      max: updatedStatus.max,
      limitReached: updatedStatus.limitReached,
    };
  } catch (error: any) {
    console.error(`[ProjectLimits] Error counting project activity (${tool} - ${action}):`, error);
    const status = await getEffectiveProjectCount(userId).catch(() => ({ count: 0, max: 7, limitReached: false }));
    return {
      success: false,
      counted: false,
      count: status.count,
      max: status.max,
      limitReached: status.limitReached,
      message: error?.message || 'Error updating counter',
    };
  }
}

/**
 * Increments the user's lifetime cumulative projects count.
 * Called whenever a project, diagram, citation bibliography, or paper review is created.
 */
export async function recordProjectCreation(userId: string, projectId?: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeProjectsCount: true, countedProjectIds: true },
    });

    const countedIds = parseJsonArray(user?.countedProjectIds);
    if (projectId && !countedIds.includes(projectId)) {
      countedIds.push(projectId);
    }

    const currentStatus = await getEffectiveProjectCount(userId);
    const newCount = Math.max(currentStatus.count + 1, (user?.lifetimeProjectsCount || 0) + 1);

    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimeProjectsCount: newCount,
        countedProjectIds: JSON.stringify(countedIds),
      },
    });

    syncUserToPb(userId, {
      lifetimeProjectsCount: newCount,
      countedProjectIds: JSON.stringify(countedIds),
    }).catch(() => {});

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
