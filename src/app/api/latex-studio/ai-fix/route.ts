import { NextRequest, NextResponse } from 'next/server';
import { routeToAgent } from '@/lib/agent-gateway';
import { getClientGeoInfo } from '@/lib/clientGeo';

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { mode, code, errors, prompt, context, error } = await req.json();
    const geo = await getClientGeoInfo(req);

    const result = await routeToAgent({
      agent: 'ai-fix',
      messages: [],
      context: {
        mode, code, errors, prompt, context, error, userId: (session.user as any).id,
        userEmail: (session.user as any).email || undefined,
        ipAddress: geo.ipAddress || undefined,
        location: geo.location || undefined,
        country: geo.country || undefined,
      } as Record<string, unknown>,
    });

    if (!result.success) {
      if (result.error?.startsWith('AI_CAP_REACHED:') || result.error?.startsWith('AI_CAP_RULE_BLOCKED:')) {
        const parts = result.error.split(':');
        return NextResponse.json({
          error: result.error?.startsWith('AI_CAP_RULE_BLOCKED:') ? 'AI_CAP_RULE_BLOCKED' : 'AI_CAP_REACHED',
          reactivatesAt: parts[1] || null,
          dailyCap: parseInt(parts[2]) || 0,
          usedToday: parseInt(parts[3]) || 0,
          reason: result.error?.startsWith('AI_CAP_RULE_BLOCKED:') ? parts[2] : undefined
        }, { status: 429 });
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const parsed = result.data as { result: string };
    return NextResponse.json({ result: parsed.result, timing: result.timing });
  } catch (err: any) {
    console.error('[AI Fix]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
