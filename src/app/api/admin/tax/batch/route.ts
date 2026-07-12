import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rules = await prisma.taxRule.findMany({ where: { isActive: true } });
    if (rules.length === 0) {
      return NextResponse.json({ success: false, error: 'No active tax rules found' });
    }

    // Recalculate tax on all recent transactions without taxAmount set
    const transactions = await prisma.taxTransaction.findMany({
      where: { taxAmount: 0, isExempt: false },
      take: 500,
    });

    let updated = 0;
    for (const tx of transactions) {
      const rule = rules.find(r => r.region === tx.region) || rules[0];
      const taxAmount = parseFloat((tx.amount * rule.rate / 100).toFixed(2));
      await prisma.taxTransaction.update({
        where: { id: tx.id },
        data: { taxAmount, taxRate: rule.rate, taxType: rule.taxType },
      });
      updated++;
    }

    // Seed new transactions from membership_transactions
    const memberships = await prisma.membershipTransaction.findMany({
      where: { paymentStatus: 'paid', createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      take: 200,
    });

    let created = 0;
    for (const m of memberships) {
      const region = 'IN';
      const rule = rules.find(r => r.region === region) || rules[0];
      const amount = m.amount || 0;
      const taxAmount = parseFloat((amount * rule.rate / 100).toFixed(2));
      await prisma.taxTransaction.create({
        data: {
          userId: m.userId,
          transactionId: m.id,
          amount,
          taxAmount,
          taxRate: rule.rate,
          taxType: rule.taxType,
          region,
          jurisdiction: rule.jurisdiction,
          transactionDate: m.createdAt,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      updatedTransactions: updated,
      createdTransactions: created,
      message: `Batch calculation complete. Updated ${updated} and created ${created} tax records.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
