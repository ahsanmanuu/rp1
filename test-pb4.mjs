import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
const authData = await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const collectionsData = await pb.collections.getFullList({ requestKey: 'all' });

const targetCollections = [
  'announcements', 'platform_stats', 'feature_flags', 
  'ai_usage_logs', 'user_sessions', 'admin_tasks',
  'support_tickets', 'admin_users', 'admin_notifications',
  'users', 'projects', 'paper_reviews',
  'point_transactions', 'membership_transactions'
];

for (const name of targetCollections) {
  const col = collectionsData.find(c => c.name === name);
  if (!col) {
    console.log(name, '-> NOT FOUND');
    continue;
  }
  const fields = col.fields || [];
  const fieldNames = fields.map(f => f.name + ':' + f.type);
  console.log(name, '->', fieldNames.join(', '));
}
