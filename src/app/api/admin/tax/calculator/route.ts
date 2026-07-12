import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30';
    const exemptions = searchParams.get('exemptions') || '';

    const daysAgo = period === '90' ? 90 : period === '365' ? 365 : 30;
    const since = new Date(Date.now() - daysAgo * 86400000);

    const exemptionList = exemptions ? exemptions.split(',').filter(Boolean) : [];

    const [aggregated, rules, regionData] = await Promise.all([
      prisma.taxTransaction.aggregate({
        _sum: { amount: true, taxAmount: true },
        _count: true,
        where: { transactionDate: { gte: since } },
      }),
      prisma.taxRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
      prisma.taxTransaction.groupBy({
        by: ['region'],
        _sum: { amount: true },
        where: { transactionDate: { gte: since } },
      }),
    ]);

    const grossRevenue = aggregated._sum.amount || 0;
    const avgRate = rules.length > 0 ? rules.reduce((s, r) => s + r.rate, 0) / rules.length : 18;
    const exemptRatio = exemptionList.length > 0 ? exemptionList.length / (exemptionList.length + 1) : 0;
    const effectiveRate = avgRate * (1 - exemptRatio * 0.5);

    const regionBreakdown = regionData.map(r => {
      const rule = rules.find(ru => ru.region === r.region);
      return { region: r.region, amount: r._sum.amount || 0, rate: rule?.rate || avgRate };
    });

    return NextResponse.json({
      success: true,
      grossRevenue,
      estimatedLiability: parseFloat((grossRevenue * effectiveRate / 100).toFixed(2)),
      avgRate: parseFloat(effectiveRate.toFixed(2)),
      baseAvgRate: parseFloat(avgRate.toFixed(2)),
      transactionCount: aggregated._count,
      regionBreakdown,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
