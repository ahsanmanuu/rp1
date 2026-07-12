import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCashfreeOrder } from "@/lib/cashfree";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("[CASHFREE_WEBHOOK] Received webhook payload:", payload);

    const orderId = payload.data?.order?.order_id || payload.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "No order ID found" }, { status: 400 });
    }

    // 1. Fetch transaction record
    const tx = await prisma.membershipTransaction.findUnique({
      where: { orderId }
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.paymentStatus === "paid") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    // 2. Fetch order status directly from Cashfree to prevent payload spoofing
    const cfOrder = await getCashfreeOrder(orderId);

    if (cfOrder.orderStatus === "PAID") {
      const user = await prisma.user.findUnique({
        where: { id: tx.userId },
        select: { membershipExpiresAt: true }
      });

      const now = new Date();
      const currentExpiry = user?.membershipExpiresAt && user.membershipExpiresAt > now
        ? new Date(user.membershipExpiresAt)
        : now;

      const newExpiry = new Date(currentExpiry.getTime() + tx.durationMonths * 30 * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.membershipTransaction.update({
          where: { orderId },
          data: { paymentStatus: "paid", expiresAt: newExpiry }
        }),
        prisma.user.update({
          where: { id: tx.userId },
          data: {
            membership: tx.planType,
            membershipExpiresAt: newExpiry
          }
        })
      ]);

      console.log(`[CASHFREE_WEBHOOK] Successfully verified and provisioned plan ${tx.planType} for user ${tx.userId}`);
      return NextResponse.json({ success: true, message: "Payment processed successfully" });
    } else {
      await prisma.membershipTransaction.update({
        where: { orderId },
        data: { paymentStatus: "failed" }
      });
      return NextResponse.json({ success: true, message: "Payment failed status updated" });
    }
  } catch (error: any) {
    console.error("[CASHFREE_WEBHOOK_ERROR] Webhook processing failed:", error);
    return NextResponse.json({ error: error.message || "Webhook processing failed" }, { status: 500 });
  }
}
