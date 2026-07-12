import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const users = all.find(c => c.name === 'users');
if (users) {
  console.log('Users collection schema fields:');
  for (const f of users.fields) {
    console.log(`  ${f.name}: ${f.type}${f.required ? ' [required]' : ''}${f.options ? ' ' + JSON.stringify(f.options) : ''}`);
  }
}
