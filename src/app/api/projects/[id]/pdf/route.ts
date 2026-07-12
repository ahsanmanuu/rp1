import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-pb';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  
  // Verify ownership
  const project = await prisma.project.findUnique({ where: { id: projectId }});
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  if (project.userId !== session.user.id) {
     const collab = await prisma.projectCollaborator.findFirst({
         where: { projectId, userEmail: session.user.email || '' }
     });
     if (!collab) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find the PDF file
  let pdfPath = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId, 'main.pdf');
  
  if (!fs.existsSync(pdfPath)) {
      // Fallback: Check if there's any other .pdf file in the directory
      const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
      if (fs.existsSync(projectDir)) {
          const files = fs.readdirSync(projectDir);
          const otherPdf = files.find(f => f.toLowerCase().endsWith('.pdf'));
          if (otherPdf) {
              pdfPath = path.join(projectDir, otherPdf);
          }
      }
  }

  if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: 'PDF not generated yet' }, { status: 404 });
  }

  try {
      const stat = fs.statSync(pdfPath);
      if (stat.size === 0) {
          // If 0-bytes, return 404 so frontend knows it's broken
          return NextResponse.json({ error: 'PDF is 0 bytes' }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(pdfPath);
      
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
      console.error('[API_PDF] Error reading PDF:', err);
      return NextResponse.json({ error: 'Failed to read PDF' }, { status: 500 });
  }
}

