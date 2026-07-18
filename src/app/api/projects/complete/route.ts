import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, type } = await req.json();
    if (!id || !type) {
      return NextResponse.json({ error: 'Missing id or type' }, { status: 400 });
    }

    console.log(`[PROJECT_COMPLETE_TELEMETRY] Request: user=${session.user.id} | id=${id} | type=${type}`);

    if (type === 'project') {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { userId: true, status: true }
      });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (project.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (project.status !== 'completed') {
        await prisma.project.update({
          where: { id },
          data: { status: 'completed', firstPdfDownloaded: true }
        });
        console.log(`[PROJECT_COMPLETE_TELEMETRY] Marked project ${id} as completed.`);
      }
    } else if (type === 'citation') {
      const citation = await prisma.citationProject.findUnique({
        where: { id },
        select: { userId: true, status: true }
      });
      if (!citation) {
        return NextResponse.json({ error: 'Citation project not found' }, { status: 404 });
      }
      if (citation.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (citation.status !== 'completed') {
        await prisma.citationProject.update({
          where: { id },
          data: { status: 'completed' }
        });
        console.log(`[PROJECT_COMPLETE_TELEMETRY] Marked citation project ${id} as completed.`);
      }
    } else if (type === 'review') {
      const review = await prisma.paperReview.findUnique({
        where: { id },
        select: { userId: true, status: true }
      });
      if (!review) {
        return NextResponse.json({ error: 'Paper review not found' }, { status: 404 });
      }
      if (review.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (review.status !== 'completed') {
        await prisma.paperReview.update({
          where: { id },
          data: { status: 'completed' }
        });
        console.log(`[PROJECT_COMPLETE_TELEMETRY] Marked paper review ${id} as completed.`);
      }
    } else {
      return NextResponse.json({ error: 'Invalid project type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PROJECT_COMPLETE_TELEMETRY_ERROR] Failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
