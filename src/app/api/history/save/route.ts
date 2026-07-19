import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, type, content, metadata } = await req.json();

    if (!title || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check project limits for Free tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membership: true }
    });

    if (user?.membership === 'free' || !user?.membership) {
      const [projectCount, citationCount, reviewCount] = await Promise.all([
        prisma.project.count({ where: { userId: session.user.id } }),
        prisma.citationProject.count({ where: { userId: session.user.id } }),
        prisma.paperReview.count({ where: { userId: session.user.id } }),
      ]);
      const totalCount = projectCount + citationCount + reviewCount;
      if (totalCount >= 7) {
        return NextResponse.json({ 
          error: 'LIMIT_REACHED', 
          message: 'Free membership is restricted to a total of 7 projects across all tools. Please upgrade to Premium.' 
        }, { status: 403 });
      }
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        title,
        projectType: type,
        latexContent: type === 'CITATION' ? content : '',
        content: content || '',
        structuredContent: JSON.stringify(metadata || {}),
        status: 'completed'
      }
    });

    return NextResponse.json({ success: true, id: project.id });
  } catch (error: any) {
    console.error('History Save API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
