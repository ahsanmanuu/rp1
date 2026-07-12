import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Test filter on existing vs new collections
const tests = [
  { col: 'announcements', filter: 'isActive = true' },
  { col: 'announcements', filter: 'priority = "info"' },
  { col: 'users', filter: 'email != ""' },
  { col: 'users', filter: 'email != null' },
  { col: 'point_transactions', filter: 'type = "recharge"' },
  { col: 'point_transactions', filter: 'userId != ""' },
  { col: 'membership_transactions', filter: 'userId != ""' },
  { col: 'membership_transactions', filter: 'id != ""' },
  { col: 'ai_usage_logs', filter: 'userId != ""' },
  { col: 'ai_usage_logs', filter: 'id != ""' },
];

for (const { col, filter } of tests) {
  try {
    const result = await pb.collection(col).getList(1, 5, {
      filter,
      requestKey: 'test_' + Date.now()
    });
    console.log('OK:', col, '-', filter, '->', result.totalItems);
  } catch (e) {
    console.log('FAIL:', col, '-', filter, '->', e.message.substring(0, 80));
  }
}
