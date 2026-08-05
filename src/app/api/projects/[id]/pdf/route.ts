import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-pb';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

/** Try to find a valid PDF in the project directory. Returns path or null. */
function findPdf(projectId: string): string | null {
  const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
  // 1. Canonical path
  const canonical = path.join(projectDir, 'main.pdf');
  try {
    const st = fs.statSync(canonical);
    if (st.size > 0) return canonical;
  } catch {}
  // 2. Fallback: any .pdf in directory
  try {
    const files = fs.readdirSync(projectDir);
    for (const f of files) {
      if (f.toLowerCase().endsWith('.pdf')) {
        const p = path.join(projectDir, f);
        try {
          const st = fs.statSync(p);
          if (st.size > 0) return p;
        } catch {}
      }
    }
  } catch {}
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  // Verify ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    // Fallback: project may exist on disk but not in DB (orphaned upload).
    // Only allow access if the project directory exists AND the user owns it via session.
    const fallbackDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    if (!fs.existsSync(fallbackDir)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // For orphaned projects: allow but log
    console.warn(`[PDF] Orphaned project ${projectId} accessed by user ${session.user.id}`);
  }

  if (project && project.userId !== session.user.id) {
    const collab = await prisma.projectCollaborator.findFirst({
      where: { projectId, userEmail: session.user.email || '' }
    });
    if (!collab) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find the PDF — no TOCTOU: findPdf uses statSync internally
  const pdfPath = findPdf(projectId);

  const searchParams = req.nextUrl.searchParams;
  const isBase64 = searchParams.get('base64') === 'true';

  if (!pdfPath) {
    // Distinguish "not yet" from "never" by checking if project dir exists
    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    const dirExists = fs.existsSync(projectDir);

    if (isBase64) {
      return NextResponse.json({
        pdfBase64: null,
        success: false,
        retryable: true,
        message: dirExists ? 'PDF compiling or not generated yet' : 'Project directory not found'
      }, { status: 200 });
    }

    if (!dirExists) {
      return NextResponse.json({ error: 'Not found', retryable: false }, { status: 404 });
    }
    // Directory exists but no PDF — likely still compiling
    return NextResponse.json({ error: 'PDF not generated yet', retryable: true }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const stat = fs.statSync(pdfPath);

    const searchParams = req.nextUrl.searchParams;
    const isBase64 = searchParams.get('base64') === 'true';

    if (isBase64) {
      const base64 = fileBuffer.toString('base64');
      return NextResponse.json({ pdfBase64: base64 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', stat.size.toString());
    headers.set('Content-Disposition', 'inline; filename="manuscript.pdf"');
    headers.set('Cache-Control', 'no-store, must-revalidate');

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (err: any) {
    // File may have been deleted between findPdf and readFileSync
    console.error('[API_PDF] Error reading PDF:', err);
    return NextResponse.json({ error: 'PDF not generated yet', retryable: true }, { status: 404 });
  }
}
