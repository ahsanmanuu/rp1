import { NextRequest, NextResponse } from "next/server";

// Initialize pdfjs worker
if (typeof window === 'undefined') {
  // node environment
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    // 1. Handle BibTeX (.bib)
    if (fileName.endsWith('.bib')) {
      const content = buffer.toString('utf-8');
      // Simple BibTeX parser logic (extracting first entry for demo)
      const titleMatch = content.match(/title\s*=\s*{([^}]+)}/i);
      const authorMatch = content.match(/author\s*=\s*{([^}]+)}/i);
      const yearMatch = content.match(/year\s*=\s*{(\d+)}/i);
      
      return NextResponse.json({
        citations: [{
          sourceType: "bibtex",
          title: titleMatch ? titleMatch[1] : fileName,
          authors: authorMatch ? authorMatch[1] : "Unknown",
          year: yearMatch ? yearMatch[1] : "",
          sourceName: "BibTeX Import",
          bib: content
        }]
      });
    }

    // 2. Handle PDF (.pdf)
    if (fileName.endsWith('.pdf')) {
      // Basic extraction from filename or placeholders
      // In production, we'd use pdf-parse to look for DOIs
      return NextResponse.json({
        citations: [{
          sourceType: "pdf",
          title: fileName.replace('.pdf', ''),
          authors: "Extracted from PDF",
          year: new Date().getFullYear().toString(),
          sourceName: "PDF Upload",
          bib: `% Extracted from ${fileName}`
        }]
      });
    }

    return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
  } catch (error) {
    console.error("File parse error:", error);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
