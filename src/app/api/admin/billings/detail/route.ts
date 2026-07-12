import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    // ── REFUNDED ────────────────────────────────────────────────────────────
    if (type === "refunded") {
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "refund" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, points: true } } }
      });
      const membershipTxs = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: "refunded" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const rows = [
        ...pointTxs.map((tx: any) => ({
          id: tx.id, source: "points", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: Math.abs(tx.amount), unit: "pts",
          amountUsd: Math.abs(tx.amount) * 0.1,
          description: tx.description || "Refund", planType: null, orderId: null,
          status: "Refunded", createdAt: tx.createdAt
        })),
        ...membershipTxs.map((tx: any) => ({
          id: tx.id, source: "membership", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "INR",
          amountUsd: Math.round((tx.amount / 83) * 100) / 100,
          description: `Plan: ${tx.planType}`, planType: tx.planType, orderId: tx.orderId,
          status: "Refunded", createdAt: tx.createdAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, rows });
    }

    // ── REFUND PENDING ──────────────────────────────────────────────────────
    if (type === "refund_pending") {
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "refund_pending" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, points: true } } }
      });
      const membershipTxs = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: { in: ["refund_pending", "refunded_pending"] } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const rows = [
        ...pointTxs.map((tx: any) => ({
          id: tx.id, source: "points", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: Math.abs(tx.amount), unit: "pts",
          amountUsd: Math.abs(tx.amount) * 0.1,
          description: tx.description || "Refund Pending", planType: null, orderId: null,
          status: "Refund Pending", createdAt: tx.createdAt
        })),
        ...membershipTxs.map((tx: any) => ({
          id: tx.id, source: "membership", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "INR",
          amountUsd: Math.round((tx.amount / 83) * 100) / 100,
          description: `Plan: ${tx.planType}`, planType: tx.planType, orderId: tx.orderId,
          status: "Refund Pending", createdAt: tx.createdAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, rows });
    }

    // ── FAILED ──────────────────────────────────────────────────────────────
    if (type === "failed") {
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "failed" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, points: true } } }
      });
      const membershipTxs = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: "failed" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const rows = [
        ...pointTxs.map((tx: any) => ({
          id: tx.id, source: "points", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "pts", amountUsd: tx.amount * 0.1,
          description: tx.description || "Failed", planType: null, orderId: null,
          status: "Failed", createdAt: tx.createdAt
        })),
        ...membershipTxs.map((tx: any) => ({
          id: tx.id, source: "membership", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "INR",
          amountUsd: Math.round((tx.amount / 83) * 100) / 100,
          description: `Plan: ${tx.planType}`, planType: tx.planType, orderId: tx.orderId,
          status: "Failed", createdAt: tx.createdAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, rows });
    }

    // ── POINTS CREDIT ───────────────────────────────────────────────────────
    if (type === "points_credit") {
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "recharge" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, points: true } } }
      });
      const rows = pointTxs.map((tx: any) => {
        let amountUsd = tx.amount * 0.1;
        if (tx.amount === 50) amountUsd = 5;
        else if (tx.amount === 200) amountUsd = 15;
        else if (tx.amount === 1000) amountUsd = 50;
        return {
          id: tx.id, source: "points", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          userCurrentPoints: tx.user?.points ?? 0,
          amount: tx.amount, unit: "pts", amountUsd,
          description: tx.description || "Points Recharge", planType: null, orderId: null,
          status: "Completed", createdAt: tx.createdAt
        };
      });
      return NextResponse.json({ success: true, rows });
    }

    // ── SUCCESSFUL ──────────────────────────────────────────────────────────
    if (type === "successful") {
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "recharge" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, points: true } } }
      });
      const membershipTxs = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: "paid" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const rows = [
        ...pointTxs.map((tx: any) => {
          let amountUsd = tx.amount * 0.1;
          if (tx.amount === 50) amountUsd = 5;
          else if (tx.amount === 200) amountUsd = 15;
          else if (tx.amount === 1000) amountUsd = 50;
          return {
            id: tx.id, source: "points", userId: tx.userId,
            userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
            amount: tx.amount, unit: "pts", amountUsd,
            description: tx.description || "Points Recharge", planType: null, orderId: null,
            status: "Completed", createdAt: tx.createdAt
          };
        }),
        ...membershipTxs.map((tx: any) => ({
          id: tx.id, source: "membership", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "INR",
          amountUsd: Math.round((tx.amount / 83) * 100) / 100,
          description: `Plan: ${tx.planType}`, planType: tx.planType, orderId: tx.orderId,
          status: "Completed", createdAt: tx.createdAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, rows });
    }

    // ── MONTHLY REVENUE ─────────────────────────────────────────────────────
    if (type === "monthly_revenue") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const pointTxs = await prisma.pointTransaction.findMany({
        where: { type: "recharge", createdAt: { gte: monthStart } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const membershipTxs = await prisma.membershipTransaction.findMany({
        where: { paymentStatus: "paid", createdAt: { gte: monthStart } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      const rows = [
        ...pointTxs.map((tx: any) => {
          let amountUsd = tx.amount * 0.1;
          if (tx.amount === 50) amountUsd = 5;
          else if (tx.amount === 200) amountUsd = 15;
          else if (tx.amount === 1000) amountUsd = 50;
          return {
            id: tx.id, source: "points", userId: tx.userId,
            userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
            amount: tx.amount, unit: "pts", amountUsd,
            description: tx.description || "Points Recharge", planType: null, orderId: null,
            status: "Completed", createdAt: tx.createdAt
          };
        }),
        ...membershipTxs.map((tx: any) => ({
          id: tx.id, source: "membership", userId: tx.userId,
          userName: tx.user?.name || "-", userEmail: tx.user?.email || "-",
          amount: tx.amount, unit: "INR",
          amountUsd: Math.round((tx.amount / 83) * 100) / 100,
          description: `Plan: ${tx.planType}`, planType: tx.planType, orderId: tx.orderId,
          status: "Completed", createdAt: tx.createdAt
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, rows });
    }

    // ── RENEWED ─────────────────────────────────────────────────────────────
    if (type === "renewed") {
      const userTxCounts = await prisma.membershipTransaction.groupBy({
        by: ["userId"],
        where: { paymentStatus: "paid" },
        _count: { id: true },
        having: { id: { _count: { gte: 2 } } }
      });
      const renewedUserIds = userTxCounts.map((u: any) => u.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: renewedUserIds } },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, membership: true, membershipExpiresAt: true, createdAt: true, points: true }
      });
      const txMap: Record<string, number> = {};
      userTxCounts.forEach((u: any) => { txMap[u.userId] = u._count.id; });
      const rows = users.map((u: any) => ({
        id: u.id, userId: u.id, source: "user",
        userName: u.name || "-", userEmail: u.email,
        membership: u.membership, membershipExpiresAt: u.membershipExpiresAt,
        points: u.points, renewalCount: txMap[u.id] || 0,
        status: u.membership !== "free" ? "Active" : "Expired", createdAt: u.createdAt
      }));
      return NextResponse.json({ success: true, rows });
    }

    // ── CHURNED ─────────────────────────────────────────────────────────────
    if (type === "churned") {
      const userTxCounts = await prisma.membershipTransaction.groupBy({
        by: ["userId"],
        where: { paymentStatus: "paid" },
        _count: { id: true }
      });
      const transactingUserIds = userTxCounts.map((u: any) => u.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: transactingUserIds }, membership: "free" },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, membership: true, membershipExpiresAt: true, createdAt: true, points: true }
      });
      const txMap: Record<string, number> = {};
      userTxCounts.forEach((u: any) => { txMap[u.userId] = u._count.id; });
      const rows = users.map((u: any) => ({
        id: u.id, userId: u.id, source: "user",
        userName: u.name || "-", userEmail: u.email,
        membership: u.membership, membershipExpiresAt: u.membershipExpiresAt,
        points: u.points, renewalCount: txMap[u.id] || 0,
        status: "Churned", createdAt: u.createdAt
      }));
      return NextResponse.json({ success: true, rows });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action, txId, userId, source, amount } = body;

    if (action === "approve_refund") {
      if (source === "points") {
        const tx = await prisma.pointTransaction.findUnique({ where: { id: txId } });
        if (tx) {
          await prisma.pointTransaction.update({ where: { id: txId }, data: { type: "refund" } });
          const user = await prisma.user.findUnique({ where: { id: tx.userId } });
          if (user) {
            await prisma.user.update({ where: { id: tx.userId }, data: { points: Math.max(0, user.points - Math.abs(tx.amount)) } });
          }
        }
      } else {
        await prisma.membershipTransaction.update({ where: { id: txId }, data: { paymentStatus: "refunded" } });
      }
      return NextResponse.json({ success: true, message: "Refund approved" });
    }

    if (action === "reject_refund") {
      if (source === "points") {
        await prisma.pointTransaction.update({ where: { id: txId }, data: { type: "failed" } });
      } else {
        await prisma.membershipTransaction.update({ where: { id: txId }, data: { paymentStatus: "failed" } });
      }
      return NextResponse.json({ success: true, message: "Refund rejected" });
    }

    if (action === "reinitiate") {
      if (source === "points") {
        const tx = await prisma.pointTransaction.findUnique({ where: { id: txId } });
        if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
        await prisma.pointTransaction.create({
          data: { userId: tx.userId, amount: tx.amount, type: "pending", description: `Re-initiated: ${tx.description || "recharge"}` }
        });
      } else {
        const tx = await prisma.membershipTransaction.findUnique({ where: { id: txId } });
        if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const newOrderId = `REINIT-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
        const now = new Date();
        const expires = new Date(now);
        expires.setMonth(expires.getMonth() + tx.durationMonths);
        await prisma.membershipTransaction.create({
          data: { userId: tx.userId, orderId: newOrderId, planType: tx.planType, amount: tx.amount, currency: "INR", durationMonths: tx.durationMonths, paymentStatus: "pending", startsAt: now, expiresAt: expires }
        });
      }
      return NextResponse.json({ success: true, message: "Re-initiated successfully" });
    }

    if (action === "issue_refund") {
      if (source === "points") {
        await prisma.pointTransaction.update({ where: { id: txId }, data: { type: "refund_pending" } });
      } else {
        await prisma.membershipTransaction.update({ where: { id: txId }, data: { paymentStatus: "refund_pending" } });
      }
      return NextResponse.json({ success: true, message: "Refund pending approval" });
    }

    if (action === "adjust_points") {
      if (!userId || amount === undefined) return NextResponse.json({ error: "userId and amount required" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const delta = parseInt(amount, 10);
      await prisma.user.update({ where: { id: userId }, data: { points: Math.max(0, user.points + delta) } });
      await prisma.pointTransaction.create({
        data: { userId, amount: delta, type: delta > 0 ? "recharge" : "refund", description: `Admin adjustment (${delta > 0 ? "+" : ""}${delta} pts)` }
      });
      return NextResponse.json({ success: true, message: "Points adjusted" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
