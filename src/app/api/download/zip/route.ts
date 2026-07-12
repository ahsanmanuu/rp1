import { NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(request: Request) {
  try {
    const { texContent, title } = await request.json();

    if (!texContent) {
      return NextResponse.json({ error: 'LaTeX content is required' }, { status: 400 });
    }

    const zip = new JSZip();
    const folderName = (title || 'manuscript').replace(/\s+/g, '_').toLowerCase();

    // 1. Add the main .tex file
    zip.file(`${folderName}.tex`, texContent);

    // 2. Add an empty bibliography file if needed
    zip.file(`${folderName}.bib`, '% Add your BibTeX references here\n');

    // 3. Add instructions
    zip.file('README.txt', `Latexify LaTeX Package
---------------------------
Project: ${title || 'Manuscript'}
Generated: ${new Date().toLocaleString()}

Files:
- ${folderName}.tex: Main LaTeX source
- ${folderName}.bib: Bibliography source

Compilation:
Use pdflatex or your favorite LaTeX environment to compile ${folderName}.tex.
`);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}_package.zip"`,
      },
    });
  } catch (err: any) {
    console.error('ZIP Generation Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
