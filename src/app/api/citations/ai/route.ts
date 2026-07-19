import { NextRequest, NextResponse } from 'next/server';
import { routeToAgent } from '@/lib/agent-gateway';
import { getClientGeoInfo } from '@/lib/clientGeo';
import type { AgentId } from '@/lib/agent-gateway/types';

import { getServerSession } from "@/lib/auth-pb";

const CITATION_AGENTS: AgentId[] = ['citation-enrich', 'citation-validate', 'citation-format'];

export async function POST(req: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] citations/ai:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { agent, citations, style, targetStyle, currentStyle } = body;

    if (!agent || !CITATION_AGENTS.includes(agent)) {
      return NextResponse.json(
        { error: `Invalid agent. Must be one of: ${CITATION_AGENTS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!citations || !Array.isArray(citations) || citations.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty citations array' },
        { status: 400 },
      );
    }

    const geo = await getClientGeoInfo(req);

    const context: Record<string, unknown> = {
      citations: citations.slice(0, 20),
      style: style || 'APA 7th edition',
      targetStyle: targetStyle || style || 'APA 7th edition',
      currentStyle: currentStyle || style || 'APA 7th edition',
      userId: (session.user as any).id,
      userEmail: (session.user as any).email || undefined,
      ipAddress: geo.ipAddress || undefined,
      location: geo.location || undefined,
      country: geo.country || undefined,
    };

    const agentLabel: Record<string, string> = {
      'citation-enrich': 'enrich these citations with missing metadata',
      'citation-validate': 'validate these citations for accuracy and completeness',
      'citation-format': 'reformat these citations to the target style',
    };

    const result = await routeToAgent({
      agent: agent as AgentId,
      messages: [
        {
          role: 'user',
          content: agentLabel[agent] || 'Process these citations',
        },
      ],
      context,
    });

    if (!result.success) {
      if (result.error?.startsWith('AI_CAP_REACHED:') || result.error?.startsWith('AI_CAP_RULE_BLOCKED:')) {
        const parts = result.error.split(':');
        return NextResponse.json({
          error: result.error?.startsWith('AI_CAP_RULE_BLOCKED:') ? 'AI_CAP_RULE_BLOCKED' : 'AI_CAP_REACHED',
          reactivatesAt: parts[1] || null,
          dailyCap: parseInt(parts[2]) || 0,
          usedToday: parseInt(parts[3]) || 0,
          reason: result.error?.startsWith('AI_CAP_RULE_BLOCKED:') ? parts[2] : undefined,
        }, { status: 429 });
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      agent,
      data: result.data,
      model: result.model,
      timing: result.timing,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Citations AI Error]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] citations/ai GET:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    success: true,
    agents: CITATION_AGENTS,
    status: 'available',
  });
}
