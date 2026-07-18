import { NextRequest, NextResponse } from 'next/server';
import { routeToAgent, listAgents, getAgentConfig, gatewayQueue } from '@/lib/agent-gateway';
import { getClientGeoInfo } from '@/lib/clientGeo';
import type { AgentId } from '@/lib/agent-gateway/types';

import { getServerSession } from "@/lib/auth-pb";
export async function GET(req: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] agent-gateway GET:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get('agent') as AgentId | null;

  if (agent) {
    const config = getAgentConfig(agent);
    if (!config) {
      return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      agent: { id: config.id, name: config.name, description: config.description },
    });
  }

  return NextResponse.json({
    success: true,
    agents: listAgents(),
    queue: {
      pending: gatewayQueue.getPendingCount(),
      active: gatewayQueue.getActiveCount(),
    },
  });
}

export async function POST(req: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] agent-gateway POST:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { agent, messages, context } = body;

    if (!agent || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields: agent, messages' },
        { status: 400 },
      );
    }

    const config = getAgentConfig(agent);
    if (!config) {
      return NextResponse.json(
        {
          error: `Unknown agent: ${agent}`,
          availableAgents: listAgents().map((a) => a.id),
        },
        { status: 400 },
      );
    }

    const geo = await getClientGeoInfo(req);

    const result = await routeToAgent({
      agent,
      messages,
      context: {
        ...(context || {}),
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        ipAddress: geo.ipAddress || undefined,
        location: geo.location || undefined,
        country: geo.country || undefined,
      },
    });

    if (!result.success) {
      if (result.error?.startsWith('AI_CAP_REACHED:') || result.error?.startsWith('AI_CAP_RULE_BLOCKED:')) {
        return NextResponse.json(result, { status: 429 });
      }
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
