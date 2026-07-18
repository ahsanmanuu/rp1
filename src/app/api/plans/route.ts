import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/plans
 * Public endpoint — returns all active membership plans created by admin.
 * Used by ProjectLimitModal to render real plan cards instead of hardcoded ones.
 * No auth required; only safe/public fields are exposed.
 */
export async function GET() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { durationMonths: "asc" },
      select: {
        planId: true,
        name: true,
        description: true,
        priceINR: true,
        durationMonths: true,
        pointsExchange: true,
      },
    });
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    console.error("[PUBLIC_PLANS_ERROR]", error);
    return NextResponse.json({ success: false, plans: [] });
  }
}
