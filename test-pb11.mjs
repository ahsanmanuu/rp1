import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const col = all.find(c => c.name === 'user_sessions');

// Try adding machineId field manually with minimal options
async function addField(collectionId, fieldDef) {
  try {
    const updatedFields = [
      ...(col.fields || []),
      fieldDef
    ];
    await pb.collections.update(collectionId, { schema: updatedFields }, { requestKey: 'add_' + fieldDef.name });
    console.log('ADDED:', fieldDef.name, fieldDef.type);
    return true;
  } catch (e) {
    console.log('FAILED:', fieldDef.name, fieldDef.type, '-', e.message, JSON.stringify(e?.response?.data));
    return false;
  }
}

// Test various field types
const testFields = [
  { name: 'machineId', type: 'text' },
  { name: 'ipAddress', type: 'text' },
  { name: 'location', type: 'text' },
  { name: 'userAgent', type: 'text' },
  { name: 'expiresAt', type: 'date' },
  { name: 'updatedAt', type: 'autodate', onCreate: true, onUpdate: true },
];

for (const f of testFields) {
  await addField(col.id, f);
}

// Verify
const updated = await pb.collections.getOne(col.id, { requestKey: 'verify' });
console.log('\nFinal fields:', updated.fields.map(f => f.name + ':' + f.type).join(', '));
