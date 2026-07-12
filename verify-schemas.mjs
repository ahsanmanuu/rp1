import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const check = ['ai_usage_logs', 'projects', 'platform_stats', 'feature_flags', 
  'admin_tasks', 'support_tickets', 'paper_reviews', 'admin_users',
  'user_sessions', 'point_transactions'];

for (const name of check) {
  const col = all.find(c => c.name === name);
  if (col) {
    const fields = col.fields.map(f => f.name + ':' + f.type);
    console.log(name, '->', fields.join(', '));
  } else {
    console.log(name, '-> NOT FOUND');
  }
}

// Test a date filter
console.log('\nTesting date filter...');
try {
  const result = await pb.collection('user_sessions').getList(1, 1, {
    filter: 'createdAt >= "2026-01-01 00:00:00.000Z"',
    requestKey: 'verify_date'
  });
  console.log('Date filter OK, items:', result.totalItems);
} catch (e) {
  console.log('Date filter FAIL:', e.message);
}
