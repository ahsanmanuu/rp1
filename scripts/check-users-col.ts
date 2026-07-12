import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const usersCol = await pb.send('/api/collections/users', { method: 'GET' });
  console.log('Users collection full:', JSON.stringify(usersCol, null, 2));
}

main().catch(console.error);
