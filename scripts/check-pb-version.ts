import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
const health = await pb.health.check();
console.log('PB health:', JSON.stringify(health));
