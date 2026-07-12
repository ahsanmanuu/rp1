import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCashfreeOrder } from "@/lib/cashfree";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId, promoCode } = await req.json();
    
    // Fetch plan from database dynamically
    let plan = await prisma.membershipPlan.findUnique({
      where: { planId }
    });

    if (!plan) {
      // Fallback static plans in case DB is not seeded yet
      const staticPlans: Record<string, any> = {
        "premium_1m": { planId: "premium_1m", name: "1 Month Pro", priceINR: 250, durationMonths: 1, pointsExchange: 250 },
        "premium_3m": { planId: "premium_3m", name: "3 Months Pro", priceINR: 600, durationMonths: 3, pointsExchange: 500 },
        "premium_6m": { planId: "premium_6m", name: "6 Months Pro", priceINR: 1000, durationMonths: 6, pointsExchange: 1000 },
        "premium_12m": { planId: "premium_12m", name: "1 Year Pro", priceINR: 2200, durationMonths: 12, pointsExchange: 2000 },
      };
      plan = staticPlans[planId];
    }

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const orderId = `cf_${Date.now()}_${(session.user as any).id.slice(-6)}`;
    const expiresAt = new Date(Date.now() + plan.durationMonths * 30 * 24 * 60 * 60 * 1000);

    // Apply promo code discount if provided
    const basePriceINR = plan.priceINR;
    let discountINR = 0;

    if (promoCode) {
      const uppercaseCode = promoCode.toUpperCase().trim();
      const offer = await prisma.offer.findUnique({
        where: { code: uppercaseCode }
      });

      if (offer && offer.isActive) {
        const now = new Date();
        const isNotExpired = new Date(offer.expiresAt).getTime() > now.getTime();
        const isTargeted = offer.offerType !== "USER" || offer.userEmail?.toLowerCase().trim() === session.user.email?.toLowerCase().trim();

        if (isNotExpired && isTargeted) {
          if (offer.discountPercent) {
            discountINR = basePriceINR * (offer.discountPercent / 100);
          } else if (offer.discountAmount) {
            discountINR = offer.discountAmount;
          }
        }
      }
    }

    const finalPriceINR = Math.max(0, basePriceINR - discountINR);
    const txnAmount = Math.round(finalPriceINR * 100) / 100;
    const txnCurrency = 'INR';

    // Save pending transaction
    await prisma.membershipTransaction.create({
      data: {
        userId: (session.user as any).id,
        orderId,
        planType: planId,
        amount: txnAmount,
        currency: txnCurrency,
        durationMonths: plan.durationMonths,
        paymentStatus: "pending",
        startsAt: new Date(),
        expiresAt
      }
    });

    const host = req.headers.get("host") || "localhost:3000";
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1") || host.includes("3000");
    const protocol = isLocal ? "http" : "https";
    const returnUrl = `${protocol}://${host}/api/payments/cashfree/callback?order_id={order_id}`;

    // Call Cashfree
    const orderData = await createCashfreeOrder({
      orderId,
      amount: txnAmount,
      customerEmail: session.user.email || "user@latexify.io",
      customerId: (session.user as any).id,
      returnUrl
    });

    console.log("[CREATE_ORDER] Order created successfully:", orderId);

    return NextResponse.json({
      success: true,
      orderId,
      paymentSessionId: orderData.paymentSessionId,
      cashfreeEnv: process.env.CASHFREE_ENV || "test"
    });
  } catch (error: any) {
    console.error("[CASHFREE_ORDER_CREATE] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate payment" }, { status: 500 });
  }
}
