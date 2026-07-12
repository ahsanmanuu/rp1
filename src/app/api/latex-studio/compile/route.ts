import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "@/lib/auth-pb";
import { 
  runLatexifyCompiler, 
  runDoc2LatexCompiler, 
  runMigratorCompiler 
} from '@/lib/studio-core/compiler-engine.server';

export const maxDuration = 120; // High allowance for multi-cluster fallback
export const dynamic = 'force-dynamic';

/**
 * LaTeX Studio Compilation Route (Nuclear 17.0 Unified)
 *
 * Uses runLatexifyCompiler (ghostMode: false) so real image bytes are passed
 * directly to the compiler — no proxy replacement, no PNG→JPEG conversion,
 * no \zimg rewriting. Figures appear as authored.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();

  try {
    let engine = 'pdflatex';
    let files: any[] = [];
    let mainFile = 'main.tex';
    let projectId: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      engine = (formData.get('engine') as string) || 'pdflatex';
      mainFile = (formData.get('mainFile') as string) || 'main.tex';
      projectId = (formData.get('projectId') as string) || null;

      const fileMap: Record<number, any> = {};
      for (const [key, value] of Array.from(formData.entries())) {
        const match = key.match(/^files\[(\d+)\]\[(path|content)\]$/);
        if (match) {
          const index = parseInt(match[1]);
          const prop = match[2];
          if (!fileMap[index]) fileMap[index] = {};

          if (prop === 'content' && typeof value !== 'string') {
            // It's a File object — convert to base64 data URL.
            // Normalise MIME: browsers sometimes send 'image/jpg' which is not
            // a valid IANA type; pdf-lib and sharp both require 'image/jpeg'.
            const arrayBuffer = await (value as File).arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            let mime = (value as File).type || 'application/octet-stream';
            if (mime === 'image/jpg') mime = 'image/jpeg';     // non-standard alias
            if (mime === 'image/JPG') mime = 'image/jpeg';
            if (mime === 'image/JPEG') mime = 'image/jpeg';
            if (mime === 'image/PNG') mime = 'image/png';
            // Infer from filename extension if browser sends wrong/empty MIME
            if (!mime || mime === 'application/octet-stream') {
              const fileName: string = (value as File).name || '';
              const ext = fileName.split('.').pop()?.toLowerCase() || '';
              const extMap: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
                eps: 'application/postscript', svg: 'image/svg+xml',
              };
              mime = extMap[ext] || 'application/octet-stream';
            }
            fileMap[index][prop] = `data:${mime};base64,${base64}`;
          } else {
            fileMap[index][prop] = value as string;
          }
        }
      }
      files = Object.values(fileMap);
    } else {
      const jsonBody = await req.json();
      engine = jsonBody.engine || 'pdflatex';
      files = jsonBody.files || [];
      mainFile = jsonBody.mainFile || 'main.tex';
      projectId = jsonBody.projectId || null;
    }

    console.log(`[LATEX_STUDIO] Request: ${session?.user?.email || 'Guest'} | Project: ${projectId}`);

    // Determine project type dynamically to route to the correct compiler engine profile.
    let projectType = 'LATEX_STUDIO';
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectType: true }
      });
      if (project) {
        projectType = project.projectType;
      }
    }

    let res;
    if (projectType === 'DOC2LATEX' || projectType === 'CONVERTER') {
      res = await runDoc2LatexCompiler(engine, files, mainFile, projectId);
    } else if (projectType === 'MIGRATOR') {
      res = await runMigratorCompiler(engine, files, mainFile, projectId);
    } else {
      res = await runLatexifyCompiler(engine, files, mainFile, projectId);
    }

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
    console.error('[LATEX_STUDIO_CRASH]', err);
    return NextResponse.json({ error: 'Critical Engine Failure', message: err.message }, { status: 500 });
  }
}
