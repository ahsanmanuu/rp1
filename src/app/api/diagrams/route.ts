import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";
// POST /api/diagrams — create a new diagram project and return its ID
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { title = 'Untitled Diagram', content = '', structuredContent = '{}' } = body;

    // Check project limits for Free tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membership: true }
    });

    if (user?.membership === 'free' || !user?.membership) {
      const projectsCount = await prisma.project.count({
        where: { userId: session.user.id }
      });
      if (projectsCount >= 5) {
        return NextResponse.json({ 
          error: 'LIMIT_REACHED', 
          message: 'Free membership is restricted to a total of 5 projects. Please upgrade to Premium.' 
        }, { status: 403 });
      }
    }

    const project = await prisma.project.create({
      data: {
        title,
        userId: session.user.id,
        projectType: 'DIAGRAM',
        status: 'draft',
        content,
        structuredContent,
        latexContent: '',
      },
    });

    return NextResponse.json({ projectId: project.id, project });
  } catch (error: any) {
    console.error('[Diagrams API] Create error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create diagram' }, { status: 500 });
  }
}

// GET /api/diagrams — list all diagram projects for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id, projectType: 'DIAGRAM' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        content: true,
        structuredContent: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('[Diagrams API] List error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list diagrams' }, { status: 500 });
  }
}
