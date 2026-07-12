import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

// Show announcements schema
const annRow = db.prepare("SELECT fields FROM _collections WHERE name = 'announcements'").get();
console.log('announcements fields:');
console.log(JSON.stringify(JSON.parse(annRow.fields), null, 2));

// Show users schema
const userRow = db.prepare("SELECT fields FROM _collections WHERE name = 'users'").get();
console.log('\nusers fields:');
console.log(JSON.stringify(JSON.parse(userRow.fields), null, 2));

db.close();
