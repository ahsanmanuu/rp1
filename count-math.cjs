const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const proj = db.prepare("SELECT id, structuredContent FROM Project WHERE title LIKE '%Glaucoma%' ORDER BY createdAt DESC LIMIT 1").get();
console.log('Project ID:', proj.id);

if (proj.structuredContent) {
  const sc = JSON.parse(proj.structuredContent);
  console.log('Has rawXml:', !!sc.rawXml);
  if (sc.rawXml) {
    const oMathParaCount = (sc.rawXml.match(/<m:oMathPara\b/g) || []).length;
    const oMathCount = (sc.rawXml.match(/<m:oMath\b/g) || []).length;
    console.log('m:oMathPara (display/standalone):', oMathParaCount);
    console.log('m:oMath total:', oMathCount);
    console.log('Inline math only:', oMathCount - oMathParaCount);
    console.log('\nConclusion: finalEquationCount (old) was:', oMathCount, '  fixed to:', oMathParaCount);
  } else {
    console.log('No rawXml stored - project was parsed without XML');
  }
} else {
  console.log('No structuredContent');
}

db.close();
