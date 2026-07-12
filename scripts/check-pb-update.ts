import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Read announcements collection
  const col = await pb.collections.getOne('pbc_3866499052');
  console.log('Before update, schema fields:', (col as any).schema?.map((f:any) => f.name));

  // Try updating with just one field
  const result = await pb.collections.update('pbc_3866499052', {
    schema: [...((col as any).schema || []), { name: 'test_field_xyz', type: 'text' }],
  });
  console.log('Update result status:', result ? 'success' : 'fail');
  console.log('Updated schema fields:', (result as any).schema?.map((f:any) => f.name));

  // Read again to verify
  const col2 = await pb.collections.getOne('pbc_3866499052');
  console.log('Re-read schema fields:', (col2 as any).schema?.map((f:any) => f.name));

  // Remove the test field
  const schema2 = (col2 as any).schema?.filter((f:any) => f.name !== 'test_field_xyz') || [];
  await pb.collections.update('pbc_3866499052', { schema: schema2 });
  console.log('Removed test field, final schema:', schema2.map((f:any) => f.name));
}

main().catch(console.error);
