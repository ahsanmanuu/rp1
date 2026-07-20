import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin, clearAdminCache } from '@/lib/pb';

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';
  const expand = searchParams.get('expand') || undefined;
  const batchSize = parseInt(searchParams.get('batchSize') || '100', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);

  const opts: Record<string, any> = { sort, $autoCancel: false };
  if (filter) opts.filter = filter;
  if (expand) opts.expand = expand;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const pb = await pbAdmin();
      if (!pb) {
        console.error(`[data proxy] pbAdmin() returned null for ${collection}`);
        return NextResponse.json({ items: [], total: 0 });
      }
      const list = await pb.collection(collection).getList(page, batchSize, opts);
      return NextResponse.json({ items: list.items, total: list.totalItems });
    } catch (err: any) {
      const msg = err?.message || '';
      const isStaleToken = err?.status === 403 || msg.includes('Only superusers');
      if (isStaleToken && attempt === 1) {
        console.warn(`[data proxy] Stale admin token for ${collection}, re-authenticating...`);
        clearAdminCache();
        continue;
      }
      // Silently skip PB auto-cancellation noise instead of forwarding to client
      if (msg.includes('aborted') || msg.includes('autocancelled') || msg.includes('autocancel') || msg === 'offline') {
        return NextResponse.json({ items: [], total: 0 });
      }
      console.error(`[data proxy] Error fetching ${collection}:`, err);
      return NextResponse.json({ items: [], total: 0, error: msg || 'Failed to fetch data' }, { status: 500 });
    }
  }
}
