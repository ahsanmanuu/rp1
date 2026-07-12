import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [total, replied] = await Promise.all([
      prisma.generalQuery.count(),
      prisma.generalQuery.count({ where: { status: 'replied' } }),
    ]);

    const pending = total - replied;

    return NextResponse.json({ success: true, data: { total, replied, pending } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
