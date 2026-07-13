import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

const PB_COLLECTION = 'testimonials';

async function syncToPb(data: any, pbId?: string) {
  try {
    const pb = await pbAdmin();
    if (pbId) {
      await pb.collection(PB_COLLECTION).update(pbId, data);
    } else {
      await pb.collection(PB_COLLECTION).create(data);
    }
  } catch (e) {
    console.warn('[TESTIMONIALS] PB sync skipped:', (e as any)?.message);
  }
}

async function deleteFromPb(pbId: string) {
  try {
    const pb = await pbAdmin();
    await pb.collection(PB_COLLECTION).delete(pbId);
  } catch (e) {
    console.warn('[TESTIMONIALS] PB delete skipped:', (e as any)?.message);
  }
}

export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json({ success: true, data: testimonials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const testimonial = await prisma.testimonial.create({ data: body });
    await syncToPb(body);
    return NextResponse.json({ success: true, data: testimonial });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const testimonial = await prisma.testimonial.update({ where: { id }, data });
    await syncToPb(data, id);
    return NextResponse.json({ success: true, data: testimonial });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    await prisma.testimonial.delete({ where: { id } });
    await deleteFromPb(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
