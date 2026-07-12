import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const col = all.find(c => c.name === 'user_sessions');
console.log('Before - fields:', col.fields.map(f => f.name + ':' + f.type));

// Add testField
const newField = { name: 'testField', type: 'text' };
const updatedSchema = [...col.fields, newField];

try {
  const response = await pb.collections.update(col.id, { schema: updatedSchema }, { requestKey: 'test_add' });
  console.log('Response fields:', response.fields.map(f => f.name + ':' + f.type));
} catch (e) {
  console.log('Error:', e.message, JSON.stringify(e?.response?.data));
}

// Verify
const verify = await pb.collections.getOne(col.id, { requestKey: 'verify' });
console.log('After - fields:', verify.fields.map(f => f.name + ':' + f.type).join(', '));
