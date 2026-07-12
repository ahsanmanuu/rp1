import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
console.log('Auth OK');

// Test different date formats for PocketBase filters
const formats = [
  { label: 'ISO T', val: 'expiresAt >= "2026-01-01T00:00:00.000Z"' },
  { label: 'Space format', val: 'expiresAt >= "2026-01-01 00:00:00.000Z"' },
  { label: 'No ms', val: 'expiresAt >= "2026-01-01T00:00:00Z"' },
  { label: 'Simple date', val: 'expiresAt >= "2026-01-01"' },
  { label: 'Go ref time', val: 'expiresAt >= "2006-01-02T15:04:05Z"' },
];

// First create a test record so we have something
try {
  await pb.collection('user_sessions').create({
    userId: 'test_user',
    sessionToken: 'test_' + Date.now(),
    machineId: 'test_machine',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }, { requestKey: 'create_test' });
  console.log('Created test session record');
} catch (e) {
  console.log('Create test session error:', e.message);
}

for (const { label, val } of formats) {
  try {
    const result = await pb.collection('user_sessions').getList(1, 1, {
      filter: val,
      requestKey: 'test_' + label.replace(/\s/g, '_')
    });
    console.log('OK ' + label + ': total=' + result.totalItems);
  } catch (e) {
    console.log('FAIL ' + label + ': ' + e.message);
  }
}
