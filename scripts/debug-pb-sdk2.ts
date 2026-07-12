import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Get raw response via the SDK's built-in fetch
  const raw = await pb.send('/api/collections/announcements', { method: 'GET' });
  console.log('Fields:', JSON.stringify(raw.fields?.map((f: any) => ({ name: f.name, type: f.type, system: f.system }))));

  // Try to add fields using 'fields' key
  const existing = raw.fields || [];
  const existingNames = new Set(existing.map((f: any) => f.name));

  const newFields = [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'priority', type: 'text' },
    { name: 'startsAt', type: 'autodate', options: { noTime: false } },
    { name: 'endsAt', type: 'autodate', options: { noTime: false } },
    { name: 'isActive', type: 'bool' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ];

  const toAdd = newFields.filter(f => !existingNames.has(f.name));
  console.log('Fields to add:', toAdd.map(f => f.name));

  if (toAdd.length > 0) {
    const updateResult = await pb.send('/api/collections/announcements', {
      method: 'PATCH',
      body: { fields: [...existing, ...toAdd] },
    });
    console.log('Update result fields:', updateResult.fields?.map((f: any) => f.name));
  }

  // Verify again
  const verify = await pb.send('/api/collections/announcements', { method: 'GET' });
  console.log('After update, fields:', verify.fields?.map((f: any) => f.name));

  // Also test a query
  const q = await pb.send('/api/collections/announcements/records', { method: 'GET' });
  console.log('Query result:', JSON.stringify(q));
}

main().catch(console.error);
