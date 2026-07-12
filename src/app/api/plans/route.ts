import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public endpoint — no auth required.
 * Returns all membership plans sorted by duration for use in user-facing UI
 * (dashboard points auto-exchange widget, upgrade cards, etc.)
 */
export async function GET(_req: NextRequest) {
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
      }
    });
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
