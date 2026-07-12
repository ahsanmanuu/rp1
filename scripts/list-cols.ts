import PocketBase from 'pocketbase';
async function main() {
  const pb = new PocketBase('http://127.0.0.1:8090');
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const cols = await pb.collections.getFullList();
  for (const c of cols) {
    const schema = ((c as any).schema || []) as any[];
    console.log(c.name + ' -> ' + schema.map((f: any) => f.name).join(', '));
  }
}
main().catch(console.error);
