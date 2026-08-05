import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Try finding by primary key ID first
    let report = await prisma.reportHistory.findUnique({
      where: { id }
    });

    // Fallback: search by projectId
    if (!report) {
      report = await prisma.reportHistory.findFirst({
        where: { projectId: id, userId: session.user.id }
      });
    }

    if (!report) {
      // If report history record was already removed or not found, return 200 OK so client list updates cleanly
      return NextResponse.json({ success: true, message: 'Report already deleted' });
    }

    if (report.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.reportHistory.delete({
      where: { id: report.id }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Report Error:', error);
    return NextResponse.json({ error: error.message || 'Error deleting report' }, { status: 500 });
  }
}

