import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));

    if (!userId) {
      return NextResponse.json({ error: "Missing userId query parameter" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        aiCapPlanId: true,
        aiDailyCapOverride: true,
        aiAgentReactivatesAt: true,
        aiCapPlan: {
          select: {
            id: true,
            name: true,
            label: true,
            dailyTokenCap: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const history = await prisma.aiUsageDailySummary.findMany({
      where: {
        userId,
        date: { gte: cutoffStr },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      success: true,
      user,
      history,
    });
  } catch (error: any) {
    console.error("Failed to fetch usage history:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, customCap, reactivationDate } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (customCap !== undefined) {
      updateData.aiDailyCapOverride = customCap;
    }
    if (reactivationDate !== undefined) {
      updateData.aiAgentReactivatesAt = reactivationDate ? new Date(reactivationDate) : null;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update user AI cap settings:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
