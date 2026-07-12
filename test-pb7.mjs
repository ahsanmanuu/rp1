import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Try different filter approaches on the `user_sessions` collection
// which we know has records

const tests = [
  // Non-date filters
  'sessionToken != ""',
  'userId = "test_user"',
  // Date filters - various formats
  'created >= @now',
  'created > "2026-01-01 00:00:00.000Z"',
  'created > "2026-01-01 00:00:00"',
  'created >= "2026-01-01"',
  'created > @now',
  // Try the system created field
  'created > ""',
  // Try empty check
  'expires = ""',
  'expires != ""',
  // Try not null  
  'userId != null',
];

for (const filter of tests) {
  try {
    const result = await pb.collection('user_sessions').getList(1, 1, {
      filter,
      requestKey: 't_' + Date.now() + Math.random()
    });
    console.log('OK:', filter, '-> total=' + result.totalItems);
  } catch (e) {
    let detail = e.message;
    if (e.response?.data) detail += ' ' + JSON.stringify(e.response.data);
    console.log('FAIL:', filter, '->', detail);
  }
}
