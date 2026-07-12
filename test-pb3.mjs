import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
const authData = await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
console.log('Auth OK');

// Get collection schema for user_sessions using the admin SDK
try {
  // Try to get collection by name
  const col = await pb.collections.getOne('user_sessions', { requestKey: 'get_col' });
  console.log('Collection fields:', JSON.stringify(col, null, 2));
} catch (e) {
  console.log('Error getting collection:', e.message);
}

// Try a simple filter without dates
try {
  const result = await pb.collection('user_sessions').getList(1, 5, { requestKey: 'list_simple' });
  console.log('user_sessions items:', result.totalItems);
  if (result.items.length > 0) {
    console.log('First item keys:', Object.keys(result.items[0]));
    console.log('First item created:', result.items[0].created);
  }
} catch (e) {
  console.log('Error listing:', e.message);
}
