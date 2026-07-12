const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const proj = db.prepare("SELECT id FROM Project WHERE title LIKE '%Glaucoma%' ORDER BY createdAt DESC LIMIT 1").get();
const pid = proj.id;
console.log('Project:', pid);

// Get the main.tex file 
const mainTex = db.prepare("SELECT content FROM ProjectFile WHERE projectId=? AND (filename='main.tex' OR filename LIKE '%sections%') ORDER BY filename").all(pid);
console.log('Files:', mainTex.map(f => f.content ? f.content.length : 0));

// Check equation environments in each section file
const eqFiles = db.prepare("SELECT filename, content FROM ProjectFile WHERE projectId=? AND filename LIKE 'equations/%'").all(pid);
console.log('\nEquation files:', eqFiles.length);
eqFiles.forEach(f => {
  const eqCount = (f.content.match(/\\begin\{equation\}/g) || []).length;
  const alignCount = (f.content.match(/\\begin\{align/g) || []).length;
  console.log(' ', f.filename, '- equations:', eqCount, 'aligns:', alignCount);
});

// Get consolidated stats
console.log('\nTotal equation environments across all eq files:', eqFiles.reduce((acc, f) => {
  return acc + (f.content.match(/\\begin\{(?:equation|align|gather|multline|eqnarray)\*?\}/g) || []).length;
}, 0));

db.close();
