import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { seedAiCapsDemoData } from "@/lib/seedAiCaps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seed demo data if PocketBase collections are empty
  await seedAiCapsDemoData();

  try {
    const plans = await prisma.aiCapPlan.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Fetch ALL users with their plan IDs in one query, then group count by plan
    const allUsers = await prisma.user.findMany({
      where: { aiCapPlanId: { not: null } },
      select: { aiCapPlanId: true },
    });
    const userCountByPlan: Record<string, number> = {};
    for (const u of allUsers) {
      if (u.aiCapPlanId) {
        userCountByPlan[u.aiCapPlanId] = (userCountByPlan[u.aiCapPlanId] || 0) + 1;
      }
    }

    const enriched = plans.map((plan: any) => ({
      ...plan,
      _count: { users: userCountByPlan[plan.id] || 0 },
    }));

    return NextResponse.json({ success: true, plans: enriched });
  } catch (error: any) {
    console.error("Failed to fetch AI cap plans:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, label, dailyTokenCap, description } = body;

    if (!name || !label || dailyTokenCap === undefined) {
      return NextResponse.json({ error: "Missing required fields: name, label, dailyTokenCap" }, { status: 400 });
    }

    const existing = await prisma.aiCapPlan.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: `Plan with name "${name}" already exists` }, { status: 409 });
    }

    const plan = await prisma.aiCapPlan.create({
      data: {
        name,
        label,
        dailyTokenCap: parseInt(dailyTokenCap, 10),
        description: description || null,
      },
    });

    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create AI cap plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, label, dailyTokenCap, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing plan ID" }, { status: 400 });
    }

    const existing = await prisma.aiCapPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = await prisma.aiCapPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(label !== undefined && { label }),
        ...(dailyTokenCap !== undefined && { dailyTokenCap: parseInt(dailyTokenCap, 10) }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error("Failed to update AI cap plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing plan ID" }, { status: 400 });
    }

    const existing = await prisma.aiCapPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = await prisma.$transaction(async (tx: any) => {
      // Remove references in User model
      await tx.user.updateMany({
        where: { aiCapPlanId: id },
        data: { aiCapPlanId: null },
      });

      // Delete assignments
      await tx.userAiCap.deleteMany({
        where: { planId: id },
      });

      // Delete the plan itself
      return await tx.aiCapPlan.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    console.error("Failed to delete AI cap plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
