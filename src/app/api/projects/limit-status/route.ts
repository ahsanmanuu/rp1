import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-pb";

export const runtime = "nodejs";

/**
 * GET /api/projects/limit-status
 * Returns whether the current free-tier user has reached the 5-project cap.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membership: true },
    });

    const membership = user?.membership || "free";
    if (membership !== "free") {
      return NextResponse.json({ limitReached: false, count: 0, max: null });
    }

    const [projectCount, citationCount, reviewCount] = await Promise.all([
      prisma.project.count({ where: { userId: session.user.id, status: "completed" } }),
      prisma.citationProject.count({ where: { userId: session.user.id, status: "completed" } }),
      prisma.paperReview.count({ where: { userId: session.user.id, status: "completed" } }),
    ]);

    const totalCount = projectCount + citationCount + reviewCount;
    const MAX = 7;
    return NextResponse.json({ limitReached: totalCount >= MAX, count: totalCount, max: MAX, membership });
  } catch (error: any) {
    console.error("Limit status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
