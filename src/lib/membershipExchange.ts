import { prisma } from "./prisma";

/**
 * Synchronizes the user's active membership plan type and cumulative expiration date.
 * It scans all paid MembershipTransactions, chains their startsAt/expiresAt values,
 * and updates the User's active status.
 */
export async function syncUserMembershipChain(userId: string, txContext?: any) {
  const tx = txContext || prisma;
  const now = new Date();

  // Guard: if user doesn't exist, bail early to avoid P2025
  const userExists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists) return null;

  // Get all paid membership transactions in order of purchase
  const transactions = await tx.membershipTransaction.findMany({
    where: { userId, paymentStatus: "paid" },
    orderBy: { createdAt: "asc" },
  });

  if (transactions.length === 0) {
    // No transactions, reset user to free
    await tx.user.update({
      where: { id: userId },
      data: {
        membership: "free",
        membershipExpiresAt: null,
      },
    });
    return null;
  }

  // Re-calculate dates for the entire transaction chain to ensure consistency
  let lastExpiry = now;
  const updatedTransactionsData = [];
  let activePlanType = "free";

  for (const trans of transactions) {
    let startsAt = new Date(trans.createdAt);
    
    // If there is an active plan already running, this one starts after it
    if (lastExpiry > startsAt) {
      startsAt = lastExpiry;
    }

    const durationDays = trans.durationMonths * 30; // standard 30-day billing month
    const expiresAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update the transaction in the database if the calculated dates changed
    if (trans.startsAt.getTime() !== startsAt.getTime() || trans.expiresAt.getTime() !== expiresAt.getTime()) {
      await tx.membershipTransaction.update({
        where: { id: trans.id },
        data: { startsAt, expiresAt },
      });
    }

    // Determine which plan type is currently active
    if (startsAt <= now && expiresAt >= now) {
      activePlanType = trans.planType;
    }

    updatedTransactionsData.push({ startsAt, expiresAt, planType: trans.planType });
    lastExpiry = expiresAt;
  }

  // If no transaction is active right now but the chain expires in the future,
  // the first queued plan is considered active.
  if (activePlanType === "free" && lastExpiry > now) {
    const nextActive = updatedTransactionsData.find(t => t.expiresAt > now);
    if (nextActive) {
      activePlanType = nextActive.planType;
    }
  }

  const finalUser = await tx.user.update({
    where: { id: userId },
    data: {
      membership: lastExpiry > now ? activePlanType : "free",
      membershipExpiresAt: lastExpiry > now ? lastExpiry : null,
    },
    select: {
      id: true,
      membership: true,
      membershipExpiresAt: true,
    }
  });

  return finalUser;
}

/**
 * Checks a user's points balance and automatically processes swaps for membership packages.
 * It will deduct points and queue membership packages iteratively until no more thresholds match.
 */
export async function processPointsMembershipExchange(userId: string, txContext?: any) {
  const db = txContext || prisma;

  // Fetch dynamic packages from database
  const dbPlans = await db.membershipPlan.findMany({
    orderBy: { pointsExchange: "desc" }
  });
  const packages = dbPlans.map((p: any) => ({
    points: p.pointsExchange,
    months: p.durationMonths,
    planType: p.planId
  }));

  // Run in a serial loop to handle multiple package matches if they have large points balances
  let exchangeOccurred = false;

  while (true) {
    // Get fresh user points inside the transaction
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { points: true, email: true },
    });

    if (!user) break;

    // Find the highest package they can afford
    const matchedPackage = packages.find((pkg: any) => user.points >= pkg.points);
    if (!matchedPackage) break;

    // Deduct points (skip silently if user was removed between check and write)
    await db.user.update({
      where: { id: userId },
      data: {
        points: {
          decrement: matchedPackage.points,
        },
      },
    }).catch((err: any) => {
      if (err?.code === 'P2025') return; // user vanished — skip silently
      throw err;
    });

    // Log the points deduction
    await db.pointTransaction.create({
      data: {
        userId,
        amount: -matchedPackage.points,
        type: "exchange",
        description: `Exchanged ${matchedPackage.points} points for ${matchedPackage.months} Month Premium Plan`,
      },
    });

    // Create a new paid membership transaction.
    // Temporary dates are set here; they are calculated precisely in syncUserMembershipChain.
    const now = new Date();
    await db.membershipTransaction.create({
      data: {
        userId,
        orderId: `pts_exch_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
        planType: matchedPackage.planType,
        amount: 0.0,
        durationMonths: matchedPackage.months,
        paymentStatus: "paid",
        startsAt: now,
        expiresAt: new Date(now.getTime() + matchedPackage.months * 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Log to system audit trail
    await db.auditLog.create({
      data: {
        adminId: "system-points-exchange",
        action: "POINTS_MEMBERSHIP_EXCHANGE",
        targetTable: "users",
        targetId: userId,
        newValue: JSON.stringify({
          deductedPoints: matchedPackage.points,
          planGranted: matchedPackage.planType,
          months: matchedPackage.months,
        }),
      },
    });

    exchangeOccurred = true;
  }

  if (exchangeOccurred) {
    // Re-sync the membership dates and user status
    await syncUserMembershipChain(userId, db);
  }
}
