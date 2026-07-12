import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Try adding just an autodate field with different option formats
  const col = await pb.send('/api/collections/announcements', { method: 'GET' });

  const fields = [...(col.fields || [])];

  // Test autodate with onCreate: true
  try {
    await pb.send('/api/collections/announcements', {
      method: 'PATCH',
      body: {
        fields: [...fields, { name: 'test_auto', type: 'autodate', options: { onCreate: true, onUpdate: false } }],
      },
    });
    console.log('SUCCESS with onCreate:true, onUpdate:false');

    // Cleanup
    const col2 = await pb.send('/api/collections/announcements', { method: 'GET' });
    const cleaned2 = col2.fields?.filter((f: any) => f.name !== 'test_auto') || [];
    await pb.send('/api/collections/announcements', { method: 'PATCH', body: { fields: cleaned2 } });
    console.log('Cleaned up');
  } catch (e: any) {
    console.log('FAILED with options:', JSON.stringify(e.response?.data));
  }
}

main().catch(console.error);
