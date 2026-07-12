import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const col = await pb.send('/api/collections/membership_transactions', { method: 'GET' });
  const existingFields = col.fields || [];
  const existingNames = new Set(existingFields.map((f: any) => f.name));

  const missingFields = [
    { name: 'paymentStatus', type: 'text' },
    { name: 'userId', type: 'text' },
    { name: 'planId', type: 'text' },
    { name: 'amount', type: 'number' },
    { name: 'currency', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ];

  const toAdd = missingFields.filter(f => !existingNames.has(f.name));

  if (toAdd.length > 0) {
    console.log('Membership transactions: adding', toAdd.map(f => f.name).join(', '));
    await pb.send('/api/collections/membership_transactions', {
      method: 'PATCH',
      body: { fields: [...existingFields, ...toAdd] },
    });
    console.log('SUCCESS');
  } else {
    console.log('All fields already exist');
  }
}

main().catch(console.error);
