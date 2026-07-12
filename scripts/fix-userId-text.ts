import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const col = await pb.send('/api/collections/ai_usage_daily_summaries', { method: 'GET' });
  const existing = col.fields || [];
  if (existing.some((f: any) => f.name === 'userId')) {
    console.log('userId already exists');
    return;
  }

  // Add userId as text instead of relation (simpler, works for string-based lookups)
  const newField = { name: 'userId', type: 'text', required: false };

  try {
    await pb.send('/api/collections/ai_usage_daily_summaries', {
      method: 'PATCH',
      body: { fields: [...existing, newField] },
    });
    console.log('SUCCESS: added userId as text');
  } catch (e: any) {
    console.log('FAIL:', JSON.stringify(e.response?.data));
  }
}

main().catch(console.error);
