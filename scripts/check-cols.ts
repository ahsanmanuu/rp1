import PocketBase from 'pocketbase';
async function main() {
  const pb = new PocketBase('http://127.0.0.1:8090');
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const cols = await pb.collections.getFullList();
  const names = ['user_sessions', 'verification_tokens', 'ai_cap_plans', 'ai_cap_rules', 'announcements'];
  for (const c of cols) {
    if (names.includes(c.name)) {
      const schema = ((c as any).schema || []) as any[];
      console.log(c.name + ':');
      for (const f of schema) {
        console.log('  ' + f.name + ' (' + f.type + ')');
      }
      console.log();
    }
  }
}
main().catch(console.error);
