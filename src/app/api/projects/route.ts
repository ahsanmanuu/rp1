import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";
export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getClientGeoInfo } = await import('@/lib/clientGeo');
    const geo = await getClientGeoInfo(req as any);
    const { checkUserAnomaly } = await import('@/lib/security');
    const result = await checkUserAnomaly(session.user.id, geo.ipAddress || undefined, geo.location || undefined);
    if (result.blocked) {
      return NextResponse.json({ error: 'BLOCKED', blockedUntil: result.blockedUntil?.toISOString() }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type');

    console.log('Fetching projects for user:', session.user.id, 'with type filter:', typeFilter);
    const projects = await prisma.project.findMany({
      where: { 
        userId: session.user.id,
        ...(typeFilter ? { projectType: typeFilter } : {})
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        projectType: true,
        wordCount: true,
        charCount: true,
        imageCount: true,
        chartCount: true,
        tableCount: true,
        equationCount: true,
        citationCount: true,
        referenceCount: true,
        pseudocodeCount: true
      }
    });

    console.log(`Found ${projects.length} projects`);
    // Use initial parsed statistics instead of recalculating on-the-fly
    const historyData = projects.map((p: any) => {
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        date: p.createdAt,
        type: p.projectType,
        stats: {
          words: p.wordCount,
          characters: p.charCount,
          images: p.imageCount,
          charts: p.chartCount,
          tables: p.tableCount,
          equations: p.equationCount,
          citations: p.citationCount,
          references: p.referenceCount,
          pseudocode: p.pseudocodeCount
        }
      };
    });

    console.log('Returning project list');
    return NextResponse.json({ projects: historyData });

  } catch (error: any) {
    console.error('Fetch Projects API Fatal Error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching projects' }, { status: 500 });
  }
}
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getClientGeoInfo } = await import('@/lib/clientGeo');
    const geo = await getClientGeoInfo(req as any);
    const { checkUserAnomaly, logToolUsage } = await import('@/lib/security');
    const result = await checkUserAnomaly(session.user.id, geo.ipAddress || undefined, geo.location || undefined);
    if (result.blocked) {
      return NextResponse.json({ error: 'BLOCKED', blockedUntil: result.blockedUntil?.toISOString() }, { status: 403 });
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
          message: 'Free membership is restricted to a total of 7 projects. Please upgrade to Premium.' 
        }, { status: 403 });
      }
    }

    const { name, projectType, templateName } = await req.json();

    const project = await prisma.project.create({
      data: {
        title: name || 'Untitled Project',
        userId: session.user.id,
        projectType: projectType || 'LATEX_STUDIO',
        templateName: templateName || null,
        status: 'draft',
        structuredContent: "{}"
      }
    });

    await logToolUsage(session.user.id, 'latexify_studio', 'create_project');

    return NextResponse.json({ project });

  } catch (error: any) {
    console.error('Create Project API Fatal Error:', error);
    return NextResponse.json({ error: error.message || 'Error creating project' }, { status: 500 });
  }
}
