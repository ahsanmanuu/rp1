import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Check _collections table
const cols = db.prepare("SELECT * FROM _collections LIMIT 5").all();
console.log('\n_collections sample:', cols.length);
if (cols.length > 0) {
  console.log('Keys:', Object.keys(cols[0]));
  console.log('Sample:', JSON.stringify(cols[0], null, 2).substring(0, 500));
}

db.close();
