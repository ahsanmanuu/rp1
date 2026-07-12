import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

const tables = ['membership_transactions', 'ai_usage_logs', 'announcements', 'point_transactions'];
for (const table of tables) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  console.log(table, 'columns:');
  for (const c of cols) {
    console.log(`  ${c.name}: ${c.type} (nullable: ${!c.notnull}, pk: ${c.pk})`);
  }
  console.log();
}
db.close();
