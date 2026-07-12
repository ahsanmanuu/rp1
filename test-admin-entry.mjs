import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const cols = await pb.collections.getFullList();
  console.log("Collections:", cols.map(c => c.name));
  
  // Try inserting into admin_users?
  try {
    const adminCols = cols.filter(c => c.name.includes('admin'));
    console.log("Admin related collections:", adminCols.map(c => c.name));
    
    // Attempt to create an admin user in 'admin_users'
    const newAdmin = await pb.collection('admin_users').create({
      email: "test_manual_admin@latexify.com",
      passwordHash: "dummy",
      name: "Test Admin",
      role: "admin",
      permissions: {},
      isActive: true
    });
    console.log("Created admin user successfully:", newAdmin.id);
  } catch (err) {
    console.error("Failed to create admin user:", err.message, err.response);
  }
}

main().catch(console.error);
