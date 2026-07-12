import { NextRequest, NextResponse } from 'next/server';
import { runHardenedPipeline } from '@/lib/studio-core/compiler-engine.server';

// RE-FORCE BUILD 17.5
/**
 * Central API Compilation Route (Refactored to Nuclear 17.0)
 * 
 * This route utilizes the centralized Nuclear HA Pipeline to ensure
 * robust compilation across multiple clusters with automatic asset discovery.
 */
export async function POST(req: NextRequest) {
  try {
    const { latexCode, projectId, files, mainFile = 'main.tex', engine = 'pdflatex' } = await req.json();

    if (!latexCode && (!files || files.length === 0)) {
       return NextResponse.json({ error: 'LaTeX code or files are required' }, { status: 400 });
    }

    // Adapt legacy structure if needed (though new frontend should send 'files')
    const payloadFiles = files || [{ path: mainFile, content: latexCode }];

    console.log(`[API_COMPILE] Routing request for Project: ${projectId || 'Anonymous'}`);

    const result = await runHardenedPipeline(engine, payloadFiles, mainFile, projectId);

    if (result.success) {
      return NextResponse.json({
        pdfBase64: result.pdfBase64,
        log: result.log,
        strategy: result.strategy
      });
    } else {
      return NextResponse.json({ 
        error: result.log,
        log: result.log,
        errors: result.errors,
        strategy: result.strategy
      }, { status: 422 });
    }

  } catch (err: any) {
    console.error('--- CRITICAL API COMPILER ERROR ---', err.message);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
