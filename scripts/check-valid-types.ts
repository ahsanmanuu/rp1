import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Try creating a temp collection with various field types
  const testFields = [
    { type: 'text', name: 'f_text' },
    { type: 'number', name: 'f_number' },
    { type: 'bool', name: 'f_bool' },
    { type: 'json', name: 'f_json' },
    { type: 'email', name: 'f_email' },
    { type: 'url', name: 'f_url' },
    { type: 'date', name: 'f_date' },
    { type: 'autodate', name: 'f_autodate' },
    { type: 'select', name: 'f_select', options: { values: ['a', 'b'] } },
    { type: 'file', name: 'f_file' },
    { type: 'relation', name: 'f_rel' },
  ];

  // Create test collection
  let created: any;
  try {
    created = await pb.send('/api/collections', {
      method: 'POST',
      body: { name: 'test_field_types', type: 'base', fields: testFields },
    });
    console.log('Collections with all types created!');
    console.log('Actual fields:', created.fields?.map((f: any) => `${f.name}(${f.type})`));

    // Clean up
    await pb.send('/api/collections/test_field_types', { method: 'DELETE' });
    console.log('Test collection deleted');
  } catch (e: any) {
    console.log('Create failed:', e.response?.message || e.message);
    if (e.response?.data) {
      const data = e.response.data;
      const failingFields = Object.keys(data).filter(k => k.startsWith('f_') || k === 'fields');
      console.log('Failing fields:', failingFields);
      for (const k of failingFields) {
        console.log(`  ${k}: ${JSON.stringify(data[k])}`);
      }
    }
  }
}

main().catch(console.error);
