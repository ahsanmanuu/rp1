import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Try to delete and recreate a collection
// Let's test with a temporary collection
const testSchema = [
  { name: 'name', type: 'text', required: true, system: false },
  { name: 'count', type: 'number', required: false, system: false, onlyInt: true },
];

try {
  const created = await pb.collections.create({
    name: 'test_collection_pb27',
    type: 'base',
    schema: testSchema,
  }, { requestKey: 'create_test' });
  console.log('Created:', created.name, 'id:', created.id);
  console.log('Fields:', created.fields.map(f => f.name + ':' + f.type));
  
  // Now try to update
  const newSchema = [...created.fields, { name: 'extraField', type: 'text', system: false }];
  const updated = await pb.collections.update(created.id, { schema: newSchema }, { requestKey: 'update_test' });
  console.log('After update fields:', updated.fields.map(f => f.name + ':' + f.type));
  
  // Verify from fresh
  const verify = await pb.collections.getOne(created.id, { requestKey: 'verify_test' });
  console.log('Verified fields:', verify.fields.map(f => f.name + ':' + f.type));
  
  // Clean up
  await pb.collections.delete(created.id, { requestKey: 'delete_test' });
  console.log('Deleted test collection');
} catch (e) {
  console.log('Error:', e.message);
  if (e.response?.data) console.log('Details:', JSON.stringify(e.response.data));
}
