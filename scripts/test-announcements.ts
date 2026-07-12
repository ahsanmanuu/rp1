import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Add each field one at a time, logging errors in detail
  const announcementsFields = [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'priority', type: 'text' },
    { name: 'isActive', type: 'bool' },
  ];

  const col = await pb.send('/api/collections/announcements', { method: 'GET' });
  let fields = [...(col.fields || [])];
  const existing = new Set(fields.map((f: any) => f.name));

  for (const f of announcementsFields) {
    if (existing.has(f.name)) continue;
    try {
      const r = await pb.send('/api/collections/announcements', {
        method: 'PATCH',
        body: { fields: [...fields, f] },
      });
      console.log(`OK: ${f.name}`);
      fields = r.fields || [];
      existing.add(f.name);
    } catch (e: any) {
      console.log(`FAIL: ${f.name}`);
      console.log('  Full response:', JSON.stringify(e.response?.data, null, 2));
      break;
    }
  }

  // Now try autodate fields
  const autoFields = [
    { name: 'startsAt', type: 'autodate', onCreate: true },
    { name: 'endsAt', type: 'autodate', onCreate: false, onUpdate: false },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ];

  for (const f of autoFields) {
    if (existing.has(f.name)) continue;
    try {
      const r = await pb.send('/api/collections/announcements', {
        method: 'PATCH',
        body: { fields: [...fields, f] },
      });
      console.log(`OK: ${f.name} with ${JSON.stringify(Object.keys(f).filter(k=>k!=='name'&&k!=='type'))}`);
      fields = r.fields || [];
      existing.add(f.name);
    } catch (e: any) {
      console.log(`FAIL: ${f.name} -> ${JSON.stringify(e.response?.data)}`);
      break;
    }
  }
}

main().catch(console.error);
