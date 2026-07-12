import Database from 'better-sqlite3';
import { COLLECTIONS } from './scripts/setup-pocketbase.ts';

const db = new Database('./pb_data/data.db');

function fieldId(type) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function convertTo027Fields(schema) {
  return schema.map(f => {
    const base = {
      id: fieldId(f.type),
      name: f.name,
      type: f.type,
      system: false,
      required: f.required || false,
      presentable: false,
      hidden: false,
      options: {}
    };

    if (f.options) {
      base.options = { ...f.options };
    }

    // Default options per type if missing
    if (f.type === 'text') {
      base.options = { max: null, min: null, pattern: "", ...base.options };
    } else if (f.type === 'number') {
      base.options = { max: null, min: null, onlyInt: false, ...base.options };
    } else if (f.type === 'bool') {
      // no options
    } else if (f.type === 'date') {
      base.options = { max: "", min: "", ...base.options };
    } else if (f.type === 'email') {
      base.options = { exceptDomains: null, onlyDomains: null, ...base.options };
    } else if (f.type === 'url') {
      base.options = { exceptDomains: null, onlyDomains: null, ...base.options };
    } else if (f.type === 'select') {
      base.options = { maxSelect: 1, values: f.options?.values || [], ...base.options };
    } else if (f.type === 'json') {
      base.options = { maxSize: 2000000, ...base.options };
    } else if (f.type === 'file') {
      base.options = { maxSelect: 1, maxSize: 5242880, mimeTypes: [], thumbs: [], ...base.options };
    } else if (f.type === 'relation') {
      base.options = { 
        collectionId: f.options?.collectionId || "", 
        cascadeDelete: f.options?.cascadeDelete || false,
        maxSelect: 1, 
        minSelect: 0,
        ...base.options 
      };
    }

    return base;
  });
}

for (const def of COLLECTIONS) {
  const row = db.prepare("SELECT * FROM _collections WHERE name = ?").get(def.name);
  if (row) {
    const newFields = convertTo027Fields(def.schema);
    
    // Check if fields are empty or missing custom fields
    const currentFields = JSON.parse(row.fields || '[]');
    const customFields = currentFields.filter(f => !f.system);
    
    if (customFields.length === 0 || def.name === 'users') {
      console.log(`Fixing schema for ${def.name}...`);
      const allFields = [...currentFields.filter(f => f.system), ...newFields];
      db.prepare("UPDATE _collections SET fields = ? WHERE name = ?").run(JSON.stringify(allFields), def.name);
    }
  }
}

// Also fix users collection
const usersDef = COLLECTIONS.find(c => c.name === 'users');
if (usersDef) {
  const usersRow = db.prepare("SELECT * FROM _collections WHERE name = 'users'").get();
  if (usersRow) {
    const newFields = convertTo027Fields(usersDef.schema);
    const currentFields = JSON.parse(usersRow.fields || '[]');
    const allFields = [...currentFields.filter(f => f.system), ...newFields];
    db.prepare("UPDATE _collections SET fields = ? WHERE name = 'users'").run(JSON.stringify(allFields));
  }
}

console.log("All schemas fixed!");
