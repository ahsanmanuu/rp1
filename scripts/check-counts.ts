import { PrismaClient } from '@prisma/client';
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const prisma = new PrismaClient();
  const pb = new PocketBase('http://127.0.0.1:8090');
  
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  const prismaUserCount = await prisma.user.count();
  const pbUserCount = await pb.collection('users').getList(1, 1).then(r => r.totalItems);

  const prismaProjectCount = await prisma.project.count();
  const pbProjectCount = await pb.collection('projects').getList(1, 1).then(r => r.totalItems);

  console.log(`Prisma Users: ${prismaUserCount}`);
  console.log(`PocketBase Users: ${pbUserCount}`);
  console.log(`Prisma Projects: ${prismaProjectCount}`);
  console.log(`PocketBase Projects: ${pbProjectCount}`);
}

main().catch(console.error);
