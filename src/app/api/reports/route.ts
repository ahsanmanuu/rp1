import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";

/** In-memory cache for report history per user (60s TTL) to avoid repeated DB hits. */
const reportCache = new Map<string, { data: any[]; ts: number }>();
const REPORT_CACHE_TTL = 60_000;

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

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

    let report: any;
    try {
      report = await prisma.reportHistory.create({
        data: {
          userId: session.user.id,
          projectId,
          title,
          status: 'verified',
          statsJson: JSON.stringify(stats || {}),
          authorsJson: JSON.stringify(authors || []),
          affiliationsJson: JSON.stringify(affiliations || []),
          keywordsJson: JSON.stringify(keywords || []),
          pdfUrl,
          latexUrl,
          zipUrl
        }
      });
    } catch (createErr: any) {
      // Handle foreign key / collection-missing errors gracefully
      const msg = String(createErr?.message || '');
      if (msg.includes('Foreign key') || msg.includes('foreign key') || msg.includes('violates') || msg.includes('not found') || msg.includes('404')) {
        console.warn('[REPORTS_POST] User or collection not found, returning success without DB persist:', msg.slice(0, 200));
        return NextResponse.json({ success: true, report: { id: `local_${Date.now()}`, projectId, title }, persisted: false });
      }
      throw createErr;
    }

    // Invalidate cache so GET returns fresh data
    reportCache.delete(session.user.id);

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

    // Serve from in-memory cache when fresh
    const cached = reportCache.get(session.user.id);
    if (cached && Date.now() - cached.ts < REPORT_CACHE_TTL) {
      return NextResponse.json({ reports: cached.data });
    }

    let reports: any[] = [];
    try {
      reports = await prisma.reportHistory.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' }
      });
    } catch (dbErr: any) {
      // Collection may not exist yet — return empty list instead of 500
      const msg = String(dbErr?.message || '');
      if (msg.includes('not found') || msg.includes('404') || msg.includes('does not exist')) {
        console.warn('[REPORTS_GET] Collection not available, returning empty list');
        return NextResponse.json({ reports: [] });
      }
      throw dbErr;
    }

    const seen = new Set<string>();
    const uniqueReports = reports.filter((r: any) => {
      const key = r.projectId || r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    // Populate cache
    reportCache.set(session.user.id, { data: uniqueReports, ts: Date.now() });

    return NextResponse.json({ reports: uniqueReports });
  } catch (error: any) {
    console.error('[REPORTS_GET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
