import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const report = await prisma.reportHistory.findUnique({
      where: { id }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.reportHistory.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Report Error:', error);
    return NextResponse.json({ error: error.message || 'Error deleting report' }, { status: 500 });
  }
}

