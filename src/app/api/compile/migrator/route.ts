import { NextRequest, NextResponse } from 'next/server';
import { runMigratorCompiler } from '@/lib/studio-core/compiler-engine.server';

import { getServerSession } from "@/lib/auth-pb";
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let session: any = null;
  let runMigratorCompiler: any;
  try {
    session = await getServerSession();
  } catch (authErr) {
    console.error('[AUTH_ERROR] migrator compile:', authErr);
  }
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const engineMod = await import('@/lib/studio-core/compiler-engine.server');
    runMigratorCompiler = engineMod.runMigratorCompiler;
  } catch (importErr: any) {
    console.error('[IMPORT_ERROR] migrator:', importErr);
    return NextResponse.json({ error: 'Compiler unavailable', message: importErr.message }, { status: 503 });
  }

  try {
    const { engine = 'pdflatex', files, mainFile = 'main.tex', projectId = null } = await req.json();

    console.log(`[MIGRATOR] Request: ${session.user?.email} | Project: ${projectId}`);

    const res = await runMigratorCompiler(engine, files, mainFile, projectId);

    // ── RESILIENT BACKUP PLAN ─────────────────────────────────────────────────
    // Always forward the PDF to the client even when the compiler returned
    // success:false (e.g. non-fatal warnings, missing figure stubs, font issues).
    // The client-side handler checks for pdfUrl / pdfBase64 independently.
    return NextResponse.json({
      success:    res.success,
      pdfBase64:  res.pdfBase64 ?? null,
      pdfUrl:     (res as any).pdfUrl ?? null,
      log:        res.log,
      errors:     res.errors ?? [],
      strategy:   res.strategy ?? 'UNKNOWN',
    });

  } catch (err: any) {
    console.error('[MIGRATOR_FAIL]', err);
    return NextResponse.json({ error: 'Migrator Pipeline Error', message: err.message }, { status: 500 });
  }
}
