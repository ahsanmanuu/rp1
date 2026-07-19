import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpiryReminderEmail } from "@/lib/mailer";
import { syncUserMembershipChain } from "@/lib/membershipExchange";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

let pbCollectionsInitialized = false;

async function ensureStatusFieldsInPb() {
  if (pbCollectionsInitialized) return;
  try {
    const { pbAdmin } = await import('@/lib/pb');
    const pb = await pbAdmin();
    const collectionsToUpdate = ['citation_projects', 'paper_reviews'];
    for (const cName of collectionsToUpdate) {
      try {
        const coll = await pb.collections.getOne(cName);
        const hasStatus = coll.fields.some((f: any) => f.name === 'status');
        if (!hasStatus) {
          coll.fields.push({
            name: 'status',
            type: 'text',
            required: false,
            presentable: false,
          } as any);
          await pb.collections.update(coll.id, coll);
          console.log(`[INIT] Programmatically added status field to PocketBase collection: ${cName}`);
        }
      } catch (err: any) {
        console.warn(`[INIT] Failed to ensure status field for ${cName}:`, err.message);
      }
    }
    pbCollectionsInitialized = true;
  } catch (err: any) {
    console.warn('[INIT] Failed to initialize PocketBase collections:', err.message);
  }
}

const LIFECYCLE_CACHE = new Map<string, { plan: string; ts: number }>();

async function writeLifecycleLog(
  userId: string,
  fromPlan: string,
  toPlan: string,
  eventType: string,
  source: string,
  metadata?: Record<string, any>
) {
  try {
    await prisma.membershipLifecycleLog.create({
      data: {
        userId,
        fromPlan,
        toPlan,
        eventType,
        source,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });
  } catch (_) {
    // Non-fatal — log write failures should not block the response
  }
}

async function getMemberSince(userId: string): Promise<string | null> {
  try {
    const firstPaid = await prisma.membershipTransaction.findFirst({
      where: { userId, paymentStatus: "paid" },
      orderBy: { createdAt: 'asc' as const },
      select: { createdAt: true }
    });
    return firstPaid?.createdAt
      ? new Date(firstPaid.createdAt).toISOString()
      : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ success: true, showReminder: false });
  }

  const userId = (session.user as any).id;

  try {
    await ensureStatusFieldsInPb();
    await syncUserMembershipChain(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, name: true, membership: true,
        membershipExpiresAt: true, createdAt: true,
        points: true, memberSince: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: true, showReminder: false });
    }

    const now = new Date();

    // Determine memberSince: first paid transaction, then stored memberSince, then account creation
    let memberSince = user.memberSince ? new Date(user.memberSince).toISOString() : null;
    if (!memberSince) {
      memberSince = await getMemberSince(userId);
      if (memberSince) {
        await prisma.user.update({
          where: { id: userId },
          data: { memberSince: new Date(memberSince) }
        }).catch(() => {});
      } else {
        memberSince = user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString();
      }
    }

    const totalDays = Math.ceil((now.getTime() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24));

    const [subscriptionCount, projectCount, citationCount, reviewCount, doc2latexCount, latexCount, diagramCount] = await Promise.all([
      prisma.membershipTransaction.count({ where: { userId, paymentStatus: "paid" } }),
      prisma.project.count({ where: { userId } }),
      prisma.citationProject.count({ where: { userId } }),
      prisma.paperReview.count({ where: { userId } }),
      prisma.project.count({ where: { userId, projectType: "DOC2LATEX" } }),
      prisma.project.count({ where: { userId, projectType: "LATEX_STUDIO" } }),
      prisma.project.count({ where: { userId, projectType: "DIAGRAM" } })
    ]);

    const projectsCount = projectCount + citationCount + reviewCount;

    // Detect plan change and write lifecycle log
    const cacheKey = `membership_${userId}`;
    const cached = LIFECYCLE_CACHE.get(cacheKey);
    if (cached && cached.plan !== user.membership) {
      const eventType =
        user.membership === "free" ? "expiry" :
        cached.plan === "free" ? "activation" :
        "upgrade";
      await writeLifecycleLog(
        userId, cached.plan, user.membership, eventType, "auto_expiry",
        { membershipExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : undefined }
      );
    }
    LIFECYCLE_CACHE.set(cacheKey, { plan: user.membership, ts: Date.now() });

    // Check if membership has expired
    if (user.membership !== "free" && user.membershipExpiresAt) {
      const expiry = new Date(user.membershipExpiresAt);
      const diffTime = expiry.getTime() - now.getTime();

      if (diffTime <= 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { membership: "free", membershipExpiresAt: null }
        }).catch((err: any) => {
          if (err?.code === 'P2025') return;
          throw err;
        });

        await writeLifecycleLog(userId, user.membership, "free", "expiry", "auto_expiry");

        return NextResponse.json({
          success: true, showReminder: false, expired: true,
          membership: "free", membershipExpiresAt: null,
          memberSince, joiningDate: memberSince, totalDays, points: user.points,
          subscriptionCount, projectsCount, doc2latexCount, latexCount, diagramCount
        });
      }

      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 3 && diffDays > 0) {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const existingLog = await prisma.auditLog.findFirst({
          where: {
            adminId: "system-membership-cron",
            action: "MEMBERSHIP_EXPIRY_REMINDER",
            targetId: userId,
            createdAt: { gte: oneDayAgo }
          }
        });

        if (!existingLog) {
          await sendExpiryReminderEmail(
            user.email, diffDays, expiry.toLocaleDateString(), user.name, userId
          ).catch(() => {});

          await prisma.auditLog.create({
            data: {
              adminId: "system-membership-cron",
              action: "MEMBERSHIP_EXPIRY_REMINDER",
              targetTable: "users",
              targetId: userId,
              newValue: JSON.stringify({ diffDays, expiry })
            }
          }).catch(() => {});
        }

        return NextResponse.json({
          success: true, showReminder: true,
          daysLeft: diffDays, expiryDate: expiry.toLocaleDateString(),
          membership: user.membership, membershipExpiresAt: user.membershipExpiresAt,
          memberSince, joiningDate: memberSince, totalDays, points: user.points,
          subscriptionCount, projectsCount, doc2latexCount, latexCount, diagramCount
        });
      }
    }

    return NextResponse.json({
      success: true, showReminder: false,
      membership: user.membership, membershipExpiresAt: user.membershipExpiresAt,
      memberSince, joiningDate: memberSince, totalDays, points: user.points,
      subscriptionCount, projectsCount, doc2latexCount, latexCount, diagramCount
    });
  } catch (error: any) {
    console.error("[CHECK_MEMBERSHIP_ERROR] Failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
