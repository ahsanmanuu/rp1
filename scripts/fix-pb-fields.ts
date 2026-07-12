import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Try to add a single field to announcements
  const ann = await pb.send('/api/collections/announcements', { method: 'GET' });

  const existingFields = ann.fields || [];
  const existingNames = new Set(existingFields.map((f: any) => f.name));

  // PocketBase requires you to include ALL existing fields when updating
  // Including system fields like 'id' must be kept
  const newField = {
    name: 'test_field',
    type: 'text',
    required: false,
  };

  if (!existingNames.has('test_field')) {
    try {
      const result = await pb.send('/api/collections/announcements', {
        method: 'PATCH',
        body: { fields: [...existingFields, newField] },
      });
      console.log('SUCCESS adding test_field');
      console.log('Fields now:', result.fields?.map((f: any) => f.name));

      // Remove test field
      const cleaned = result.fields?.filter((f: any) => f.name !== 'test_field') || [];
      await pb.send('/api/collections/announcements', {
        method: 'PATCH',
        body: { fields: cleaned },
      });
      console.log('Removed test_field');
    } catch (e: any) {
      console.log('FAILED:', e.message);
      console.log('Response data:', JSON.stringify(e.response?.data));
    }
  }
}

main().catch(console.error);
