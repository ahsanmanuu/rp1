import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

// Test the exact filter from the error
const filter = 'userId = "9157m856ax09879" && paymentStatus = "paid"';
console.log('Testing filter:', filter);
try {
  const result = await pb.collection('membership_transactions').getList(1, 30, {
    filter,
    sort: 'createdAt',
    requestKey: 'test_mt'
  });
  console.log('OK, items:', result.totalItems);
} catch (e) {
  console.log('FAIL:', e.message);
}

// Test simple filter
try {
  const result = await pb.collection('membership_transactions').getList(1, 5, {
    requestKey: 'test_mt_simple'
  });
  console.log('Simple list OK, items:', result.totalItems);
} catch (e) {
  console.log('Simple list FAIL:', e.message);
}

// Test membership_transactions fields
const all = await pb.collections.getFullList({ requestKey: 'all' });
const mt = all.find(c => c.name === 'membership_transactions');
if (mt) {
  console.log('membership_transactions fields:', mt.fields.map(f => f.name + ':' + f.type).join(', '));
}
