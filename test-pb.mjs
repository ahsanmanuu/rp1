import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
const authData = await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
console.log('Auth OK');

async function test(collection, filter, label) {
  try {
    const result = await pb.collection(collection).getList(1, 1, {
      filter: filter,
      requestKey: 'test_' + collection
    });
    console.log(label + ' total:', result.totalItems);
  } catch (e) {
    console.error(label + ' error:', e.message, JSON.stringify(e?.response?.data));
  }
}

// Test queries
await test('admin_users', '', 'admin_users');
await test('announcements', '', 'announcements');
await test('platform_stats', '', 'platform_stats');
await test('feature_flags', '', 'feature_flags');
await test('user_sessions', '', 'user_sessions');

// Test with date filter (the format the adapter uses)
try {
  const result = await pb.collection('user_sessions').getList(1, 1, {
    filter: 'expiresAt >= "2026-01-01 00:00:00.000Z"',
    requestKey: 'test_sessions_dt'
  });
  console.log('user_sessions (ISO date) total:', result.totalItems);
} catch (e) {
  console.error('user_sessions (ISO date) error:', e.message, JSON.stringify(e?.response?.data));
}
