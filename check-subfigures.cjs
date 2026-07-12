const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const pid = 'cmpjh74qt00u5d4g4utpllrbm';
console.log('Project:', pid);

const files = db.prepare("SELECT filename, content FROM ProjectFile WHERE projectId=? AND content LIKE '%subfigure%'").all(pid);
console.log('Found subfigure files:', files.length);

files.forEach(f => {
  console.log('\n--- File:', f.filename, '---');
  console.log(f.content);
});

db.close();
