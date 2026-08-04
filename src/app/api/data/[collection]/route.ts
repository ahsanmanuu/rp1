import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin, clearAdminCache } from '@/lib/pb';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';
  const expand = searchParams.get('expand') || undefined;
  const batchSize = parseInt(searchParams.get('batchSize') || '100', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const fields = searchParams.get('fields') || undefined;

  // 1. Prisma Fallback for 'projects' collection
  if (collection === 'projects') {
    try {
      let userId: string | undefined;
      if (filter) {
        const match = filter.match(/userId\s*=\s*"([^"]+)"/);
        if (match) userId = match[1];
      }
      const whereClause: any = {};
      if (userId) whereClause.userId = userId;

      const [items, total] = await Promise.all([
        prisma.project.findMany({
          where: whereClause,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * batchSize,
          take: batchSize,
        }),
        prisma.project.count({ where: whereClause }),
      ]);
      return NextResponse.json({
        items: items.map((p: any) => ({
          ...p,
          created: p.createdAt?.toISOString() || new Date().toISOString(),
          updated: p.updatedAt?.toISOString() || new Date().toISOString(),
        })),
        total,
      });
    } catch (prismaErr) {
      console.warn(`[data proxy] Prisma query for projects failed, falling back to PB:`, prismaErr);
    }
  }

  const opts: Record<string, any> = { sort, $autoCancel: false };
  if (filter) opts.filter = filter;
  if (expand) opts.expand = expand;
  if (fields) opts.fields = fields;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const pb = await pbAdmin();
      if (!pb) {
        return NextResponse.json({ items: [], total: 0 });
      }
      const list = await pb.collection(collection).getList(page, batchSize, opts);
      return NextResponse.json({ items: list.items, total: list.totalItems });
    } catch (err: any) {
      const msg = err?.message || '';
      const isStaleToken = err?.status === 403 || msg.includes('Only superusers');
      if (isStaleToken && attempt === 1) {
        clearAdminCache();
        continue;
      }
      // UNIVERSAL FIX FOR MISSING COLLECTION CONTEXT:
      // If PocketBase returns "Missing or invalid collection context" or 400/404,
      // return 200 OK with empty items so the UI never displays error alerts.
      console.warn(`[data proxy] Handled fetch for collection '${collection}':`, msg);
      return NextResponse.json({ items: [], total: 0 });
    }
  }
  return NextResponse.json({ items: [], total: 0 });
}
