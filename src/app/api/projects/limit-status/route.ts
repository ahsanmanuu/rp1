import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";

export const runtime = "nodejs";

/**
 * GET /api/projects/limit-status
 * Returns whether the current free-tier user has reached the 7-project cap.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membership: true, membershipExpiresAt: true },
    });

    const now = new Date();
    let membership = user?.membership || "free";
    const isExpired = membership !== "free" && user?.membershipExpiresAt && new Date(user.membershipExpiresAt) <= now;

    if (isExpired) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { membership: "free", membershipExpiresAt: null }
      }).catch(() => {});
      membership = "free";
    }

    const isPremium = membership !== "free" && (!user?.membershipExpiresAt || new Date(user.membershipExpiresAt) > now);
    if (isPremium) {
      return NextResponse.json({ limitReached: false, count: 0, max: null, membership });
    }

    const [projectCount, citationCount, reviewCount] = await Promise.all([
      prisma.project.count({ where: { userId: session.user.id } }),
      prisma.citationProject.count({ where: { userId: session.user.id } }),
      prisma.paperReview.count({ where: { userId: session.user.id } }),
    ]);

    const totalCount = projectCount + citationCount + reviewCount;
    const MAX = 7;
    return NextResponse.json({ limitReached: totalCount >= MAX, count: totalCount, max: MAX, membership });
  } catch (error: any) {
    console.error("Limit status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
