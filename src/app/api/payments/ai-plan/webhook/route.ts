import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCashfreeOrder } from "@/lib/cashfree";
import { provisionAiPlan } from "@/lib/aiPlanProvision";

export const dynamic = "force-dynamic";

/**
 * Cashfree server-to-server webhook for AI plan orders.
 * Re-fetches order status from Cashfree to prevent payload spoofing.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("[AI_PLAN_WEBHOOK] Received webhook payload:", payload);

    const orderId = payload.data?.order?.order_id || payload.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "No order ID found" }, { status: 400 });
    }

    const tx = await prisma.aiPlanTransaction.findUnique({ where: { orderId } });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.paymentStatus === "paid") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    const cfOrder = await getCashfreeOrder(orderId);

    if (cfOrder.orderStatus === "PAID") {
      const plan = await prisma.aiCapPlan.findUnique({ where: { id: tx.planId } });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      const activation = await provisionAiPlan(tx.userId, plan, tx.durationMonths);

      await prisma.aiPlanTransaction.update({
        where: { id: tx.id },
        data: { paymentStatus: "paid", startsAt: activation.startsAt, expiresAt: activation.expiresAt },
      });

      console.log(`[AI_PLAN_WEBHOOK] Provisioned plan ${tx.planName} for user ${tx.userId}`);
      return NextResponse.json({ success: true, message: "Payment processed successfully" });
    }

    await prisma.aiPlanTransaction.update({
      where: { id: tx.id },
      data: { paymentStatus: "failed" },
    });

    return NextResponse.json({ success: true, message: "Payment failed status updated" });
  } catch (error: any) {
    console.error("[AI_PLAN_WEBHOOK_ERROR] Webhook processing failed:", error);
    return NextResponse.json({ error: error.message || "Webhook processing failed" }, { status: 500 });
  }
}
