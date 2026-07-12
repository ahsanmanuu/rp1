import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'uploads', 'chats');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${Date.now()}_${cleanFilename}`;
    const filePath = path.join(dir, uniqueFilename);
    
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/uploads/chats/${uniqueFilename}`;

    return NextResponse.json({ success: true, url: publicPath, filename: file.name });
  } catch (error: any) {
    console.error('[CHAT_UPLOAD_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
