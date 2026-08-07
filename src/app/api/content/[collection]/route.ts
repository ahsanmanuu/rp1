import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = new Set([
  'banners',
  'testimonials',
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
  'floating_banners',
  'videos',
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

    const { searchParams } = new URL(_req.url);
    const filter = searchParams.get('filter') || '';
    const sort = searchParams.get('sort') || 'sortOrder';
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let records: any[] = [];
    try {
      const pb = await pbAdmin();
      let queryFilter = filter;
      if (activeOnly) {
        queryFilter = queryFilter ? `(${queryFilter}) && isActive = true` : 'isActive = true';
      }

      const queryParams: Record<string, any> = { sort };
      if (queryFilter) queryParams.filter = queryFilter;

      records = await pb.collection(collection).getFullList(queryParams);
    } catch {
      // Fallback to pre-exported homepage-content.json
      try {
        const jsonPath = path.resolve(process.cwd(), 'src/assets/homepage-content.json');
        if (fs.existsSync(jsonPath)) {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          const json = JSON.parse(raw);
          records = json[collection] || json[camelCase(collection)] || [];
          if (activeOnly) {
            records = records.filter((r: any) => r.isActive !== false);
          }
        }
      } catch {}
    }

    const cleaned = rewriteUrls(records);
    return NextResponse.json({ success: true, data: cleaned });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function rewriteUrls(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/http:\/\/(127\.0\.0\.1|localhost):8090/g, '/pb');
  }
  if (Array.isArray(obj)) {
    return obj.map(rewriteUrls);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = rewriteUrls(value);
    }
    return newObj;
  }
  return obj;
}

async function exportHomepageContent() {
  try {
    const pb = await pbAdmin();
    const collections = [
      'banners', 'testimonials', 'how_it_works', 'gallery_items', 
      'institution_logos', 'features', 'benefits', 'product_details', 
      'footer_links', 'tasar_stats', 'platform_stats', 'floating_banners',
      'videos'
    ];
    
    const data: Record<string, any[]> = {};
    for (const col of collections) {
      const records = await pb.collection(col).getFullList();
      const cleanRecords = records.map(r => {
        const { collectionId, collectionName, created, updated, ...clean } = r;
        return clean;
      });
      data[col] = cleanRecords;
    }
    
    const destPath = path.resolve(process.cwd(), 'src/assets/homepage-content.json');
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(data, null, 2));
    console.log('[PB Sync] Homepage content auto-exported to JSON.');
  } catch (err: any) {
    console.error('[PB Sync] Homepage content auto-export failed:', err.message);
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
    
    if (ALLOWED_COLLECTIONS.has(collection)) {
      await exportHomepageContent().catch(() => {});
    }

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

    if (ALLOWED_COLLECTIONS.has(collection)) {
      await exportHomepageContent().catch(() => {});
    }

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

    if (ALLOWED_COLLECTIONS.has(collection)) {
      await exportHomepageContent().catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
