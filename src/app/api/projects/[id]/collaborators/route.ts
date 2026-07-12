import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [project, collaborators] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.projectCollaborator.findMany({ where: { projectId: id } }),
    ]);

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ collaborators });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { email, role = 'viewer' } = await req.json();

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== session.user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const collaborator = await prisma.projectCollaborator.upsert({
      where: {
        projectId_userEmail: { projectId: id, userEmail: email }
      },
      update: { role },
      create: {
        projectId: id,
        userEmail: email,
        role
      }
    });

    return NextResponse.json({ success: true, collaborator });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { email } = await req.json();

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== session.user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.projectCollaborator.delete({
      where: {
        projectId_userEmail: { projectId: id, userEmail: email }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

