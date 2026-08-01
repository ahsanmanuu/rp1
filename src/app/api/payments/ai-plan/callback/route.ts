import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCashfreeOrder } from "@/lib/cashfree";
import { provisionAiPlan } from "@/lib/aiPlanProvision";

export const dynamic = "force-dynamic";

/**
 * Cashfree return callback for AI plan orders.
 * Verifies payment server-side, then provisions the AI plan with
 * compounding expiry and redirects back to the dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");

  const host = req.headers.get("host") || "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1") || host.includes("3000");
  const protocol = isLocal ? "http" : "https";
  const redirectBase = `${protocol}://${host}`;

  if (!orderId) {
    return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=no_order_id`);
  }

  try {
    const tx = await prisma.aiPlanTransaction.findUnique({ where: { orderId } });

    if (!tx) {
      return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=transaction_not_found`);
    }

    if (tx.paymentStatus === "paid") {
      return NextResponse.redirect(`${redirectBase}/dashboard?payment=success&plan=${tx.planName}`);
    }

    const cfOrder = await getCashfreeOrder(orderId);

    if (cfOrder.orderStatus === "PAID") {
      const plan = await prisma.aiCapPlan.findUnique({ where: { id: tx.planId } });
      if (!plan) {
        return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=plan_not_found`);
      }

      const activation = await provisionAiPlan(tx.userId, plan, tx.durationMonths);

      await prisma.aiPlanTransaction.update({
        where: { id: tx.id },
        data: { paymentStatus: "paid", startsAt: activation.startsAt, expiresAt: activation.expiresAt },
      });

      return NextResponse.redirect(`${redirectBase}/dashboard?payment=success&plan=${tx.planName}`);
    }

    await prisma.aiPlanTransaction.update({
      where: { id: tx.id },
      data: { paymentStatus: "failed" },
    });

    return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=${cfOrder.orderStatus}`);
  } catch (error: any) {
    console.error("[AI_PLAN_CALLBACK_ERROR] Error handling payment callback:", error);
    return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&error=${encodeURIComponent(error.message)}`);
  }
}
