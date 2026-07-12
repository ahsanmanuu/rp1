import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const filings = await prisma.taxFiling.findMany({ orderBy: { dueDate: 'asc' } });
    return NextResponse.json({ success: true, filings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, status, totalTax, totalAmount } = await req.json();
    const data: any = { status };
    if (status === 'completed') data.filedAt = new Date();
    if (totalTax !== undefined) data.totalTax = totalTax;
    if (totalAmount !== undefined) data.totalAmount = totalAmount;
    const filing = await prisma.taxFiling.update({ where: { id }, data });
    return NextResponse.json({ success: true, filing });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
