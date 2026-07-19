import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'Sczone@123');
console.log('Auth OK');

const failedCols = ['term_acceptances', 'general_queries', 'banners', 'testimonials'];

for (const name of failedCols) {
  try {
    const colInfo = await pb.collections.getOne(name);
    console.log(`Collection ${name}: type=${colInfo.type}, fields=${colInfo.fields.map(f => f.name).join(', ')}`);
  } catch (e) {
    console.log(`Collection ${name} metadata fetch failed:`, e.message);
  }

  try {
    const res = await pb.collection(name).getList(1, 5, { requestKey: null });
    console.log(`Collection ${name} list OK: count=${res.totalItems}`);
  } catch (e) {
    console.log(`Collection ${name} list failed:`, e.message);
  }
}




