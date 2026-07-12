import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');
const cols = db.prepare('PRAGMA table_info(point_transactions)').all();
console.log('point_transactions:', cols.map(c=>c.name).join(', '));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%audit%'").all();
console.log('Audit tables:', tables.map(t=>t.name));
const mt = db.prepare('PRAGMA table_info(membership_transactions)').all();
console.log('membership_transactions:', mt.map(c=>c.name).join(', '));
db.close();
