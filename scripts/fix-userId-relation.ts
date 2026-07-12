import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const summaryCol = await pb.send('/api/collections/ai_usage_daily_summaries', { method: 'GET' });
  const existingFields = summaryCol.fields || [];
  const existingNames = new Set(existingFields.map((f: any) => f.name));

  if (existingNames.has('userId')) {
    console.log('userId already exists in ai_usage_daily_summaries');
    return;
  }

  // Get the actual users collection info
  const allCols = await pb.send('/api/collections', { method: 'GET' });
  const usersCol = allCols.items?.find((c: any) => c.name === 'users');
  console.log('Users collection:', usersCol?.id, usersCol?.name);

  if (!usersCol) {
    console.log('Users collection not found!');
    return;
  }

  const relationField = {
    name: 'userId',
    type: 'relation',
    required: false,
    options: {
      collectionId: usersCol.id,
      cascadeDelete: true,
      maxSelect: 1,
    },
  };

  try {
    const r = await pb.send('/api/collections/ai_usage_daily_summaries', {
      method: 'PATCH',
      body: { fields: [...existingFields, relationField] },
    });
    console.log('SUCCESS adding userId relation');
    console.log('Fields:', r.fields?.map((f: any) => f.name));
  } catch (e: any) {
    console.log('FAILED:', e.response?.message);
    console.log('Detail:', JSON.stringify(e.response?.data, null, 2));
  }
}

main().catch(console.error);
