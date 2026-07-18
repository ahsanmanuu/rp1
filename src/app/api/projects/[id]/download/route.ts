import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        files: true
      }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const zip = new JSZip();
    
    // Add main tex file
    zip.file("main.tex", project.latexContent || "");
    
    // Add references.bib
    zip.file("references.bib", project.bibContent || "");
    
    // Add additional files (images, assets)
    if (project.files && project.files.length > 0) {
      for (const file of project.files) {
        try {
          // Normalize path: handle leading slashes and platform-specific separators
          const filePath = file.filePath;
          if (!filePath) continue;
          
          const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
          const absolutePath = path.join(process.cwd(), 'public', ...cleanPath.split('/'));
          
          if (fs.existsSync(absolutePath)) {
            const fileData = fs.readFileSync(absolutePath);
            zip.file(file.filename, fileData);
          } else if (file.content) {
            // Fallback: If not on disk, use DB content (for text files)
            const isBinary = file.filename.endsWith('.jpg') || file.filename.endsWith('.png') || file.filename.endsWith('.pdf');
            if (!isBinary) {
               zip.file(file.filename, file.content);
            }
          }
        } catch (e) {
          console.error(`Failed to include file ${file.filename} in zip:`, e);
        }
      }
    }
    
    const content = await zip.generateAsync({ type: "nodebuffer" });
    
    // Format title into a safe filename (remove extension if it's there like .docx, keep spaces)
    let safeTitle = "document";
    if (project && project.title) {
        safeTitle = project.title.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\ \(\)]/g, '').trim();
    }

    // Mark project as completed when zip is downloaded
    await prisma.project.update({
      where: { id },
      data: { status: 'completed', firstPdfDownloaded: true }
    }).catch((e: any) => console.error("Failed to mark project completed on zip download:", e.message));

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeTitle}.zip"`,
      },
    });

  } catch (error: any) {
    console.error('Download ZIP Error:', error);
    return NextResponse.json({ error: error.message || 'Error generating ZIP' }, { status: 500 });
  }
}

