import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function run() {
  console.log('Authenticating with PocketBase...');
  const authData = await pb.admins.authWithPassword('admin@latexify.io', 'Sczone@123');
  const token = pb.authStore.token;
  console.log('Auth OK, token obtained:', token.slice(0, 15) + '...');

  console.log('Sending request to /api/admin/backup...');
  const res = await fetch('http://localhost:3000/api/admin/backup?includeFiles=false', {
    headers: {
      'Cookie': `admin_session=${token}`
    }
  });

  console.log('Response Status:', res.status, res.statusText);
  console.log('Response Headers:', Object.fromEntries(res.headers.entries()));

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    console.log('Response JSON:', json);
  } else {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('Response Buffer length:', buffer.length);
    if (buffer.length < 500) {
      console.log('Response content (first 500 bytes):', buffer.toString('utf8'));
    }
  }
}

run().catch(console.error);
