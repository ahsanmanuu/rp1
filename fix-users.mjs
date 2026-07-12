/**
 * Fix the `users` collection in PocketBase:
 * 1. Add missing fields to the `_collections` table JSON
 * 2. Add missing columns to the `users` SQLite table
 * 
 * Run this with PocketBase stopped.
 */
import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

function addColumn(table, colName, colType, defaultValue) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === colName)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colType} DEFAULT ${defaultValue}`).run();
    console.log(`  + ${table}.${colName}`);
  }
}

// ---- Step 1: Update _collections JSON for users ----
const row = db.prepare(`SELECT id, fields, name FROM _collections WHERE name = 'users'`).get();
if (!row) {
  console.error('users collection not found in _collections!');
  process.exit(1);
}
console.log('Found users collection (id=' + row.id + ')');
console.log('Current fields:', row.fields.substring(0, 200) + '...');

let fields = JSON.parse(row.fields);

// Helper to add a field definition
function ensureField(name, type, opts = {}) {
  if (fields.some(f => f.name === name)) {
    console.log(`  Field "${name}" already exists`);
    return;
  }
  const field = { name, type, ...opts };
  // Default options based on type
  if (type === 'text') {
    field.min = opts.min ?? null;
    field.max = opts.max ?? null;
    field.pattern = opts.pattern ?? '';
  } else if (type === 'number') {
    field.min = opts.min ?? null;
    field.max = opts.max ?? null;
    field.noDecimal = opts.noDecimal ?? false;
  } else if (type === 'date') {
    field.min = opts.min ?? '';
    field.max = opts.max ?? '';
  } else if (type === 'bool') {
    // no extra options
  }
  fields.push(field);
  console.log(`  + Field "${name}" (${type})`);
}

// Add missing fields
ensureField('points', 'number', { noDecimal: true, min: 0 });
ensureField('theme', 'text', { max: 50 });
ensureField('status', 'text', { max: 50 });
ensureField('role', 'text', { max: 50 });
ensureField('blockedUntil', 'date');
ensureField('blacklistReason', 'text', { max: 500 });
ensureField('membership', 'text', { max: 50 });
ensureField('membershipExpiresAt', 'date');
ensureField('aiDailyCapOverride', 'number', { noDecimal: true, min: 0 });
ensureField('aiAgentReactivatesAt', 'date');
ensureField('aiCapPlanId', 'text', { max: 100 });
ensureField('emailVerified', 'date');
ensureField('image', 'text', { max: 500 });

// Update the _collections table
const updatedFields = JSON.stringify(fields);
db.prepare(`UPDATE _collections SET fields = ? WHERE name = 'users'`).run(updatedFields);
console.log('\nUpdated _collections.fields for users');

// ---- Step 2: Add SQLite columns ----
console.log('\nAdding SQLite columns to users table:');
addColumn('users', 'points', 'NUMERIC', '50');
addColumn('users', 'theme', 'TEXT', "'dark'");
addColumn('users', 'status', 'TEXT', "'active'");
addColumn('users', 'role', 'TEXT', "'user'");
addColumn('users', 'blockedUntil', 'TEXT', "''");
addColumn('users', 'blacklistReason', 'TEXT', "''");
addColumn('users', 'membership', 'TEXT', "'free'");
addColumn('users', 'membershipExpiresAt', 'TEXT', "''");
addColumn('users', 'aiDailyCapOverride', 'INTEGER', 'NULL');
addColumn('users', 'aiAgentReactivatesAt', 'TEXT', "''");
addColumn('users', 'aiCapPlanId', 'TEXT', "''");
addColumn('users', 'emailVerified', 'TEXT', "''");
addColumn('users', 'image', 'TEXT', "''");

console.log('\nDone! Users collection fixed.');
db.close();
