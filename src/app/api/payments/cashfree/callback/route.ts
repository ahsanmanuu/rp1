import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCashfreeOrder } from "@/lib/cashfree";

export const dynamic = 'force-dynamic';

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
    // 1. Fetch transaction record
    const tx = await prisma.membershipTransaction.findUnique({
      where: { orderId }
    });

    if (!tx) {
      return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=transaction_not_found`);
    }

    if (tx.paymentStatus === "paid") {
      return NextResponse.redirect(`${redirectBase}/dashboard?payment=success&plan=${tx.planType}`);
    }

    // 2. Query Cashfree to verify actual payment status
    const cfOrder = await getCashfreeOrder(orderId);

    if (cfOrder.orderStatus === "PAID") {
      // Get the user's current expiration to support compounding plans
      const user = await prisma.user.findUnique({
        where: { id: tx.userId },
        select: { membershipExpiresAt: true }
      });

      const now = new Date();
      const currentExpiry = user?.membershipExpiresAt && user.membershipExpiresAt > now
        ? new Date(user.membershipExpiresAt)
        : now;

      const newExpiry = new Date(currentExpiry.getTime() + tx.durationMonths * 30 * 24 * 60 * 60 * 1000);

      // Perform a transaction to update both tables
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

      return NextResponse.redirect(`${redirectBase}/dashboard?payment=success&plan=${tx.planType}`);
    } else {
      await prisma.membershipTransaction.update({
        where: { orderId },
        data: { paymentStatus: "failed" }
      });

      return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&reason=${cfOrder.orderStatus}`);
    }
  } catch (error: any) {
    console.error("[CASHFREE_CALLBACK_ERROR] Error handling payment callback:", error);
    return NextResponse.redirect(`${redirectBase}/dashboard?payment=failed&error=${encodeURIComponent(error.message)}`);
  }
}
