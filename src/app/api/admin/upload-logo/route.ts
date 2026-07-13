import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const pb = await pbAdmin();

    // Upload file to the uploads collection (already has a file field)
    const record = await pb.collection('uploads').create({ file });
    const logoUrl = pb.files.getUrl(record, record.file);

    // Store the logo URL in site_settings
    const existing = await pb.collection('site_settings').getFullList({ filter: 'key="site_logo"', limit: 1 });
    if (existing.length > 0) {
      await pb.collection('site_settings').update(existing[0].id, { value: { logoUrl } });
    } else {
      await pb.collection('site_settings').create({
        key: 'site_logo',
        label: 'Site Logo',
        value: { logoUrl },
      });
    }

    return NextResponse.json({ success: true, url: logoUrl, recordId: record.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const pb = await pbAdmin();
    const existing = await pb.collection('site_settings').getFullList({ filter: 'key="site_logo"', limit: 1 });
    if (existing.length > 0) {
      await pb.collection('site_settings').delete(existing[0].id);
    }
    return NextResponse.json({ success: true, message: 'Logo reset to default' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
