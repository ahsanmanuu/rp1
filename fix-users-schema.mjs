/**
 * Add missing fields to the PocketBase `users` auth collection.
 * Stop PocketBase before running this.
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

// ── Read current users schema ──
const row = db.prepare("SELECT id, fields FROM _collections WHERE name = 'users'").get();
if (!row) { console.error('users collection not found!'); process.exit(1); }

const existing = JSON.parse(row.fields);
console.log('Existing fields:', existing.length);
console.log('Existing names:', existing.map(f => f.name).join(', '));

// ── Generate deterministic field ID based on type + name (like PocketBase does) ──
function genId(type, name) {
  const prefix = type === 'autodate' ? 'autodate' :
    type === 'date' ? 'date' :
    type === 'bool' ? 'bool' :
    type === 'number' ? 'number' :
    type === 'email' ? 'email' :
    type === 'file' ? 'file' : 'text';
  // Use a hash of name to produce consistent IDs
  const hash = crypto.createHash('md5').update(name).digest('hex').substring(0, 10);
  const num = parseInt(hash, 16) % 9000000000 + 1000000000;
  return prefix + num;
}

function textField(name, opts = {}) {
  return {
    autogeneratePattern: "", hidden: false, id: genId('text', name),
    max: opts.max ?? 0, min: opts.min ?? 0, name, pattern: opts.pattern ?? "",
    presentable: false, primaryKey: false, required: false, system: false,
    type: "text", ...opts
  };
}

function numberField(name, opts = {}) {
  return {
    hidden: false, id: genId('number', name),
    max: opts.max ?? null, min: opts.min ?? null, name,
    onlyInt: opts.onlyInt ?? false,
    presentable: false, required: false, system: false, type: "number",
    ...opts
  };
}

function boolField(name, opts = {}) {
  return {
    hidden: false, id: genId('bool', name), name,
    presentable: false, required: false, system: false, type: "bool",
    ...opts
  };
}

function dateField(name, opts = {}) {
  return {
    hidden: false, id: genId('date', name),
    max: opts.max ?? "", min: opts.min ?? "", name,
    presentable: false, required: false, system: false, type: "date",
    ...opts
  };
}

// ── Fields to add ──
const newFields = [
  numberField("points", { onlyInt: true, min: 0 }),
  textField("theme", { max: 50 }),
  textField("status", { max: 50 }),
  textField("role", { max: 50 }),
  dateField("blockedUntil"),
  textField("blacklistReason", { max: 500 }),
  textField("membership", { max: 50 }),
  dateField("membershipExpiresAt"),
  numberField("aiDailyCapOverride", { onlyInt: true, min: 0 }),
  dateField("aiAgentReactivatesAt"),
  textField("aiCapPlanId", { max: 100 }),
  dateField("emailVerified"),
  textField("image", { max: 500 }),
];

// Add only fields that don't already exist
const existingNames = new Set(existing.map(f => f.name));
const toAdd = newFields.filter(f => !existingNames.has(f.name));
console.log('\nFields to add:', toAdd.length, toAdd.map(f => f.name).join(', '));

if (toAdd.length === 0) {
  console.log('No new fields needed.');
} else {
  const updated = [...existing, ...toAdd];
  db.prepare("UPDATE _collections SET fields = ? WHERE name = 'users'").run(JSON.stringify(updated));
  console.log('Updated _collections.fields');
}

// ── Add SQLite columns ──
function addCol(table, name, type, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === name)) {
    console.log(`  Column ${name} already exists`);
    return;
  }
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type} DEFAULT ${def}`).run();
  console.log(`  + Column ${name} (${type})`);
}

console.log('\nAdding SQLite columns:');
addCol('users', 'points', 'NUMERIC', '50');
addCol('users', 'theme', 'TEXT', "'dark'");
addCol('users', 'status', 'TEXT', "'active'");
addCol('users', 'role', 'TEXT', "'user'");
addCol('users', 'blockedUntil', 'TEXT', "''");
addCol('users', 'blacklistReason', 'TEXT', "''");
addCol('users', 'membership', 'TEXT', "'free'");
addCol('users', 'membershipExpiresAt', 'TEXT', "''");
addCol('users', 'aiDailyCapOverride', 'INTEGER', 'NULL');
addCol('users', 'aiAgentReactivatesAt', 'TEXT', "''");
addCol('users', 'aiCapPlanId', 'TEXT', "''");
addCol('users', 'emailVerified', 'TEXT', "''");
addCol('users', 'image', 'TEXT', "''");

console.log('\nDone!');
db.close();
