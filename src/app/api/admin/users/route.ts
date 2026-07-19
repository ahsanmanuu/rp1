/**
 * /api/admin/users
 *
 * GET  → Full user list with plan, expiry, status, blacklist history, latest session activity, paid transactions, and blockedUntil.
 * PUT  → Supports three modes:
 *        1. Status/Blacklist update: { id, status, reason }
 *           - If status is 'active', it automatically clears both blacklistReason AND blockedUntil (reactivation).
 *        2. Subscription update: { id, membership, membershipExpiresAt }
 *        3. Points update: { id, points }
 *           - Runs transaction to update points, log pointTransaction, and trigger processPointsMembershipExchange.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { sendBlacklistEmail, sendReactivationEmail } from "@/lib/email";
import { processPointsMembershipExchange } from "@/lib/membershipExchange";
import { seedUsersDemoData } from "@/lib/seedUsers";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

function formatPlan(membership: string): string {
  const map: Record<string, string> = {
    free: "Free",
    premium_1m: "Pro – 1 Month",
    premium_3m: "Pro – 3 Months",
    premium_6m: "Pro – 6 Months",
    premium_12m: "Pro – 12 Months",
  };
  return map[membership] || membership;
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Seed demo users if PocketBase is empty
    await seedUsersDemoData();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        projects: { select: { id: true } },
        blacklistRecords: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            action: true,
            reason: true,
            adminEmail: true,
            createdAt: true,
          },
        },
        sessionActivities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            ipAddress: true,
            location: true,
            latitude: true,
            longitude: true,
            createdAt: true,
          },
        },
        membershipTransactions: {
          where: { paymentStatus: "paid" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderId: true,
            planType: true,
            amount: true,
            durationMonths: true,
            createdAt: true,
          },
        },
      },
    });

    const logs = await prisma.aiUsageLog.groupBy({
      by: ["userId"],
      _sum: { totalTokens: true },
    });

    const tokenMap: Record<string, number> = {};
    logs.forEach((log: any) => {
      if (log.userId) tokenMap[log.userId] = log._sum.totalTokens || 0;
    });

    const result = users.map((u: any) => {
      const lastSession = u.sessionActivities?.[0] || null;
      return {
        id: u.id,
        name: u.name || "Unnamed Scholar",
        email: u.email,
        membership: formatPlan(u.membership || "free"),
        membershipRaw: u.membership || "free",
        membershipExpiresAt: u.membershipExpiresAt || null,
        points: u.points,
        aiTokensUsed: tokenMap[u.id] || 0,
        projectCount: u.projects?.length || 0,
        status: u.status || "active",
        blacklistReason: u.blacklistReason || null,
        blacklistHistory: u.blacklistRecords || [],
        blockedUntil: u.blockedUntil || null,
        lastIp: lastSession?.ipAddress || null,
        lastLocation: lastSession?.location || null,
        lastLatitude: lastSession?.latitude ?? null,
        lastLongitude: lastSession?.longitude ?? null,
        joiningDate: u.createdAt,
        paidTransactions: u.membershipTransactions || [],
        role: u.role || "user",
        createdAt: u.createdAt,
        aiPlanStartsAt: u.aiPlanStartsAt || null,
        aiPlanExpiresAt: u.aiPlanExpiresAt || null,
        aiCapPlanId: u.aiCapPlanId || null,
      };
    });

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringUsers = await prisma.user.findMany({
      where: {
        membershipExpiresAt: {
          gte: now,
          lte: threeDaysLater,
        },
        membership: { not: "free" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        membership: true,
        membershipExpiresAt: true,
      },
    });
    const expiryNotifications = expiringUsers.map((u: any) => {
      const expiresAt = new Date(u.membershipExpiresAt);
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: u.id,
        userId: u.id,
        userEmail: u.email,
        userName: u.name || "User",
        planType: u.membership,
        expiresAt: u.membershipExpiresAt,
        daysRemaining,
      };
    });

    return NextResponse.json({ success: true, users: result, expiryNotifications, adminEmail: ADMIN_EMAIL });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── PUT — Update User Status, Subscription or Points ──────────────────────────
export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true, status: true, blockedUntil: true, membership: true, membershipExpiresAt: true, points: true },
    });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // MODE 3: Points Update
    if ("points" in body) {
      const newPoints = parseInt(body.points, 10);
      if (isNaN(newPoints) || newPoints < 0) {
        return NextResponse.json({ error: "Invalid points value" }, { status: 400 });
      }

      const diff = newPoints - (existingUser.points || 0);

      const updated = await prisma.$transaction(async (tx: any) => {
        // 1. Update points
        const u = await tx.user.update({
          where: { id },
          data: { points: newPoints },
          select: { id: true, points: true, membership: true, membershipExpiresAt: true }
        });

        // 2. Record point transaction
        if (diff !== 0) {
          await tx.pointTransaction.create({
            data: {
              userId: id,
              amount: diff,
              type: diff > 0 ? "recharge" : "deduct",
              description: `Admin adjusted points (New balance: ${newPoints} points)`,
            }
          });
        }

        // 3. Trigger Points-to-Membership package auto-exchange check inside the transaction
        await processPointsMembershipExchange(id, tx);

        // Fetch user state after exchange (since it might have deducted points and given plan)
        const freshUser = await tx.user.findUnique({
          where: { id },
          select: { id: true, points: true, membership: true, membershipExpiresAt: true }
        });

        return freshUser;
      });

      return NextResponse.json({ success: true, user: updated, mode: "points" });
    }

    // MODE 1: Subscription Update
    if ("membership" in body || "membershipExpiresAt" in body || "aiPlanExpiresAt" in body || "aiCapPlanId" in body || "aiPlanStartsAt" in body) {
      const membership = "membership" in body ? body.membership : existingUser.membership;
      const { membershipExpiresAt, aiPlanExpiresAt, aiCapPlanId, aiPlanStartsAt } = body;
      let finalExpiry: Date | null = null;
      if (membership !== "free" && membershipExpiresAt) {
        const parsed = new Date(membershipExpiresAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid expiration date" }, { status: 400 });
        }
        finalExpiry = parsed;
      }

      const prevPlan = existingUser.membership;
      const newPlan = membership || "free";

      let txPromise: any = null;
      if (newPlan !== "free" && prevPlan !== newPlan) {
        let duration = 1;
        if (newPlan.includes("3m")) duration = 3;
        else if (newPlan.includes("6m")) duration = 6;
        else if (newPlan.includes("12m")) duration = 12;

        txPromise = prisma.membershipTransaction.create({
          data: {
            userId: id,
            orderId: `manual_${Date.now()}_${id.slice(-4)}`,
            planType: newPlan,
            amount: 0.0,
            durationMonths: duration,
            paymentStatus: "paid",
            startsAt: new Date(),
            expiresAt: finalExpiry || new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000),
          }
        });
      }

      const updateData: any = {
        membership: newPlan,
        membershipExpiresAt: finalExpiry,
      };

      if ("aiCapPlanId" in body) {
        updateData.aiCapPlanId = aiCapPlanId || null;
      }
      if ("aiPlanExpiresAt" in body) {
        updateData.aiPlanExpiresAt = aiPlanExpiresAt ? new Date(aiPlanExpiresAt) : null;
      }
      if ("aiPlanStartsAt" in body) {
        updateData.aiPlanStartsAt = aiPlanStartsAt ? new Date(aiPlanStartsAt) : null;
      }

      const updatePromise = prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          membership: true,
          membershipExpiresAt: true,
          aiCapPlanId: true,
          aiPlanStartsAt: true,
          aiPlanExpiresAt: true
        }
      });

      const updated = txPromise
        ? await prisma.$transaction([txPromise, updatePromise]).then((res: any[]) => res[1])
        : await updatePromise;

      // Sync subscription change to PocketBase
      try {
        const { syncSubscriptionToPb } = await import('@/lib/pb-sync');
        await syncSubscriptionToPb(id, newPlan, finalExpiry);
      } catch {
        // Non-fatal: PB sync failure should not block the response
      }

      return NextResponse.json({ success: true, user: updated, mode: "subscription" });
    }

    // MODE 2: Status/Blacklist Update
    const { status, reason } = body;
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const isBeingBlacklisted = status === "blacklisted";
    const isBeingReactivated = status === "active";
    const finalReason = isBeingBlacklisted
      ? (reason?.trim() || "Violation of platform terms of service.")
      : null;

    // Atomic: update user + write audit record in a single transaction
    const [updatedUser, auditRecord] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          status,
          blacklistReason: finalReason,
          // If reactivating to active state, clear blockedUntil to lift any temporary block immediately
          blockedUntil: isBeingReactivated ? null : undefined,
        },
        select: { id: true, status: true, blacklistReason: true, blockedUntil: true },
      }),
      prisma.blacklistRecord.create({
        data: {
          userId: id,
          action: isBeingBlacklisted ? "blacklisted" : "reactivated",
          reason: isBeingBlacklisted ? finalReason : (reason?.trim() || "Account reactivation request processed."),
          adminEmail: session.email || ADMIN_EMAIL,
          adminId: session.adminId || null,
        },
      }),
    ]);

    // Non-blocking email notifications
    const userName = existingUser.name || "User";
    if (isBeingBlacklisted) {
      sendBlacklistEmail(existingUser.email, userName, finalReason || undefined, id).catch(() => {});
    } else if (isBeingReactivated) {
      sendReactivationEmail(existingUser.email, userName, id).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      mode: "status",
      auditRecord: {
        id: auditRecord.id,
        action: auditRecord.action,
        reason: auditRecord.reason,
        adminEmail: auditRecord.adminEmail,
        createdAt: auditRecord.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
