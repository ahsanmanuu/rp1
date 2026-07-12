import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: any = { date };
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [summaries, total] = await Promise.all([
      prisma.aiUsageDailySummary.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              aiCapPlanId: true,
              aiDailyCapOverride: true,
              aiAgentReactivatesAt: true,
            },
          },
        },
        orderBy: { totalTokens: "desc" },
        skip,
        take: limit,
      }),
      prisma.aiUsageDailySummary.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      users: summaries,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Failed to fetch AI usage:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
