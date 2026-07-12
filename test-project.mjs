import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  
  const users = await pb.collection('users').getFullList();
  if (users.length === 0) {
    console.log("No users exist to link project to.");
    return;
  }
  
  try {
    const proj = await pb.collection('projects').create({
      userId: users[0].id,
      title: "Test Project",
      status: "draft"
    });
    console.log("Created project:", proj.id);
  } catch (err) {
    console.error("Failed to create project:", err.message, err.response);
  }
}

main().catch(console.error);
