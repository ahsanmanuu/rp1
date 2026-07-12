import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

function getISODateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Point/Credit transactions
    const pointTxs = await prisma.pointTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, points: true } }
      }
    });

    // 2. Membership plan payment transactions
    const membershipTxs = await prisma.membershipTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    let monthlyRevenue = 0;
    let pendingPayments = 0;
    let totalRefunds = 0;
    let pendingRefunds = 0;
    let failedPaymentsCount = 0;
    let failedPaymentsAmount = 0;
    let totalPointsCredited = 0;
    let successfulCheckoutsCount = 0;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper: get INR value for a points transaction (base: INR)
    const getPointsINR = (amount: number): number => {
      const absVal = Math.abs(amount);
      let inr = 0;
      if (absVal === 50)   inr = 415;   // Bronze: ₹415
      if (absVal === 200)  inr = 1245;  // Silver: ₹1245
      if (absVal === 1000) inr = 4150;  // Gold:   ₹4150
      if (inr === 0)       inr = Math.round(absVal * 8.3);
      return amount < 0 ? -inr : inr;
    };

    // Revenue from point recharges (in base INR)
    pointTxs.forEach((tx: any) => {
      const inrVal = getPointsINR(tx.amount);

      if (tx.type === 'recharge') {
        if (tx.amount > 0) totalPointsCredited += tx.amount;
        if (new Date(tx.createdAt) >= currentMonthStart) monthlyRevenue += inrVal;
        successfulCheckoutsCount++;
      } else if (tx.type === 'pending') {
        pendingPayments += inrVal;
      } else if (tx.type === 'refund') {
        totalRefunds += Math.abs(inrVal);
      } else if (tx.type === 'refund_pending') {
        pendingRefunds += Math.abs(inrVal);
      } else if (tx.type === 'failed') {
        failedPaymentsCount++;
        failedPaymentsAmount += inrVal;
      }
    });

    // Revenue from membership upgrades (amount already in INR)
    membershipTxs.forEach((tx: any) => {
      const inrVal = tx.amount; // already in INR
      if (tx.paymentStatus === 'paid') {
        if (new Date(tx.createdAt) >= currentMonthStart) monthlyRevenue += inrVal;
        successfulCheckoutsCount++;
      } else if (tx.paymentStatus === 'pending') {
        pendingPayments += inrVal;
      } else if (tx.paymentStatus === 'refunded') {
        totalRefunds += inrVal;
      } else if (tx.paymentStatus === 'refund_pending' || tx.paymentStatus === 'refunded_pending') {
        pendingRefunds += inrVal;
      } else if (tx.paymentStatus === 'failed') {
        failedPaymentsCount++;
        failedPaymentsAmount += inrVal;
      }
    });

    const averageOrderValue = successfulCheckoutsCount > 0 ? (monthlyRevenue / successfulCheckoutsCount) : 0;

    // Build unified transaction list — amounts in base INR
    const pointResultList = pointTxs.map((tx: any) => {
      const inrVal = getPointsINR(tx.amount);
      return {
        id: tx.id,
        userEmail: tx.user?.email || "unknown@latexify.io",
        userName: tx.user?.name || "System Scholar",
        amountCredits: tx.amount,
        amount: inrVal,          // base INR
        type: tx.type,
        description: tx.description || "Credit adjustment",
        status: tx.type === 'pending' ? 'Pending' : tx.type === 'refund' ? 'Refunded' : 'Completed',
        source: 'points',
        createdAt: tx.createdAt
      };
    });

    const membershipResultList = membershipTxs.map((tx: any) => ({
      id: tx.id,
      userEmail: tx.user?.email || "unknown@latexify.io",
      userName: tx.user?.name || "Scholar",
      amountCredits: 0,
      amount: tx.amount,         // base INR
      type: 'membership',
      description: `Plan upgrade: ${tx.planType}`,
      status: tx.paymentStatus === 'paid' ? 'Completed' : tx.paymentStatus === 'pending' ? 'Pending' : 'Failed',
      source: 'membership',
      planType: tx.planType,
      orderId: tx.orderId,
      createdAt: tx.createdAt
    }));

    // Calculate Renewed & Churned Customers
    const userTxCounts = await prisma.membershipTransaction.groupBy({
      by: ["userId"],
      where: { paymentStatus: "paid" },
      _count: { id: true },
    });

    const renewedUserIds = userTxCounts.filter((u: any) => u._count.id >= 2).map((u: any) => u.userId);
    const renewedCount = renewedUserIds.length;
    const transactingUserIds = userTxCounts.map((u: any) => u.userId);
    const churnedCount = await prisma.user.count({
      where: { id: { in: transactingUserIds }, membership: "free" }
    });

    // Generate Chart Data (7D, 30D, ALL) — values in base INR
    const revenue7D: { label: string; value: number }[] = [];
    const revenue30D: { label: string; value: number }[] = [];
    const revenueALL: { label: string; value: number }[] = [];
    const growth7D: { label: string; value: number }[] = [];
    const growth30D: { label: string; value: number }[] = [];
    const growthALL: { label: string; value: number }[] = [];

    const totalUsersCount = await prisma.user.count();
    const allUsers = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    });

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = getISODateStr(d);
      let dayRevenue = 0;

      pointTxs.forEach((tx: any) => {
        if (tx.type === 'recharge' && getISODateStr(new Date(tx.createdAt)) === dateStr) {
          dayRevenue += getPointsINR(tx.amount);
        }
      });
      membershipTxs.forEach((tx: any) => {
        if (tx.paymentStatus === 'paid' && getISODateStr(new Date(tx.createdAt)) === dateStr) {
          dayRevenue += tx.amount;
        }
      });

      const growthCount = allUsers.filter((u: any) => u.createdAt <= d).length;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const itemRev = { label, value: Math.round(dayRevenue) };
      const itemGrowth = { label, value: growthCount || totalUsersCount };

      if (i < 7) { revenue7D.push(itemRev); growth7D.push(itemGrowth); }
      revenue30D.push(itemRev);
      growth30D.push(itemGrowth);
    }

    const monthlyRevMap: Record<string, number> = {};
    const monthlyGrowthMap: Record<string, number> = {};

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyRevMap[monthLabel] = 0;
      monthlyGrowthMap[monthLabel] = allUsers.filter((u: any) => u.createdAt <= new Date(d.getFullYear(), d.getMonth() + 1, 0)).length;
    }

    pointTxs.forEach((tx: any) => {
      if (tx.type === 'recharge') {
        const monthLabel = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyRevMap[monthLabel] !== undefined) monthlyRevMap[monthLabel] += getPointsINR(tx.amount);
      }
    });
    membershipTxs.forEach((tx: any) => {
      if (tx.paymentStatus === 'paid') {
        const monthLabel = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyRevMap[monthLabel] !== undefined) monthlyRevMap[monthLabel] += tx.amount;
      }
    });

    Object.entries(monthlyRevMap).forEach(([monthLabel, val]) => {
      revenueALL.push({ label: monthLabel, value: Math.round(val) });
      growthALL.push({ label: monthLabel, value: monthlyGrowthMap[monthLabel] || totalUsersCount });
    });

    const allTransactions = [...pointResultList, ...membershipResultList]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      baseCurrency: 'INR',   // ← tells the client all amounts are in INR
      metrics: {
        monthlyRevenue:      Math.round(monthlyRevenue),
        pendingPayments:     Math.round(pendingPayments),
        totalRefunds:        Math.round(totalRefunds),
        pendingRefunds:      Math.round(pendingRefunds),
        failedPaymentsCount,
        failedPaymentsAmount: Math.round(failedPaymentsAmount),
        totalPointsCredited,
        successfulCheckoutsCount,
        averageOrderValue:   Math.round(averageOrderValue),
        renewedCount,
        churnedCount
      },
      charts: {
        revenue: { "7D": revenue7D, "30D": revenue30D, "ALL": revenueALL },
        userGrowth: { "7D": growth7D, "30D": growth30D, "ALL": growthALL }
      },
      transactions: allTransactions
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email, amount, description, type } = await req.json();
    if (!email || amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const credits = parseInt(amount, 10);
    const txType = type || "recharge";

    const transaction = await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        amount: txType === 'refund' ? -credits : credits,
        type: txType,
        description: description || `Points adjustment by Admin`
      }
    });

    // Update user points only for Completed recharges or refunds/deductions
    if (txType === 'recharge' || txType === 'refund' || txType === 'deduct' || txType === 'deduction') {
      const finalPoints = Math.max(0, user.points + ((txType === 'refund' || txType === 'deduct' || txType === 'deduction') ? -credits : credits));
      await prisma.user.update({
        where: { id: user.id },
        data: { points: finalPoints }
      });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
