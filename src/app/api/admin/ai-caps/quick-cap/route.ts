import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';
import { clearRulesCache } from '@/lib/aiCapRules';

export async function POST(req: NextRequest) {
  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, email, capType, capValue, durationMs, agent } = body;

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: 'Provide userId or email' }, { status: 400 });
    }

    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
      : await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetEmail = user.email;
    if (!targetEmail) {
      return NextResponse.json({ success: false, error: 'User has no email' }, { status: 400 });
    }

    const resolvedCapType = capType || 'block';
    const resolvedCapValue = capValue ?? (resolvedCapType === 'block' ? 7200000 : 5000);
    const ruleName = `Quick-cap: ${targetEmail} (${new Date().toLocaleDateString()})`;

    // Delete any existing quick-cap rules for this user's email
    await prisma.aiCapRule.deleteMany({
      where: {
        name: { startsWith: `Quick-cap: ${targetEmail}` },
      },
    });

    const rule = await prisma.aiCapRule.create({
      data: {
        name: ruleName,
        description: `Auto-created by admin ${admin.email || 'unknown'} to cap ${targetEmail}`,
        matchType: 'email_exact',
        matchValue: targetEmail,
        capType: resolvedCapType,
        capValue: resolvedCapValue,
        agentFilter: agent || '*',
        priority: 1,
        isActive: true,
        createdBy: admin.email || null,
      },
    });

    // If block type, immediately set reactivation on user
    if (resolvedCapType === 'block') {
      const blockDuration = resolvedCapValue > 0 ? resolvedCapValue : 7200000;
      await prisma.user.update({
        where: { id: user.id },
        data: { aiAgentReactivatesAt: new Date(Date.now() + blockDuration) },
      });
    }

    clearRulesCache();

    return NextResponse.json({
      success: true,
      rule,
      user: { id: user.id, email: targetEmail },
      message: resolvedCapType === 'block'
        ? `User ${targetEmail} is now blocked from AI access`
        : `Cap rule created for ${targetEmail}: ${resolvedCapValue} ${resolvedCapType === 'daily_tokens' ? 'tokens/day' : 'requests/day'}`,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
