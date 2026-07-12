import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function testField(field: any) {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const col = await pb.send('/api/collections/announcements', { method: 'GET' });
  const existing = [...(col.fields || [])];

  try {
    const result = await pb.send('/api/collections/announcements', {
      method: 'PATCH',
      body: { fields: [...existing, field] },
    });
    console.log(`OK: ${JSON.stringify(field)}`);

    // Cleanup
    const cleaned = result.fields?.filter((f: any) => f.name !== field.name) || [];
    await pb.send('/api/collections/announcements', {
      method: 'PATCH',
      body: { fields: cleaned },
    });
  } catch (e: any) {
    console.log(`FAIL: ${JSON.stringify(field)} -> ${e.response?.message}`);
  }
}

const variants = [
  { name: 'testAuto', type: 'autodate' },
  { name: 'testAuto', type: 'autodate', options: { noTime: false } },
  { name: 'testAuto', type: 'autodate', options: {} },
  { name: 'testAuto', type: 'autodate', options: { onCreate: true, onUpdate: false } },
  { name: 'testAuto', type: 'autodate', options: { onCreate: false, onUpdate: true } },
  { name: 'testAuto', type: 'autodate', required: false },
  { name: 'testAuto', type: 'autodate', required: true },
];

for (const v of variants) {
  await testField(v);
}
