import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Test date filter on `expires` (regular date field)
// First create a record with expires set
await pb.collection('user_sessions').create({
  userId: 'test_user2',
  sessionToken: 'test_expires_' + Date.now(),
  machineId: 'test',
  expires: new Date(Date.now() + 86400000).toISOString().replace('T', ' '),
  expiresAt: new Date(Date.now() + 86400000).toISOString().replace('T', ' '),
}, { requestKey: 'create_test2' });

const tests = [
  'expires >= "2026-01-01 00:00:00.000Z"',
  'expires != ""',
  'expires != null',
  'createdAt > "2026-01-01 00:00:00"',
  'createdAt > "2026-01-01"',
  'createdAt >= "2026-07-08 00:00:00.000Z"',
  // Use @now macro
  'createdAt <= @now',
];

for (const filter of tests) {
  try {
    const result = await pb.collection('user_sessions').getList(1, 5, {
      filter,
      requestKey: 't_' + Date.now()
    });
    console.log('OK:', filter, '-> total=' + result.totalItems);
  } catch (e) {
    console.log('FAIL:', filter, '->', e.message);
  }
}

// Get all records to see what fields exist
const all = await pb.collection('user_sessions').getFullList({ requestKey: 'all_records' });
console.log('\nAll records fields:');
for (const r of all) {
  console.log('  id:', r.id, 'expires:', r.expires, 'expiresAt:', r.expiresAt, 'createdAt:', r.createdAt);
}
