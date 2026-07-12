import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const all = await pb.collections.getFullList({ requestKey: 'all' });
const col = all.find(c => c.name === 'user_sessions');

// Try with FULL field definition including all defaults
const textField = {
  name: 'testField2',
  type: 'text',
  system: false,
  required: false,
  presentable: false,
  unique: false,
  hidden: false,
  min: null,
  max: null,
  pattern: '',
  autogeneratePattern: '',
};

console.log('Adding field with full definition...');
const updatedSchema = [...col.fields, textField];

try {
  // Try using the raw fetch instead of SDK
  const url = `http://127.0.0.1:8090/api/collections/${col.id}`;
  const token = pb.authStore.token;
  
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ schema: updatedSchema }),
  });
  const data = await resp.json();
  console.log('Response status:', resp.status);
  console.log('Response fields:', data?.fields?.map(f => f.name + ':' + f.type));
  
  // Verify with fresh fetch
  const verifyResp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const verifyData = await verifyResp.json();
  console.log('Actual fields:', verifyData?.fields?.map(f => f.name + ':' + f.type));
} catch (e) {
  console.log('Error:', e.message);
}
