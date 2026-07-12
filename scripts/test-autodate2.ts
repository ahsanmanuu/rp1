import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function test(field: any) {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const col = await pb.send('/api/collections/announcements', { method: 'GET' });
  const fields = [...(col.fields || [])];

  try {
    const r = await pb.send('/api/collections/announcements', {
      method: 'PATCH',
      body: { fields: [...fields, field] },
    });
    console.log(`OK: ${field.name} (${JSON.stringify(field.options)})`);
    const r2 = await pb.send('/api/collections/announcements', { method: 'GET' });
    const cleaned = r2.fields?.filter((f: any) => f.name !== field.name) || [];
    await pb.send('/api/collections/announcements', { method: 'PATCH', body: { fields: cleaned } });
  } catch (e: any) {
    console.log(`FAIL: ${JSON.stringify(field)}`, JSON.stringify(e.response?.data));
  }
}

// Try various formats
const tests = [
  { name: 't1', type: 'autodate', options: { 'onCreate': true, 'onUpdate': false } },
  { name: 't2', type: 'autodate', options: { 'onCreate': true } },
  { name: 't3', type: 'autodate', 'onCreate': true },
  { name: 't4', type: 'autodate' },
  { name: 't5', type: 'date' },
  { name: 't6', type: 'date', options: {} },
];

for (const t of tests) {
  await test(t);
}
