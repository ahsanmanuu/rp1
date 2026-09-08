import { NextRequest, NextResponse } from 'next/server';
import { runHardenedPipeline } from '@/lib/studio-core/compiler-engine.server';
import { PipelineGC } from '@/lib/pipeline-gc';

// RE-FORCE BUILD 17.5
/**
 * Central API Compilation Route (Refactored to Nuclear 17.0)
 * 
 * This route utilizes the centralized Nuclear HA Pipeline to ensure
 * robust compilation across multiple clusters with automatic asset discovery.
 */
export async function POST(req: NextRequest) {
  let projectId: string | null = null;
  let payloadFiles: any[] = [];

  try {
    const body = await req.json();
    const { latexCode, files, mainFile = 'main.tex', engine = 'pdflatex' } = body;
    projectId = body?.projectId || null;

    if (!latexCode && (!files || files.length === 0)) {
       return NextResponse.json({ error: 'LaTeX code or files are required' }, { status: 400 });
    }

    // Adapt legacy structure if needed (though new frontend should send 'files')
    payloadFiles = files || [{ path: mainFile, content: latexCode }];

    console.log(`[API_COMPILE] Routing request for Project: ${projectId || 'Anonymous'}`);

    const result = await runHardenedPipeline(engine, payloadFiles, mainFile, projectId);

    if (result.success) {
      return NextResponse.json({
        pdfBase64: result.pdfBase64,
        log: result.log,
        strategy: result.strategy,
        warnings: result.warnings
      });
    } else {
      return NextResponse.json({ 
        error: result.log,
        log: result.log,
        errors: result.errors,
        strategy: result.strategy,
        warnings: result.warnings
      }, { status: 422 });
    }

  } catch (err: any) {
    console.error('--- CRITICAL API COMPILER ERROR ---', err.message);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  } finally {
    await PipelineGC.autoFree({
      projectId,
      buffers: [payloadFiles]
    });
  }
}
