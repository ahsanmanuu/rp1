/**
 * Seed a dev user in PocketBase for testing.
 * Usage: npx tsx scripts/seed-dev-user.ts
 */
import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Check if test user exists
  let user: any = null;
  try {
    user = await pb.collection('users').getFirstListItem('email = "test@latexify.io"');
    console.log('Test user already exists:', user.id);
  } catch {
    // Create test user
    user = await pb.collection('users').create({
      email: 'test@latexify.io',
      password: 'test123456',
      passwordConfirm: 'test123456',
      name: 'Test User',
      points: 1000,
      theme: 'dark',
      membership: 'premium',
      role: 'user',
      status: 'active',
    });
    console.log('Created test user:', user.id);
  }

  // Verify login works
  const authPb = new PocketBase(PB_URL);
  await authPb.collection('users').authWithPassword('test@latexify.io', 'test123456');
  console.log('Test user login OK, token:', authPb.authStore.token?.substring(0, 20) + '...');

  // Also create a sample service health if needed
  let health: any = null;
  try {
    health = await pb.collection('service_health').getFirstListItem('serviceKey = "latex_editor"');
    console.log('Service health exists:', health.id);
  } catch {
    health = await pb.collection('service_health').create({
      serviceKey: 'latex_editor',
      uptime: 99.9,
      latencyMs: 245,
      queueJobs: 3,
      usagePercent: 62,
    });
    console.log('Created service health:', health.id);
  }

  console.log('\n✓ Dev environment ready!');
  console.log('  User: test@latexify.io / test123456');
  console.log('  Admin (superuser): admin@latexify.io / Sczone@123');
}

main().catch(console.error);
