import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { projectId: _projectId } = await request.json();

    return NextResponse.json({ success: true, message: 'Download tracking via PocketBase.' });
  } catch (err: any) {
    console.error('Download Track Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
