import { NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pb = await pbAdmin();
    const records = await pb.collection('site_settings').getFullList({ filter: 'key="site_logo"', limit: 1 });
    if (records.length > 0) {
      const logoUrl = (records[0] as any).value?.logoUrl;
      if (logoUrl) {
        return NextResponse.json({ url: logoUrl });
      }
    }
  } catch {}
  return NextResponse.json({ url: '/logo.png' });
}
