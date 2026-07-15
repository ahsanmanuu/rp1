import { NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

let cache: { data: any; expiry: number } | null = null;
let inflight: Promise<NextResponse> | null = null;
const CACHE_TTL = 30_000;

const COLLECTIONS: { key: string; collection: string; filter?: string; sort: string }[] = [
  { key: 'banners', collection: 'banners', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'testimonials', collection: 'testimonials', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'howItWorks', collection: 'how_it_works', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'galleryItems', collection: 'gallery_items', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'institutionLogos', collection: 'institution_logos', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'features', collection: 'features', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'benefits', collection: 'benefits', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'productDetails', collection: 'product_details', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'footerLinks', collection: 'footer_links', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'tasarStats', collection: 'tasar_stats', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'platformStats', collection: 'platform_stats', sort: '' },
  { key: 'videos', collection: 'videos', filter: 'isActive = true', sort: 'sortOrder' },
  { key: 'floatingBanners', collection: 'floating_banners', filter: 'isActive = true', sort: 'sortOrder' },
];

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

export async function GET() {
  const now = Date.now();
  if (cache && cache.expiry > now) {
    return NextResponse.json(cache.data);
  }

  if (inflight) return inflight;

  inflight = (async () => {
  try {
    const pb = await pbAdmin();
    const results = await Promise.allSettled(
      COLLECTIONS.map(({ key, collection, filter, sort }) =>
        (async () => {
          try {
            const opts: any = { sort: sort || undefined };
            if (filter) opts.filter = filter;
            const records = await pb.collection(collection).getFullList({ ...opts, $autoCancel: false });
            return { key, records };
          } catch {
            return { key, records: [] };
          }
        })()
      )
    );
    const data: Record<string, any[]> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        data[r.value.key] = r.value.records;
      }
    }
    const response = NextResponse.json({ success: true, data: rewriteUrls(data) });
    cache = { data: { success: true, data: rewriteUrls(data) }, expiry: Date.now() + CACHE_TTL };
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    inflight = null;
  }
  })();

  return inflight;
}
