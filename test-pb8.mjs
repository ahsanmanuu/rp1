import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Get raw record to see system field names
const raw = await pb.collection('user_sessions').getList(1, 1, { requestKey: 'raw' });
if (raw.items.length > 0) {
  console.log('Raw item keys:', Object.keys(raw.items[0]));
  console.log('Raw item:', JSON.stringify(raw.items[0], null, 2));
}

// Try filtering on createdAt (autodate custom field)
const tests = [
  'createdAt != ""',  
  'createdAt >= "2026-01-01 00:00:00.000Z"',
  'createdAt > "2026-01-01"',
  'expiresAt != null',
  'expiresAt >= "2026-01-01 00:00:00.000Z"',
  'expiresAt = ""',
  // Maybe it uses camelCase differently
  'expires_at >= "2026-01-01 00:00:00.000Z"',
];

for (const filter of tests) {
  try {
    const result = await pb.collection('user_sessions').getList(1, 1, {
      filter,
      requestKey: 't_' + Date.now()
    });
    console.log('OK:', filter, '-> total=' + result.totalItems);
  } catch (e) {
    console.log('FAIL:', filter, '->', e.message);
  }
}
