import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { planId, userIds, assignToAll, customDailyCap } = body;

    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    const plan = await prisma.aiCapPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!assignToAll && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
      return NextResponse.json({ error: "Provide userIds array or set assignToAll=true" }, { status: 400 });
    }

    const targetUsers = assignToAll
      ? await prisma.user.findMany({ where: { status: "active" }, select: { id: true } })
      : await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: "No valid users found" }, { status: 404 });
    }

    const cap = customDailyCap ? parseInt(customDailyCap, 10) : null;
    const adminEmail = session.email || "admin";

    for (const user of targetUsers) {
      await prisma.userAiCap.upsert({
        where: { userId_planId: { userId: user.id, planId } },
        update: {
          customDailyCap: cap,
          assignedBy: adminEmail,
        },
        create: {
          userId: user.id,
          planId,
          customDailyCap: cap,
          assignedBy: adminEmail,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { aiCapPlanId: planId },
      });
    }

    return NextResponse.json({
      success: true,
      assigned: targetUsers.length,
      plan: { id: plan.id, name: plan.name, label: plan.label },
    });
  } catch (error: any) {
    console.error("Failed to assign AI cap plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, planId } = body;

    if (!userId || !planId) {
      return NextResponse.json({ error: "Missing userId or planId" }, { status: 400 });
    }

    const existing = await prisma.userAiCap.findUnique({
      where: { userId_planId: { userId, planId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await prisma.userAiCap.delete({
      where: { userId_planId: { userId, planId } },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { aiCapPlanId: null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to remove AI cap assignment:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
