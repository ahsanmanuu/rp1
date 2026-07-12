import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Get raw response via the SDK's built-in fetch
  const raw = await pb.send('/api/collections/announcements', { method: 'GET' });
  console.log('Raw collection keys:', Object.keys(raw));
  console.log('Schema:', JSON.stringify(raw.schema?.map((f: any) => ({ name: f.name, type: f.type }))));

  // Also check the Schema field type
  if (raw.schema && raw.schema.length > 0) {
    console.log('First field keys:', Object.keys(raw.schema[0]));
  }
}

main().catch(console.error);
