import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');
const cols = db.prepare('PRAGMA table_info(users)').all();
console.log('users columns:', cols.map(c=>c.name).join(', '));
db.close();
