import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
const authData = await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
console.log('Auth OK');

// Get collection schema for user_sessions
const collections = await pb.collections.getFullList({ requestKey: 'list' });
const sessionsCol = collections.find(c => c.name === 'user_sessions');
if (sessionsCol) {
  console.log('user_sessions schema fields:', sessionsCol.schema ? sessionsCol.schema.map(f => f.name + ':' + f.type) : 'no schema');
} else {
  console.log('user_sessions collection not found');
  console.log('Collections:', collections.map(c => c.name).join(', '));
}

// Try different date formats
const formats = [
  'expiresAt >= "2026-01-01 00:00:00.000Z"',
  'expiresAt >= @now',
  'expiresAt >= "2026-01-01T00:00:00.000Z"',
  'expiresAt >= "2026-01-01 00:00:00"',
  'created >= "2026-01-01 00:00:00.000Z"',
];

for (const f of formats) {
  try {
    const result = await pb.collection('user_sessions').getList(1, 1, {
      filter: f,
      requestKey: 'test_' + Math.random()
    });
    console.log('OK:', f, '->', result.totalItems);
  } catch (e) {
    console.error('FAIL:', f, '->', e.message, JSON.stringify(e?.response?.data));
  }
}
