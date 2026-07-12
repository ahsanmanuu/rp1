import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, reactivatesAt } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let newTimestamp: Date | null = null;

    if (reactivatesAt) {
      const parsed = new Date(reactivatesAt);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid reactivatesAt date" }, { status: 400 });
      }
      // If the date is in the past or is null, clear it so user can use AI again
      if (parsed <= new Date()) {
        newTimestamp = null;
      } else {
        newTimestamp = parsed;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { aiAgentReactivatesAt: newTimestamp },
      select: {
        id: true,
        name: true,
        email: true,
        aiAgentReactivatesAt: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Failed to update reactivation time:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
