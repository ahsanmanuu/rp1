import { NextRequest, NextResponse } from 'next/server';
import { routeToAgent } from '@/lib/agent-gateway';
import { getClientGeoInfo } from '@/lib/clientGeo';

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] chat:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { messages, activeFile, fileContent, allFiles } = await req.json();
    const geo = await getClientGeoInfo(req);

    const sanitizedFiles = Array.isArray(allFiles)
      ? allFiles
          .filter((f: any) => typeof f?.path === 'string' && /\.(tex|bib|cls|sty|txt|md|json)$/i.test(f.path))
          .map((f: any) => ({
            path: f.path,
            content: typeof f.content === 'string'
              ? (f.content.startsWith('data:') ? '' : f.content.slice(0, 30000))
              : '',
          }))
      : [];
    const sanitizedFileContent = typeof fileContent === 'string'
      ? fileContent.slice(0, 80000)
      : '';

    const result = await routeToAgent({
      agent: 'chat',
      messages: messages || [],
      context: {
        activeFile, fileContent: sanitizedFileContent, allFiles: sanitizedFiles, userId: (session.user as any).id,
        userEmail: (session.user as any).email || undefined,
        ipAddress: geo.ipAddress || undefined,
        location: geo.location || undefined,
        country: geo.country || undefined,
      },
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
      return NextResponse.json({ success: false, error: result.error || "AI response unavailable" }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: (result.data as { message: string }).message,
      timing: result.timing,
    });
  } catch (err: any) {
    console.error('LaTeX Studio Chat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
