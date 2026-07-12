import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';
import { findMatchingRule } from '@/lib/aiCapRules';

export async function POST(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { email, ipAddress, location, country, agent } = body;

    const match = await findMatchingRule({ email, ipAddress, location, country, agent });

    return NextResponse.json({
      success: true,
      matched: !!match,
      rule: match || null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
