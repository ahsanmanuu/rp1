import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const collection = (formData.get('collection') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const pb = await pbAdmin();
    const record = await pb.collection(collection).create({ file });
    const url = pb.files.getUrl(record, record.file);

    return NextResponse.json({ success: true, url, recordId: record.id, filename: record.file });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
