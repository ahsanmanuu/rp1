import { NextRequest, NextResponse } from 'next/server';
import { PipelineGC } from '@/lib/pipeline-gc';
import { getServerSession } from '@/lib/auth-pb';
import { prisma } from '@/lib/prisma';

/**
 * Project Closure API
 * 
 * Safely closes a project session by flushing temporary buffers and
 * intermediate LaTeX residue while preserving final artifacts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;

    // Verify ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId, userId: session.user.id }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    console.log(`[API_CLOSE] Closing project session: ${projectId}`);

    // Trigger Pipeline GC
    const result = await PipelineGC.flushResidue(projectId);

    return NextResponse.json({ 
      success: true, 
      purged: result.purged,
      message: 'Project session closed and buffers flushed.'
    });

  } catch (err: any) {
    console.error('[API_CLOSE] Error during project closure:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

