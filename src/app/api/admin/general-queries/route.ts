import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const filter = searchParams.get('filter');

    const whereClause: any = {};
    if (filter === 'replied') {
      whereClause.status = 'replied';
    } else if (filter === 'pending') {
      // Handles 'pending', empty status, or null status
      whereClause.status = { not: 'replied' };
    }

    let data;
    if (type === 'history') {
      data = await prisma.generalQuery.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: 10,
      });
    } else if (type === 'all') {
      data = await prisma.generalQuery.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      data = await prisma.generalQuery.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    const data = await prisma.generalQuery.create({
      data: { name, email, phone, subject, message },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const data = await prisma.generalQuery.update({
      where: { id },
      data: fields,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    await prisma.generalQuery.delete({ where: { id } });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
