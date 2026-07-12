import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Create or find existing share link
    let shareLink = await prisma.shareLink.findFirst({
      where: { projectId: id }
    });

    if (!shareLink) {
      shareLink = await prisma.shareLink.create({
        data: {
          projectId: id,
          shareToken: uuidv4()
        }
      });
    }

    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const origin = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || "http://localhost:3000");
    const shareUrl = `${origin}/share/${shareLink.shareToken}`;

    return NextResponse.json({ success: true, shareUrl, shareToken: shareLink.shareToken });

  } catch (error: any) {
    console.error('Share Project Error:', error);
    return NextResponse.json({ error: error.message || 'Error sharing project' }, { status: 500 });
  }
}

