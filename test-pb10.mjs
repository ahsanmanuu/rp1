import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const checkCols = ['user_sessions', 'ai_usage_logs', 'projects', 'platform_stats'];

for (const name of checkCols) {
  const col = all.find(c => c.name === name);
  if (col) {
    const fields = col.fields.map(f => f.name + ':' + f.type);
    console.log(name, '->', fields.join(', '));
  }
}
