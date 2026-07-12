import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await prisma.project.findUnique({ 
      where: { id: projectId },
      select: { userId: true, firstPdfDownloaded: true }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    
    // SECURITY: Ensure the project belongs to the requesting user
    if (project.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized project access' }, { status: 403 });
    }

    // STICKY LOGIC: Once a project is paid, it stays free forever
    if (project.firstPdfDownloaded) {
      return NextResponse.json({ 
        success: true, 
        remainingPoints: user.points, 
        message: 'Unlimited access granted (Already paid)' 
      });
    }

    // COST CONSTANT
    const DOWNLOAD_COST = 10;

    // Ensure they have enough points
    if (user.points < DOWNLOAD_COST) {
      return NextResponse.json({ 
        error: `Insufficient points (Balance: ${user.points})`, 
        balanceNeeded: DOWNLOAD_COST 
      }, { status: 400 });
    }

    // ATOMIC TRANSACTION: Ensuring balance and project status update together
    const updatedUser = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: DOWNLOAD_COST } }
      });
      
      await tx.project.update({
        where: { id: projectId },
        data: { firstPdfDownloaded: true }
      });

      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          amount: -DOWNLOAD_COST,
          type: "deduction",
          description: `Download fee for project ${projectId}`
        }
      });
      
      return u;
    });

    return NextResponse.json({ 
      success: true, 
      remainingPoints: updatedUser.points, 
      message: `Successfully deducted ${DOWNLOAD_COST} points.` 
    });

  } catch (error: any) {
    console.error('Point Deduction Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing transaction' }, { status: 500 });
  }
}
