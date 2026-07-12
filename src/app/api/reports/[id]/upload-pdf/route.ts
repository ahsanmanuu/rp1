import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from '@/lib/auth-pb';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, 'report.pdf');
    fs.writeFileSync(filePath, buffer);

    // Update the report record if it exists
    await prisma.reportHistory.updateMany({
      where: { 
        userId: session.user.id,
        projectId: projectId
      },
      data: {
        pdfUrl: `/uploads/projects/${projectId}/report.pdf`
      }
    });

    return NextResponse.json({ success: true, path: `/uploads/projects/${projectId}/report.pdf` });
  } catch (error: any) {
    console.error('[UPLOAD_REPORT_PDF_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

