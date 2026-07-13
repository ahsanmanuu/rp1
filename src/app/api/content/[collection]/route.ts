import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = new Set([
  'home_content',
  'how_it_works',
  'gallery_items',
  'institution_logos',
  'features',
  'benefits',
  'product_details',
  'footer_links',
  'tasar_stats',
  'platform_stats',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return NextResponse.json({ success: false, error: `Invalid collection: ${collection}` }, { status: 400 });
    }

    const pb = await pbAdmin();
    const { searchParams } = new URL(_req.url);
    const filter = searchParams.get('filter') || '';
    const sort = searchParams.get('sort') || 'sortOrder';
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let queryFilter = filter;
    if (activeOnly) {
      queryFilter = queryFilter ? `(${queryFilter}) && isActive = true` : 'isActive = true';
    }

    const queryParams: Record<string, any> = { sort };
    if (queryFilter) queryParams.filter = queryFilter;

    const records = await pb.collection(collection).getFullList(queryParams);
    return NextResponse.json({ success: true, data: records });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return NextResponse.json({ success: false, error: `Invalid collection: ${collection}` }, { status: 400 });
    }

    const pb = await pbAdmin();
    const body = await req.json();
    const record = await pb.collection(collection).create(body);
    return NextResponse.json({ success: true, data: record });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return NextResponse.json({ success: false, error: `Invalid collection: ${collection}` }, { status: 400 });
    }

    const pb = await pbAdmin();
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const record = await pb.collection(collection).update(id, data);
    return NextResponse.json({ success: true, data: record });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return NextResponse.json({ success: false, error: `Invalid collection: ${collection}` }, { status: 400 });
    }

    const pb = await pbAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    await pb.collection(collection).delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
