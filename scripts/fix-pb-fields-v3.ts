import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

const FIELDS_TO_TRY: any[] = [
  { name: 'title', type: 'text', required: true },
  { name: 'content', type: 'text', required: true },
  { name: 'priority', type: 'text' },
  { name: 'startsAt', type: 'autodate', options: { noTime: false } },
  { name: 'endsAt', type: 'autodate', options: { noTime: false } },
  { name: 'isActive', type: 'bool' },
  { name: 'createdAt', type: 'autodate', options: { noTime: false } },
  { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  { name: 'name', type: 'text', required: true },
  { name: 'description', type: 'text' },
  { name: 'defaultDailyTokenLimit', type: 'number' },
  { name: 'maxDailyTokenLimit', type: 'number' },
  { name: 'userId', type: 'text', required: true },
  { name: 'sessionToken', type: 'text', required: true },
  { name: 'expires', type: 'autodate', options: { noTime: false } },
  { name: 'date', type: 'text' },
  { name: 'totalTokens', type: 'number' },
  { name: 'requestCount', type: 'number' },
  { name: 'agentBreakdown', type: 'json' },
  { name: 'type', type: 'text' },
  { name: 'points', type: 'number' },
  { name: 'referenceId', type: 'text' },
  { name: 'title', type: 'text' }, // dup for notifications
  { name: 'message', type: 'text' },
  { name: 'isRead', type: 'bool' },
  { name: 'link', type: 'text' },
  { name: 'matchType', type: 'text', required: true },
  { name: 'matchValue', type: 'text', required: true },
  { name: 'capType', type: 'text', required: true },
  { name: 'dailyTokenLimit', type: 'number' },
  { name: 'dailyRequestLimit', type: 'number' },
  { name: 'blockDuration', type: 'number' },
  { name: 'priority', type: 'number', required: true },
  { name: 'createdBy', type: 'text' },
];

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Get current fields
  const col = await pb.send('/api/collections/announcements', { method: 'GET' });
  let existingFields = [...(col.fields || [])];
  const existingNames = new Set(existingFields.map((f: any) => f.name));

  for (const field of FIELDS_TO_TRY) {
    if (existingNames.has(field.name)) continue;

    try {
      const result = await pb.send('/api/collections/announcements', {
        method: 'PATCH',
        body: { fields: [...existingFields, field] },
      });
      console.log(`  OK: ${field.name} (${field.type})`);
      existingFields = result.fields || [];
      existingNames.add(field.name);
    } catch (e: any) {
      console.log(`  FAIL: ${field.name} (${field.type}) -> ${e.response?.message || e.message}`);
      // Roll back any that were added
      break;
    }
  }

  // Cleanup - remove all non-system fields
  const systemOnly = existingFields.filter((f: any) => f.system || f.name === 'id');
  await pb.send('/api/collections/announcements', {
    method: 'PATCH',
    body: { fields: systemOnly },
  });
  console.log('Cleaned up test fields');
}

main().catch(console.error);
