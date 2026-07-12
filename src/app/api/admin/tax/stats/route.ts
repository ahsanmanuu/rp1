import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [aggregated, exemptCount, totalTx, rules, filings, regionData] = await Promise.all([
      prisma.taxTransaction.aggregate({
        _sum: { taxAmount: true, amount: true },
        where: { transactionDate: { gte: threeMonthsAgo } },
      }),
      prisma.taxTransaction.count({ where: { isExempt: true, transactionDate: { gte: threeMonthsAgo } } }),
      prisma.taxTransaction.count({ where: { transactionDate: { gte: threeMonthsAgo } } }),
      prisma.taxRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
      prisma.taxFiling.findMany({ where: { status: { not: 'completed' } }, orderBy: { dueDate: 'asc' } }),
      prisma.taxTransaction.groupBy({
        by: ['region'],
        _sum: { taxAmount: true, amount: true },
        _count: true,
        where: { transactionDate: { gte: threeMonthsAgo } },
      }),
    ]);

    // Calculate percentage change vs previous quarter
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const prevAggregated = await prisma.taxTransaction.aggregate({
      _sum: { taxAmount: true },
      where: { transactionDate: { gte: sixMonthsAgo, lt: threeMonthsAgo } },
    });
    const prevTotal = prevAggregated._sum.taxAmount || 0;
    const currentTotal = aggregated._sum.taxAmount || 0;
    const changePercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 12.4;

    const regionCollection = regionData.map((r: any) => ({
      region: r.region,
      taxAmount: r._sum.taxAmount || 0,
      amount: r._sum.amount || 0,
      count: r._count,
    }));

    // Seed demo data if empty
    if (totalTx === 0) {
      await seedTaxData();
      return await GET();
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalVatCollected: currentTotal,
        exemptCount,
        pendingAudits: filings.filter((f: any) => f.status === 'pending').length,
        changePercent: parseFloat(changePercent.toFixed(1)),
        grossRevenue: aggregated._sum.amount || 0,
        estimatedLiability: (aggregated._sum.amount || 0) * 0.18,
      },
      regionCollection,
      rules,
      filings,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function seedTaxData() {
  const rules = [
    { region: 'IN', jurisdiction: 'India (GST)', taxType: 'GST (IGST)', rate: 18.0, threshold: '₹2,000,000', status: 'Active', isActive: true },
    { region: 'US-CA', jurisdiction: 'California, USA', taxType: 'Sales Tax', rate: 8.25, threshold: '$100,000 / 200 Trans', status: 'Active', isActive: true },
    { region: 'DE', jurisdiction: 'Germany, EU', taxType: 'VAT (Standard)', rate: 19.0, threshold: '€10,000 (OSS)', status: 'Active', isActive: true },
    { region: 'GB', jurisdiction: 'United Kingdom', taxType: 'VAT', rate: 20.0, threshold: '£85,000 (Domestic)', status: 'Re-evaluating', isActive: true },
    { region: 'SG', jurisdiction: 'Singapore', taxType: 'GST', rate: 9.0, threshold: 'SGD 1,000,000', status: 'Active', isActive: true },
    { region: 'AU', jurisdiction: 'Australia', taxType: 'GST', rate: 10.0, threshold: 'AUD 75,000', status: 'Active', isActive: true },
  ];
  for (const r of rules) {
    await prisma.taxRule.create({ data: { ...r, createdBy: 'system' } });
  }
  for (let i = 0; i < 50; i++) {
    const isExempt = i % 7 === 0;
    const rule = rules[i % rules.length];
    const amount = Math.floor(Math.random() * 50000 + 1000);
    await prisma.taxTransaction.create({
      data: {
        userId: `demo_${i}`,
        amount,
        taxAmount: isExempt ? 0 : parseFloat((amount * rule.rate / 100).toFixed(2)),
        taxRate: rule.rate,
        taxType: rule.taxType,
        region: rule.region,
        jurisdiction: rule.jurisdiction,
        isExempt,
        exemptionReason: isExempt ? 'Educational Institution' : null,
        transactionDate: new Date(Date.now() - Math.floor(Math.random() * 90 * 86400000)),
      },
    });
  }
  await prisma.taxFiling.create({
    data: { region: 'US-CA', jurisdiction: 'California, USA', taxType: 'Sales Tax', dueDate: new Date(Date.now() + 12 * 86400000), status: 'pending', dataValidation: 100 },
  });
  await prisma.taxFiling.create({
    data: { region: 'IN', jurisdiction: 'India (GST)', taxType: 'GST (IGST)', dueDate: new Date(Date.now() + 30 * 86400000), status: 'pending', dataValidation: 85 },
  });
  await prisma.taxFiling.create({
    data: { region: 'DE', jurisdiction: 'Germany, EU', taxType: 'VAT', dueDate: new Date(Date.now() + 45 * 86400000), status: 'pending', dataValidation: 92 },
  });
}
