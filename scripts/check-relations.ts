import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Look at a collection that already has relations - e.g. projects
  const projects = await pb.send('/api/collections/projects', { method: 'GET' });
  const relFields = projects.fields?.filter((f: any) => f.type === 'relation');
  for (const f of relFields) {
    console.log('Projects field:', f.name, '-> options:', JSON.stringify(f.options));
  }

  // Also try creating a relation field with explicit JSON string
  const summaryCol = await pb.send('/api/collections/ai_usage_daily_summaries', { method: 'GET' });
  const existingFields = summaryCol.fields || [];
  const existingNames = new Set(existingFields.map((f: any) => f.name));

  if (existingNames.has('userId')) {
    console.log('userId already exists');
    return;
  }

  const payload = {
    fields: [...existingFields, {
      name: 'userId',
      type: 'relation',
      required: false,
      options: JSON.parse(`{"collectionId":"_pb_users_auth_","maxSelect":1}`),
    }],
  };

  console.log('Payload:', JSON.stringify(payload, null, 2).slice(0, 500));

  try {
    const r = await pb.send('/api/collections/ai_usage_daily_summaries', {
      method: 'PATCH',
      body: payload,
    });
    console.log('SUCCESS!');
  } catch (e: any) {
    console.log('FAIL:', JSON.stringify(e.response?.data));
  }
}

main().catch(console.error);
