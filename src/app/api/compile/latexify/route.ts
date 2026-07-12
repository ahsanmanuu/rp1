import { NextRequest, NextResponse } from 'next/server';
import { runLatexifyCompiler } from '@/lib/studio-core/compiler-engine.server';

import { getServerSession } from "@/lib/auth-pb";
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { engine = 'pdflatex', files, mainFile = 'main.tex', projectId = null } = await req.json();

    console.log(`[LATEXIFY] Request: ${session.user?.email} | Project: ${projectId}`);

    const res = await runLatexifyCompiler(engine, files, mainFile, projectId);

    // ── RESILIENT BACKUP PLAN ─────────────────────────────────────────────────
    // Always forward pdfUrl / pdfBase64 even when success:false.
    // The frontend checks for a PDF independently of the success flag and
    // shows the document with a warning toast when only non-fatal errors exist.
    return NextResponse.json({
      success:   res.success,
      pdfBase64: res.pdfBase64 ?? null,
      pdfUrl:    (res as any).pdfUrl ?? null,
      log:       res.log,
      errors:    res.errors ?? [],
      strategy:  res.strategy ?? 'UNKNOWN',
    });

  } catch (err: any) {
    console.error('[LATEXIFY_FAIL]', err);
    return NextResponse.json({ error: 'Latexify Compiler Error', message: err.message }, { status: 500 });
  }
}
