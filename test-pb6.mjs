import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const col = all.find(c => c.name === 'user_sessions');

if (col) {
  console.log('user_sessions fields:');
  for (const f of col.fields) {
    console.log(`  ${f.name}: type=${f.type}, system=${f.system}, required=${f.required}`);
  }
}

// Also check if there's a `created` system field
console.log('\nChecking created field...');
const createdField = col.fields.find(f => f.name === 'created' || f.name === 'createdAt');
console.log('created/createdAt field:', createdField ? JSON.stringify(createdField) : 'not found');

// Try a simple filter without dates
try {
  const result = await pb.collection('user_sessions').getList(1, 5, {
    filter: 'sessionToken != ""',
    requestKey: 'simple_filter'
  });
  console.log('\nSimple filter OK, items:', result.totalItems);
  if (result.items.length > 0) {
    console.log('First item:', JSON.stringify(result.items[0], null, 2));
  }
} catch (e) {
  console.log('\nSimple filter FAIL:', e.message);
}

// Try a date comparison using the `created` system field
try {
  const result = await pb.collection('user_sessions').getList(1, 5, {
    filter: 'created >= "2026-01-01 00:00:00.000Z"',
    requestKey: 'created_filter'
  });
  console.log('created filter OK, items:', result.totalItems);
} catch (e) {
  console.log('created filter FAIL:', e.message);
}

// Try expiresAt with just != null
try {
  const result = await pb.collection('user_sessions').getList(1, 5, {
    filter: 'expiresAt != null',
    requestKey: 'expires_notnull'
  });
  console.log('expiresAt != null filter OK, items:', result.totalItems);
} catch (e) {
  console.log('expiresAt != null filter FAIL:', e.message);
}
