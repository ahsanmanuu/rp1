import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

// ── Seed default membership plans when PocketBase is empty ──
async function seedDefaultPlans() {
  try {
    const count = await prisma.membershipPlan.count();
    if (count > 0) return;

    const defaultPlans = [
      { planId: 'premium_1m', name: 'Premium Monthly', priceINR: 250, durationMonths: 1, pointsExchange: 250, description: '1 Month Premium Access — Full AI review, advanced LaTeX, priority support.' },
      { planId: 'premium_3m', name: 'Premium Quarterly', priceINR: 600, durationMonths: 3, pointsExchange: 500, description: '3 Months Premium Access — Best for semester projects.' },
      { planId: 'premium_6m', name: 'Premium Biannual', priceINR: 1000, durationMonths: 6, pointsExchange: 1000, description: '6 Months Premium Access — Save 17% vs monthly.' },
      { planId: 'premium_12m', name: 'Premium Annual', priceINR: 2200, durationMonths: 12, pointsExchange: 2200, description: '12 Months Premium Access — Best value, save 33%.' },
    ];

    for (const plan of defaultPlans) {
      try {
        await prisma.membershipPlan.create({ data: plan });
      } catch { /* skip duplicates */ }
    }
  } catch (err) {
    console.warn("[PLANS] Seed error (non-fatal):", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Seed default plans if empty
    await seedDefaultPlans();

    const plans = await prisma.membershipPlan.findMany({
      orderBy: { durationMonths: "asc" }
    });
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { planId, name, description, priceINR, durationMonths, pointsExchange } = body;

    if (!planId || !name || priceINR === undefined || !durationMonths || pointsExchange === undefined) {
      return NextResponse.json({ error: "Missing required fields: planId, name, priceINR, durationMonths, pointsExchange" }, { status: 400 });
    }

    // Check if planId already exists
    const existing = await prisma.membershipPlan.findUnique({ where: { planId } });
    if (existing) {
      return NextResponse.json({ error: `Plan with planId "${planId}" already exists` }, { status: 409 });
    }

    const newPlan = await prisma.membershipPlan.create({
      data: {
        planId,
        name,
        description: description || null,
        priceINR: parseFloat(priceINR),
        durationMonths: parseInt(durationMonths, 10),
        pointsExchange: parseInt(pointsExchange, 10),
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "CREATE_MEMBERSHIP_PLAN",
        targetTable: "membership_plans",
        targetId: newPlan.id,
        newValue: JSON.stringify(newPlan),
      }
    });

    return NextResponse.json({ success: true, plan: newPlan }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { planId, name, description, priceINR, durationMonths, pointsExchange } = body;

    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    const updatedPlan = await prisma.membershipPlan.update({
      where: { planId },
      data: {
        name,
        description,
        priceINR: priceINR !== undefined ? parseFloat(priceINR) : undefined,
        durationMonths: durationMonths !== undefined ? parseInt(durationMonths, 10) : undefined,
        pointsExchange: pointsExchange !== undefined ? parseInt(pointsExchange, 10) : undefined,
      }
    });

    // Log action to audit log
    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "UPDATE_MEMBERSHIP_PLAN",
        targetTable: "membership_plans",
        targetId: updatedPlan.id,
        newValue: JSON.stringify(updatedPlan),
      }
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Missing planId query parameter" }, { status: 400 });
    }

    const existing = await prisma.membershipPlan.findUnique({ where: { planId } });
    if (!existing) {
      return NextResponse.json({ error: `Plan "${planId}" not found` }, { status: 404 });
    }

    await prisma.membershipPlan.delete({ where: { planId } });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "DELETE_MEMBERSHIP_PLAN",
        targetTable: "membership_plans",
        targetId: existing.id,
        previousValue: JSON.stringify(existing),
      }
    });

    return NextResponse.json({ success: true, message: `Plan "${planId}" deleted successfully` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
