const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const proj = db.prepare("SELECT id, structuredContent FROM Project WHERE title LIKE '%Glaucoma%' ORDER BY createdAt DESC LIMIT 1").get();
console.log('Project ID:', proj.id);

if (proj.structuredContent) {
  const sc = JSON.parse(proj.structuredContent);
  
  // Count MATHBLOCKX markers in the rawHtml
  if (sc.rawHtml) {
    const allMarkers = [...sc.rawHtml.matchAll(/MATHBLOCKX(\d+)XMARKER/g)].map(m => parseInt(m[1]));
    const unique = [...new Set(allMarkers)].sort((a,b) => a-b);
    console.log('All unique MATHBLOCKX indices in rawHtml:', unique.join(', '));
    console.log('Total unique markers:', unique.length);
    
    // Count how many are in standalone <p> tags (nothing else in the tag)
    let standaloneCount = 0;
    const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pTagRegex.exec(sc.rawHtml)) !== null) {
      const inner = match[1]
        .replace(/<a[^>]*><\/a>/g, '') // strip empty anchors
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<em>\s*<\/em>/gi, '')
        .replace(/<strong>\s*<\/strong>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (/^MATHBLOCKX\d+XMARKER[)]*$/.test(inner)) {
        standaloneCount++;
        console.log('  Standalone:', inner.slice(0, 50));
      }
    }
    console.log('\nStandalone (display-only) equation paragraphs:', standaloneCount);
  }
}

db.close();
