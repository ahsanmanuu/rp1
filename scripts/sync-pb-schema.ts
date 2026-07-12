import PocketBase from 'pocketbase';
import { COLLECTIONS, CollectionDef, FieldDef } from './setup-pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';

async function syncSchemas() {
  const pb = new PocketBase(PB_URL);
  
  console.log('Authenticating as admin...');
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  console.log('Fetching existing collections...');
  const existingCols = await pb.collections.getFullList();

  const usersCol = existingCols.find(c => c.name === 'users');
  const usersCollectionId = usersCol ? usersCol.id : '';

  let totalUpdated = 0;
  
  for (const def of COLLECTIONS) {
    const colName = def.name;
    const existingCol = existingCols.find(c => c.name === colName);
    
    if (!existingCol) {
      console.log(`[${colName}] Collection not found in DB. Run setup-pocketbase.ts to create it.`);
      continue;
    }

    // Map setup-pocketbase.ts schema to PocketBase 0.27 fields array
    const desiredFields = def.schema.map((f: FieldDef) => {
      const field: any = { 
        name: f.name, 
        type: f.type, 
        required: f.required || false, 
        unique: f.unique || false 
      };
      
      if (f.options) {
        let collId = f.options.collectionId;
        if (collId === '_pb_users_collection_') {
          collId = usersCollectionId;
        } else if (collId) {
          // Check if it's a collection name, resolve to ID
          const targetCol = existingCols.find(c => c.name === collId);
          if (targetCol) {
            collId = targetCol.id;
          }
          // If not found, assume collId is already a valid ID.
        }
        
        // Copy all options to root
        for (const [key, value] of Object.entries(f.options)) {
          if (key === 'collectionId') {
            field[key] = collId;
          } else {
            field[key] = value;
          }
        }
      }
      
      // Auto-date defaults if not specified
      if (f.type === 'autodate') {
        if (f.name === 'createdAt') {
          if (field.onCreate === undefined) field.onCreate = true;
          if (field.onUpdate === undefined) field.onUpdate = false;
        } else if (f.name === 'updatedAt') {
          if (field.onCreate === undefined) field.onCreate = false;
          if (field.onUpdate === undefined) field.onUpdate = true;
        }
      }
      
      return field;
    });

    const existingFields = existingCol.fields || [];
    
    const newFieldsArray = [];
    
    // Always keep 'id' field
    const idField = existingFields.find((f: any) => f.name === 'id' && f.system);
    if (idField) newFieldsArray.push(idField);
    
    // Automatically add created and updated to every collection
    if (!desiredFields.some((f: any) => f.name === 'created')) {
      newFieldsArray.push({
        name: 'created',
        type: 'autodate',
        onCreate: true,
        onUpdate: false,
        system: false,
        hidden: false,
        presentable: false
      });
    }
    
    if (!desiredFields.some((f: any) => f.name === 'updated')) {
      newFieldsArray.push({
        name: 'updated',
        type: 'autodate',
        onCreate: true,
        onUpdate: true,
        system: false,
        hidden: false,
        presentable: false
      });
    }

    let changed = false;

    for (const desired of desiredFields) {
      const existing = existingFields.find((f: any) => f.name === desired.name);
      if (existing) {
        if (existing.type !== desired.type) {
          // Type changed! Drop the ID so PocketBase recreates it (data loss for this column, but schema is fixed)
          newFieldsArray.push(desired);
          changed = true;
          console.log(`[${colName}] Field '${desired.name}' type changed: ${existing.type} -> ${desired.type} (recreating)`);
        } else {
          // Keep the ID to preserve data!
          newFieldsArray.push({
            ...desired,
            id: existing.id
          });
        }
      } else {
        // New field
        newFieldsArray.push(desired);
        changed = true;
        console.log(`[${colName}] Added new field: ${desired.name}`);
      }
    }
    
    // Find removed fields
    const desiredNames = new Set(desiredFields.map((f: any) => f.name));
    for (const existing of existingFields) {
      if (!existing.system && !desiredNames.has(existing.name)) {
        console.log(`[${colName}] Removing obsolete field: ${existing.name}`);
        changed = true;
        // Not pushing it to newFieldsArray removes it!
      }
    }

    if (changed || existingFields.length !== newFieldsArray.length) {
      try {
        await pb.collections.update(existingCol.id, { fields: newFieldsArray });
        console.log(`[${colName}] Successfully synced fields.`);
        totalUpdated++;
      } catch (err: any) {
        console.error(`[${colName}] FAILED to sync fields:`, err.response?.data || err.message);
      }
    } else {
      console.log(`[${colName}] Schema is already in sync.`);
    }
  }
  
  console.log(`\nDone! Synced ${totalUpdated} collections.`);
}

syncSchemas().catch(console.error);
