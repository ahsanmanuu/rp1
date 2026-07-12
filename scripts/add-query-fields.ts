import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

async function main() {
  const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
  const pb = new PocketBase(PB_URL);
  let email = 'admin@latexify.io';
  let password = 'admin123456';

  const credsPath = path.resolve(process.cwd(), 'pb_data', 'admin_creds.json');
  if (fs.existsSync(credsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      if (data.email) email = data.email;
      if (data.password) password = data.password;
    } catch (err: any) {
      console.log('Error reading creds:', err.message);
    }
  }

  try {
    await pb.collection('_superusers').authWithPassword(email, password);
    console.log('Authenticated successfully.');

    const collections = await pb.collections.getFullList();
    const gq = collections.find(c => c.name === 'general_queries');
    if (!gq) {
      console.log('general_queries collection not found!');
      return;
    }

    const fields = gq.fields || [];
    const fieldNames = new Set(fields.map(f => f.name));

    let modified = false;
    if (!fieldNames.has('status')) {
      fields.push({
        name: 'status',
        type: 'text',
        required: false
      } as any);
      console.log('Adding field "status" to general_queries collection.');
      modified = true;
    }

    if (!fieldNames.has('reply')) {
      fields.push({
        name: 'reply',
        type: 'text',
        required: false
      } as any);
      console.log('Adding field "reply" to general_queries collection.');
      modified = true;
    }

    if (modified) {
      await pb.collections.update(gq.id, {
        fields: fields
      });
      console.log('general_queries collection updated successfully.');
    } else {
      console.log('general_queries collection already has status and reply fields.');
    }
  } catch (err: any) {
    console.error('Operation failed:', err.message, err.data ? JSON.stringify(err.data) : '');
  }
}

main().catch(err => {
  console.error('Error running script:', err);
});
