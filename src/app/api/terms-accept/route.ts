import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId, ipAddress, userAgent } = await req.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    const resolvedIp = ipAddress || req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';
    const resolvedUa = userAgent || req.headers.get('user-agent') || 'Unknown';

    const record = await prisma.termAcceptance.create({
      data: { userId, ipAddress: resolvedIp, userAgent: resolvedUa },
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
