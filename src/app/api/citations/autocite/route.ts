import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json();
    if (!identifier) return NextResponse.json({ error: "Missing identifier" }, { status: 400 });

    const id = identifier.trim();

    // 1. Check if it's a DOI
    if (id.includes('10.') || id.startsWith('doi:')) {
      const doi = id.replace('doi:', '').trim();
      const res = await fetch(`https://api.crossref.org/works/${doi}`, {
        headers: { 'User-Agent': 'ScholarlyStudio/1.0 (mailto:support@scholarlystudio.com)' },
        signal: AbortSignal.timeout(15000),
      });
      
      if (res.ok) {
        const data = await res.json();
        const item = data.message;
        
        return NextResponse.json({
          sourceType: "journal",
          title: item.title?.[0] || "Untitled Article",
          authors: item.author?.map((a: any) => `${a.family}, ${a.given}`).join('; ') || "Unknown Author",
          year: item.issued?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || "",
          sourceName: item['container-title']?.[0] || "",
          doi: doi,
          url: item.URL || `https://doi.org/${doi}`,
          rawData: item
        });
      }
    }

    // 2. Check if it's an ISBN
    const cleanIsbn = id.replace(/[- ]/g, '');
    if (cleanIsbn.length === 10 || cleanIsbn.length === 13) {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      const bookKey = `ISBN:${cleanIsbn}`;
      
      if (data[bookKey]) {
        const book = data[bookKey];
        return NextResponse.json({
          sourceType: "book",
          title: book.title || "Untitled Book",
          authors: book.authors?.map((a: any) => a.name).join('; ') || "Unknown Author",
          year: book.publish_date || "",
          sourceName: book.publishers?.[0]?.name || "",
          isbn: cleanIsbn,
          url: book.url || "",
          rawData: book
        });
      }
    }

    // 3. Fallback to URL metadata extraction (Simple)
    if (id.startsWith('http')) {
      return NextResponse.json({
        sourceType: "website",
        title: "Web Page Title",
        authors: "",
        year: new Date().getFullYear().toString(),
        sourceName: new URL(id).hostname,
        url: id,
        rawData: { url: id }
      });
    }

    // 4. Fallback to Title Search via CrossRef
    const searchRes = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(id)}&rows=10`, {
      headers: { 'User-Agent': 'ScholarlyStudio/1.0 (mailto:support@scholarlystudio.com)' },
      signal: AbortSignal.timeout(15000),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.message?.items?.length > 0) {
        const results = searchData.message.items.map((item: any) => ({
          id: item.DOI || Math.random().toString(36).substr(2, 9),
          sourceType: item.type === "journal-article" ? "journal" : "article",
          title: item.title?.[0] || "Untitled Article",
          authors: item.author?.map((a: any) => `${a.family}, ${a.given}`).join('; ') || "Unknown Author",
          authorShort: item.author?.map((a: any) => a.family).slice(0, 3).join(', ') + (item.author?.length > 3 ? '...' : '') || "Unknown",
          year: item.issued?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || "",
          sourceName: item['container-title']?.[0] || "",
          doi: item.DOI,
          url: item.URL || `https://doi.org/${item.DOI}`
        }));
        return NextResponse.json({ results });
      }
    }

    return NextResponse.json({ error: "Could not resolve identifier. Try a DOI, ISBN, URL, or full article title." }, { status: 404 });
  } catch (error) {
    console.error("Autocite error:", error);
    return NextResponse.json({ error: "Metadata extraction failed" }, { status: 500 });
  }
}
