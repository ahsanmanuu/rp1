import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const filters = [
  'userId = "9157m856ax09879"',
  'paymentStatus = "paid"',
  'paymentStatus != ""',
  'paymentStatus != null',
  'userId != ""',
];

for (const f of filters) {
  try {
    const result = await pb.collection('membership_transactions').getList(1, 5, {
      filter: f,
      requestKey: 'test_' + Date.now()
    });
    console.log('OK:', f, '->', result.totalItems);
  } catch (e) {
    console.log('FAIL:', f, '->', e.message);
  }
}
