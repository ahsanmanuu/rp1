import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPointsMembershipExchange } from '@/lib/membershipExchange';

import { getServerSession } from "@/lib/auth-pb";
const PLANS = {
  'bronze': { name: 'Bronze', points: 50, price: 5 },
  'silver': { name: 'Silver', points: 200, price: 15 },
  'gold': { name: 'Gold', points: 1000, price: 50 },
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { planId } = await req.json();
    const plan = PLANS[planId as keyof typeof PLANS];

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const userId = session.user.id;

    // Run transaction
    const updatedUser = await prisma.$transaction(async (tx: any) => {
      // 1. Verify user exists before updating points
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!existingUser) {
        throw new Error("USER_NOT_FOUND");
      }

      // 2. Update user points
      await tx.user.update({
        where: { id: userId },
        data: {
          points: {
            increment: plan.points
          }
        }
      });

      // 2. Record transaction
      await tx.pointTransaction.create({
        data: {
          userId: userId,
          amount: plan.points,
          type: 'recharge',
          description: `Purchased ${plan.name || planId} plan (${plan.points} points)`
        }
      });

      // 3. Trigger Points-to-Membership package auto-exchange check inside the same transaction
      await processPointsMembershipExchange(userId, tx);

      // Fetch the updated user state to return points correctly (since it could have changed during exchange)
      const freshUser = await tx.user.findUnique({
        where: { id: userId },
        select: { points: true }
      });

      return freshUser;
    });

    return NextResponse.json({ 
      success: true, 
      addedPoints: plan.points, 
      totalPoints: updatedUser?.points || 0 
    });

  } catch (error: any) {
    console.error('Recharge Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing recharge' }, { status: 500 });
  }
}
