import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');
const row = db.prepare("SELECT fields FROM _collections WHERE name = 'users'").get();
const fields = JSON.parse(row.fields);
console.log(JSON.stringify(fields, null, 2));
db.close();
