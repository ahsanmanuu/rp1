import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCashfreeOrder } from "@/lib/cashfree";
import { getServerSession } from "@/lib/auth-pb";
import { ensureAiPlanCollections } from "@/lib/pbAiPlans";

export const dynamic = "force-dynamic";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Creates a Cashfree order for a paid AI plan.
 * Amount = plan.priceINR × durationMonths.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const body = await req.json().catch(() => ({}));
    const planName: string | undefined = body?.planName;
    const durationMonths: number = parseInt(body?.durationMonths, 10);

    if (!planName) {
      return NextResponse.json({ error: "Missing planName" }, { status: 400 });
    }
    if (!Number.isFinite(durationMonths) || durationMonths < 1 || durationMonths > 60) {
      return NextResponse.json({ error: "Invalid duration (1–60 months)" }, { status: 400 });
    }

    // Ensure PB schema exists before writing transactions
    await ensureAiPlanCollections();

    const plan = await prisma.aiCapPlan.findFirst({ where: { name: planName, isActive: true } });
    if (!plan) {
      return NextResponse.json({ error: "AI plan not found or inactive" }, { status: 404 });
    }
    if (!plan.priceINR || plan.priceINR <= 0) {
      return NextResponse.json({ error: "This plan is free — no payment required" }, { status: 400 });
    }

    const orderId = `cfai_${Date.now()}_${userId.slice(-6)}`;
    const totalINR = Math.round(plan.priceINR * durationMonths * 100) / 100;
    const expiresAt = new Date(Date.now() + durationMonths * 30 * DAY_MS);

    await prisma.aiPlanTransaction.create({
      data: {
        userId,
        orderId,
        planId: plan.id,
        planName: plan.name,
        amount: totalINR,
        currency: "INR",
        durationMonths,
        paymentStatus: "pending",
        startsAt: new Date(),
        expiresAt,
      },
    });

    const host = req.headers.get("host") || "localhost:3000";
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1") || host.includes("3000");
    const protocol = isLocal ? "http" : "https";
    const returnUrl = `${protocol}://${host}/api/payments/ai-plan/callback?order_id={order_id}`;

    const orderData = await createCashfreeOrder({
      orderId,
      amount: totalINR,
      customerEmail: session.user.email || "user@latexify.io",
      customerId: userId,
      returnUrl,
    });

    console.log("[AI_PLAN_ORDER] Order created:", orderId, "| amount:", totalINR);

    return NextResponse.json({
      success: true,
      orderId,
      amount: totalINR,
      planId: plan.id,
      planName: plan.name,
      planLabel: plan.label,
      durationMonths,
      paymentSessionId: orderData.paymentSessionId,
      cashfreeEnv: process.env.CASHFREE_ENV || "test",
    });
  } catch (error: any) {
    console.error("[AI_PLAN_ORDER_CREATE] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate payment" }, { status: 500 });
  }
}
