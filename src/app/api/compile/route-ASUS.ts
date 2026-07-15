import { NextResponse } from 'next/server';

/**
 * Proxy for latexonline.cc to avoid CORS and provide a cleaner API.
 * For production, self-hosting latex-online is recommended.
 */
export async function POST(request: Request) {
  try {
    const { texContent } = await request.json();

    if (!texContent) {
      return NextResponse.json({ error: 'LaTeX content is required' }, { status: 400 });
    }

    // URL Encode the LaTeX content
    const encodedTex = encodeURIComponent(texContent);
    const compileUrl = `https://latexonline.cc/compile?text=${encodedTex}`;

    const response = await fetch(compileUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
       const status = response.status;
       if (status === 414) {
          throw new Error('Document is too large for the cloud compiler. Please use a shorter text or host your own compiler.');
       }
       throw new Error(`Cloud Compilation Failed (Status: ${status})`);
    }

    const pdfBuffer = await response.arrayBuffer();

    // Return the PDF buffer
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="manuscript.pdf"',
      },
    });
  } catch (err: any) {
    console.error('Compilation Proxy Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
