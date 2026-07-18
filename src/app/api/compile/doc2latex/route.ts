import { NextRequest, NextResponse } from 'next/server';
import { runDoc2LatexCompiler } from '@/lib/studio-core/compiler-engine.server';

import { getServerSession } from "@/lib/auth-pb";
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let session: any = null;
  let runDoc2LatexCompiler: any;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] doc2latex compile:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const engineMod = await import('@/lib/studio-core/compiler-engine.server');
    runDoc2LatexCompiler = engineMod.runDoc2LatexCompiler;
  } catch (importErr: any) {
    console.error('[IMPORT_ERROR] doc2latex:', importErr);
    return NextResponse.json({ error: 'Compiler unavailable', message: importErr.message }, { status: 503 });
  }

  try {
    const { engine = 'pdflatex', files, mainFile = 'main.tex', projectId = null } = await req.json();

    console.log(`[DOC2LATEX] Request: ${session.user?.email} | Project: ${projectId}`);

    const res = await runDoc2LatexCompiler(engine, files, mainFile, projectId);

    // ── RESILIENT BACKUP PLAN ─────────────────────────────────────────────────
    // Always forward the PDF to the client even when the compiler returned
    // success:false (e.g. non-fatal warnings, missing figure stubs, font issues).
    return NextResponse.json({
      success:    res.success,
      pdfBase64:  res.pdfBase64 ?? null,
      pdfUrl:     (res as any).pdfUrl ?? null,
      log:        res.log,
      errors:     res.errors ?? [],
      strategy:   res.strategy ?? 'UNKNOWN',
    });

  } catch (err: any) {
    console.error('[DOC2LATEX_FAIL]', err);
    return NextResponse.json({ error: 'Doc2Latex Pipeline Error', message: err.message }, { status: 500 });
  }
}
