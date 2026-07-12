const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const pid = 'cmpjh74qt00u5d4g4utpllrbm';
const project = db.prepare("SELECT structuredContent FROM Project WHERE id=?").get(pid);
const sc = JSON.parse(project.structuredContent);

const html = sc.rawHtml || '';
const idx = html.indexOf('Confusion matrices');
if (idx !== -1) {
  console.log('--- Context in rawHtml around Confusion matrices: ---');
  console.log(html.substring(Math.max(0, idx - 1000), Math.min(html.length, idx + 1000)));
} else {
  console.log('Not found in rawHtml');
}

db.close();
