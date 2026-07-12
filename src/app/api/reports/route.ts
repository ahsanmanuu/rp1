import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { 
      projectId, 
      title, 
      stats, 
      authors, 
      affiliations, 
      keywords,
      pdfUrl,
      latexUrl,
      zipUrl 
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const report = await prisma.reportHistory.create({
      data: {
        userId: session.user.id,
        projectId,
        title,
        statsJson: JSON.stringify(stats || {}),
        authorsJson: JSON.stringify(authors || []),
        affiliationsJson: JSON.stringify(affiliations || []),
        keywordsJson: JSON.stringify(keywords || []),
        pdfUrl,
        latexUrl,
        zipUrl
      }
    });

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('[REPORTS_POST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const reports = await prisma.reportHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const seen = new Set<string>();
    const uniqueReports = reports.filter((r: any) => {
      const key = r.projectId || r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    return NextResponse.json({ reports: uniqueReports });
  } catch (error: any) {
    console.error('[REPORTS_GET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
